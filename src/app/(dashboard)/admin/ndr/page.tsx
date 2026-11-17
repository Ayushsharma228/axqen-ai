"use client";

import { NdrBoard } from "@/components/ndr/ndr-board";

// Admin NDR desk: call the customer, then re-attempt or RTO. Actions go to Shipdaak or Delhivery.
export default function AdminNdrPage() {
  return <NdrBoard mode="admin" />;
}
