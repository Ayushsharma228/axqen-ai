"use client";
import { Printer } from "lucide-react";

export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold transition-colors hover:bg-[#EAF2FF]"
      style={{ color: "#0B3DCE", border: "1px solid #CFDDFB", background: "#fff" }}
    >
      <Printer className="w-4 h-4" /> Print receipt
    </button>
  );
}
