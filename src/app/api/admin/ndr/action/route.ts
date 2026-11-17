import { NextRequest, NextResponse } from "next/server";
import { getRouteSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { emailNdrActionedByAdmin } from "@/lib/email";
import { takeNdrAction } from "@/lib/ndr";

// POST { orderId, action: "REATTEMPT"|"RTO", reattemptDate?, name?, phone?, address?, city?, pincode?, state?, comments? | note? }
// Sent to the shipment's courier (Shipdaak or Delhivery), then recorded on the order.
export async function POST(req: NextRequest) {
  const session = await getRouteSession(req);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { orderId, action } = body;
  if (!orderId || !action) return NextResponse.json({ error: "orderId and action required" }, { status: 400 });
  if (!["REATTEMPT", "RTO"].includes(action)) return NextResponse.json({ error: "action must be REATTEMPT or RTO" }, { status: 400 });

  try {
    const result = await takeNdrAction(orderId, {
      action,
      reattemptDate: body.reattemptDate || undefined,
      name: body.name || undefined,
      phone: body.phone || undefined,
      address: body.address || undefined,
      city: body.city || undefined,
      state: body.state || undefined,
      pincode: body.pincode || undefined,
      note: body.note ?? body.comments ?? undefined,
    }, { id: session.user.id, label: session.user.name || "AXQEN team" });

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { externalOrderId: true, seller: { select: { name: true, email: true } } },
    });
    if (order?.seller?.email) {
      emailNdrActionedByAdmin({
        to: order.seller.email,
        name: order.seller.name ?? "Seller",
        externalOrderId: order.externalOrderId,
        action,
      }).catch(() => {});
    }
    return NextResponse.json({ ok: true, message: result.message });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Could not send the NDR action" }, { status: 400 });
  }
}
