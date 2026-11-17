"use client";

import { RtoBoard } from "@/components/rto/rto-board";

// Returns on their way back, return scans, condition on arrival and RTO insights (read-only).
export default function SellerRtoPage() {
  return <RtoBoard mode="seller" />;
}
