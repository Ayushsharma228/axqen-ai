"use client";

import { NdrBoard } from "@/components/ndr/ndr-board";

// The AXQEN team handles NDRs; sellers see every attempt and action, and can escalate after 24h.
export default function SellerNdrPage() {
  return <NdrBoard mode="seller" />;
}
