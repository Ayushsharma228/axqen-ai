import { NextRequest, NextResponse } from "next/server";
import { getRouteSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await getRouteSession(req);
  if (!session || session.user.role !== "ADMIN")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const search     = searchParams.get("search")   ?? "";
  const sellerId   = searchParams.get("sellerId") ?? "";
  const repeatOnly = searchParams.get("repeat")   === "true";
  const page       = Math.max(1, parseInt(searchParams.get("page")  ?? "1"));
  const limit      = Math.min(200, parseInt(searchParams.get("limit") ?? "50"));
  const offset     = (page - 1) * limit;

  // Build WHERE clauses for the raw query
  const conditions: string[] = ["customer_name IS NOT NULL"];
  const values: (string | number)[] = [];
  let idx = 1;

  if (sellerId) {
    conditions.push(`seller_id = $${idx++}`);
    values.push(sellerId);
  }
  if (search) {
    conditions.push(`(customer_name ILIKE $${idx} OR customer_address->>'phone' ILIKE $${idx})`);
    values.push(`%${search}%`);
    idx++;
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const havingClause = repeatOnly ? "HAVING COUNT(*) > 1" : "HAVING COUNT(*) >= 1";

  type CustomerRow = {
    customer_name: string;
    phone: string | null;
    seller_ids: string[];
    total_orders: bigint;
    delivered_orders: bigint;
    rto_orders: bigint;
    cancelled_orders: bigint;
    total_spend: number;
    last_order_at: Date;
    first_order_at: Date;
  };

  const [rows, countResult] = await Promise.all([
    prisma.$queryRawUnsafe<CustomerRow[]>(
      `SELECT
         customer_name,
         customer_address->>'phone' AS phone,
         ARRAY_AGG(DISTINCT seller_id) AS seller_ids,
         COUNT(*)                    AS total_orders,
         SUM(CASE WHEN status = 'DELIVERED'  THEN 1 ELSE 0 END) AS delivered_orders,
         SUM(CASE WHEN status = 'RTO'        THEN 1 ELSE 0 END) AS rto_orders,
         SUM(CASE WHEN status = 'CANCELLED'  THEN 1 ELSE 0 END) AS cancelled_orders,
         SUM(total_amount)           AS total_spend,
         MAX(created_at)             AS last_order_at,
         MIN(created_at)             AS first_order_at
       FROM orders
       ${whereClause}
       GROUP BY customer_name, customer_address->>'phone'
       ${havingClause}
       ORDER BY total_orders DESC, last_order_at DESC
       LIMIT ${limit} OFFSET ${offset}`,
      ...values,
    ),
    prisma.$queryRawUnsafe<[{ count: bigint }]>(
      `SELECT COUNT(*) AS count FROM (
         SELECT customer_name, customer_address->>'phone'
         FROM orders
         ${whereClause}
         GROUP BY customer_name, customer_address->>'phone'
         ${havingClause}
       ) sub`,
      ...values,
    ),
  ]);

  const total   = Number(countResult[0]?.count ?? 0);
  const pages   = Math.ceil(total / limit);

  const customers = rows.map((r) => ({
    customerName:    r.customer_name,
    phone:           r.phone ?? null,
    totalOrders:     Number(r.total_orders),
    deliveredOrders: Number(r.delivered_orders),
    rtoOrders:       Number(r.rto_orders),
    cancelledOrders: Number(r.cancelled_orders),
    totalSpend:      Number(r.total_spend ?? 0),
    lastOrderAt:     r.last_order_at,
    firstOrderAt:    r.first_order_at,
    isRepeat:        Number(r.total_orders) > 1,
    deliveryRate:    Number(r.total_orders) > 0
      ? Math.round(Number(r.delivered_orders) / Number(r.total_orders) * 100)
      : 0,
  }));

  // Summary stats (always unfiltered by page/repeat for the cards)
  const [summary] = await prisma.$queryRawUnsafe<[{
    total_customers: bigint;
    repeat_customers: bigint;
    total_orders: bigint;
    total_delivered: bigint;
  }]>(
    `SELECT
       COUNT(DISTINCT (customer_name, customer_address->>'phone')) AS total_customers,
       COUNT(DISTINCT CASE WHEN cnt > 1 THEN grp END)             AS repeat_customers,
       SUM(cnt)                                                    AS total_orders,
       SUM(del)                                                    AS total_delivered
     FROM (
       SELECT
         customer_name || COALESCE(customer_address->>'phone','') AS grp,
         COUNT(*)                                                  AS cnt,
         SUM(CASE WHEN status='DELIVERED' THEN 1 ELSE 0 END)      AS del
       FROM orders
       ${sellerId ? `WHERE seller_id = '${sellerId.replace(/'/g, "''")}'` : ""}
       GROUP BY customer_name, customer_address->>'phone'
     ) sub`,
  );

  return NextResponse.json({
    customers,
    total,
    page,
    pages,
    summary: {
      totalCustomers:   Number(summary?.total_customers   ?? 0),
      repeatCustomers:  Number(summary?.repeat_customers  ?? 0),
      totalOrders:      Number(summary?.total_orders      ?? 0),
      totalDelivered:   Number(summary?.total_delivered   ?? 0),
    },
  });
}
