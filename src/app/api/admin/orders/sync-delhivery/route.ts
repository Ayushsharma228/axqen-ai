/**
 * POST /api/admin/orders/sync-delhivery
 *
 * Polls Delhivery's tracking API for all active Delhivery shipments and
 * auto-updates order status in AXQEN. Call this manually from the delivery
 * page or via a scheduled cron.
 *
 * Returns: { updated: number, errors: string[], results: SyncResult[] }
 */

import { NextRequest, NextResponse } from "next/server";
import { getRouteSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { delhiveryTrackShipments } from "@/lib/shipping-adapters";
import { decrypt } from "@/lib/encrypt";

interface SyncResult {
  orderId: string;
  externalOrderId: string;
  awb: string;
  prevStatus: string;
  newStatus: string;
  changed: boolean;
  note?: string;
}

// Only these statuses are considered "in-flight" and worth polling
const ACTIVE_STATUSES = ["SHIPPED", "IN_TRANSIT"];

// Move forward only — never downgrade status
const STATUS_ORDER = ["NEW", "PROCESSING", "SHIPPED", "IN_TRANSIT", "DELIVERED", "CANCELLED", "RTO"];

export async function POST(req: NextRequest) {
  const session = await getRouteSession(req);
  if (!session || session.user.role !== "ADMIN")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // 1. Find all in-flight Delhivery orders
  const orders = await prisma.order.findMany({
    where: {
      status: { in: ACTIVE_STATUSES as never[] },
      courier: { contains: "Delhivery", mode: "insensitive" },
      awbNumber: { not: null },
      supplierId: { not: null },
    },
    select: {
      id: true,
      externalOrderId: true,
      status: true,
      awbNumber: true,
      supplierId: true,
      sellerId: true,
    },
  });

  if (!orders.length) {
    return NextResponse.json({ updated: 0, errors: [], results: [], note: "No active Delhivery shipments found" });
  }

  // 2. Get each supplier's active Delhivery provider API key
  const supplierIds = [...new Set(orders.map((o) => o.supplierId as string))];
  const providers = await prisma.supplierShippingProvider.findMany({
    where: {
      supplierId: { in: supplierIds },
      provider: "DELHIVERY",
      isActive: true,
    },
    select: { supplierId: true, apiKey: true, baseUrl: true },
  });

  const apiKeyBySupplier: Record<string, { key: string; baseUrl: string | null }> = {};
  for (const p of providers) {
    const plain = p.apiKey ? decrypt(p.apiKey) : null;
    if (plain) apiKeyBySupplier[p.supplierId] = { key: plain, baseUrl: p.baseUrl };
  }

  // 3. Group orders by supplier so we batch-query each supplier's Delhivery account
  const bySupplier: Record<string, typeof orders> = {};
  for (const o of orders) {
    const sid = o.supplierId as string;
    if (!apiKeyBySupplier[sid]) continue; // no active Delhivery provider for this supplier
    bySupplier[sid] ??= [];
    bySupplier[sid].push(o);
  }

  const results: SyncResult[] = [];
  const errors: string[] = [];
  let updated = 0;

  for (const [supplierId, supplierOrders] of Object.entries(bySupplier)) {
    const { key, baseUrl } = apiKeyBySupplier[supplierId];
    const awbs = supplierOrders.map((o) => o.awbNumber as string);

    let trackData;
    try {
      trackData = await delhiveryTrackShipments(key, awbs, baseUrl ?? undefined);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Tracking fetch failed";
      errors.push(`Supplier ${supplierId}: ${msg}`);
      continue;
    }

    // Build a map of AWB → tracking result
    const trackMap = Object.fromEntries(trackData.map((t) => [t.awb, t]));

    for (const order of supplierOrders) {
      const track = trackMap[order.awbNumber as string];
      const result: SyncResult = {
        orderId: order.id,
        externalOrderId: order.externalOrderId,
        awb: order.awbNumber as string,
        prevStatus: order.status,
        newStatus: order.status,
        changed: false,
      };

      if (!track || !track.status) {
        result.note = "No tracking data returned";
        results.push(result);
        continue;
      }

      // Only move forward
      const currentIdx = STATUS_ORDER.indexOf(order.status);
      const newIdx = STATUS_ORDER.indexOf(track.status);
      const isRTO = track.status === "RTO";

      if (!isRTO && (newIdx === -1 || newIdx <= currentIdx)) {
        result.note = `Already at ${order.status}, Delhivery says ${track.statusCode}`;
        results.push(result);
        continue;
      }

      // Apply update
      await prisma.order.update({
        where: { id: order.id },
        data: { status: track.status as never },
      });

      await prisma.orderTimeline.create({
        data: {
          orderId:   order.id,
          actorId:   supplierId,
          actorRole: "SYSTEM",
          event:     track.statusCode,
          details:   `Delhivery sync: ${track.statusText}${track.city ? ` (${track.city})` : ""}`,
          metadata:  { awb: order.awbNumber, delhiveryCode: track.statusCode, rawStatus: track.statusText },
        },
      });

      // Notify seller on key milestones
      if (["SHIPPED", "IN_TRANSIT", "DELIVERED", "RTO"].includes(track.status) && order.sellerId) {
        const messages: Record<string, { title: string; msg: string }> = {
          SHIPPED:    { title: "Order Picked Up",     msg: `Order ${order.externalOrderId} picked up by Delhivery. AWB: ${order.awbNumber}` },
          IN_TRANSIT: { title: "Order In Transit",    msg: `Order ${order.externalOrderId} is in transit. AWB: ${order.awbNumber}` },
          DELIVERED:  { title: "Order Delivered",     msg: `Order ${order.externalOrderId} has been delivered. AWB: ${order.awbNumber}` },
          RTO:        { title: "Order RTO Initiated", msg: `Order ${order.externalOrderId} is being returned. AWB: ${order.awbNumber}` },
        };
        const notif = messages[track.status];
        if (notif) {
          await prisma.notification.create({
            data: {
              userId:  order.sellerId,
              type:    "ORDER_UPDATE",
              title:   notif.title,
              message: notif.msg,
              data:    { orderId: order.id, awb: order.awbNumber, status: track.status },
            },
          });
        }
      }

      result.newStatus = track.status;
      result.changed = true;
      updated++;
      results.push(result);
    }
  }

  return NextResponse.json({ updated, errors, results });
}
