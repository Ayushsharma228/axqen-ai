import { NextRequest, NextResponse } from "next/server";
import { getRouteSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { dispatchEvent } from "@/lib/automation/engine";
import { getCarrierTrackingUrl } from "@/lib/shipping-adapters";

type Action =
  | "ACCEPT"
  | "REJECT"
  | "MARK_PROCESSING"
  | "MARK_PACKED"
  | "READY_TO_SHIP"
  | "DISPATCH"
  | "CANCEL_ORDER";

const ACTION_TO_STATUS: Record<Action, string> = {
  ACCEPT: "ACCEPTED",
  REJECT: "REJECTED",
  MARK_PROCESSING: "PROCESSING",
  MARK_PACKED: "PACKED",
  READY_TO_SHIP: "READY_TO_SHIP",
  DISPATCH: "DISPATCHED",
  CANCEL_ORDER: "REJECTED",
};

const PO_STATUS_MAP: Record<Action, string> = {
  ACCEPT: "ACCEPTED",
  REJECT: "REJECTED",
  MARK_PROCESSING: "PROCESSING",
  MARK_PACKED: "PACKED",
  READY_TO_SHIP: "PACKED",
  DISPATCH: "DISPATCHED",
  CANCEL_ORDER: "REJECTED",
};

const EVENT_LABEL: Record<Action, string> = {
  ACCEPT: "ORDER_ACCEPTED",
  REJECT: "ORDER_REJECTED",
  MARK_PROCESSING: "MARKED_PROCESSING",
  MARK_PACKED: "MARKED_PACKED",
  READY_TO_SHIP: "READY_TO_SHIP",
  DISPATCH: "DISPATCHED",
  CANCEL_ORDER: "SUPPLIER_CANCELLED",
};

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getRouteSession(req);
  if (!session || session.user.role !== "SUPPLIER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();
  const { action, note, trackingNo, courier } = body as {
    action: Action;
    note?: string;
    trackingNo?: string;
    courier?: string;
  };

  if (!action || !ACTION_TO_STATUS[action]) {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  const order = await prisma.order.findFirst({
    where: { id, supplierId: session.user.id },
    include: {
      purchaseOrder: true,
      items: { select: { productId: true, quantity: true, name: true } },
    },
  });

  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

  const supplierStatus = ACTION_TO_STATUS[action] as Parameters<typeof prisma.order.update>[0]["data"]["supplierStatus"];
  const poStatus = PO_STATUS_MAP[action] as Parameters<typeof prisma.purchaseOrder.update>[0]["data"]["status"];

  const orderUpdate: Parameters<typeof prisma.order.update>[0]["data"] = {
    supplierStatus,
    supplierNote: note,
  };

  if (action === "REJECT" || action === "CANCEL_ORDER") {
    orderUpdate.supplierId = null;
    orderUpdate.supplierStatus = "REJECTED";
    if (action === "CANCEL_ORDER") {
      orderUpdate.status = "CANCELLED";
      orderUpdate.supplierNote = note ? `Supplier cancelled: ${note}` : "Supplier cancelled";
    }
  }

  if (action === "DISPATCH") {
    orderUpdate.dispatchedAt = new Date();
    orderUpdate.status = "SHIPPED";
    if (trackingNo) {
      orderUpdate.supplierTrackingNo = trackingNo;
      // Mirror to seller-visible fields
      orderUpdate.awbNumber = trackingNo;
    }
    if (courier) {
      orderUpdate.supplierCourier = courier;
      orderUpdate.courier = courier;
    }
    if (trackingNo && courier) {
      orderUpdate.trackingUrl = getCarrierTrackingUrl(courier, trackingNo) || null;
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ops: any[] = [
    prisma.order.update({ where: { id }, data: orderUpdate }),
    prisma.orderTimeline.create({
      data: {
        orderId: id,
        actorId: session.user.id,
        actorRole: "SUPPLIER",
        event: EVENT_LABEL[action],
        details: note ?? undefined,
        metadata: action === "DISPATCH" ? { trackingNo, courier } : undefined,
      },
    }),
  ];

  if (order.purchaseOrder) {
    ops.push(
      prisma.purchaseOrder.update({
        where: { id: order.purchaseOrder.id },
        data: {
          status: poStatus,
          ...(action === "REJECT" ? { rejectionReason: note } : {}),
          ...(action === "DISPATCH" ? { dispatchedAt: new Date() } : {}),
        },
      })
    );
  }

  // Notify admin on reject, cancel or dispatch
  if (action === "REJECT" || action === "CANCEL_ORDER" || action === "DISPATCH") {
    const adminUsers = await prisma.user.findMany({ where: { role: "ADMIN" }, select: { id: true } });
    const msg =
      action === "REJECT"
        ? `Supplier rejected order ${order.externalOrderId}. Reason: ${note ?? "none"}`
        : action === "CANCEL_ORDER"
        ? `Supplier cancelled order ${order.externalOrderId} after acceptance. Reason: ${note ?? "none"}`
        : `Order ${order.externalOrderId} dispatched by supplier. Tracking: ${trackingNo ?? "N/A"}`;
    const title =
      action === "REJECT" ? "Order Rejected by Supplier"
      : action === "CANCEL_ORDER" ? "Order Cancelled by Supplier"
      : "Order Dispatched";
    for (const a of adminUsers) {
      ops.push(
        prisma.notification.create({
          data: {
            userId: a.id,
            type: "ORDER_UPDATE",
            title,
            message: msg,
            data: { orderId: id },
          },
        })
      );
    }
  }

  await prisma.$transaction(ops);

  // Update inventory quantities when order is dispatched
  if (action === "DISPATCH") {
    try {
      for (const item of order.items ?? []) {
        if (!item.productId) continue;
        await prisma.inventoryItem.updateMany({
          where: { productId: item.productId },
          data: {
            availableQty: { decrement: item.quantity },
            reservedQty:  { decrement: item.quantity },
          },
        });
      }
    } catch (err) {
      console.error("Inventory update failed after dispatch:", err);
    }
  }

  if (action === "ACCEPT") {
    dispatchEvent({ type: "SUPPLIER_ACCEPTED", entityId: id, entityType: "ORDER",
                    payload: { supplierId: session.user.id }, actorId: session.user.id });
  } else if (action === "REJECT") {
    dispatchEvent({ type: "SUPPLIER_REJECTED", entityId: id, entityType: "ORDER",
                    payload: { supplierId: session.user.id, reason: note }, actorId: session.user.id });
  }

  return NextResponse.json({ success: true, supplierStatus: ACTION_TO_STATUS[action] });
}
