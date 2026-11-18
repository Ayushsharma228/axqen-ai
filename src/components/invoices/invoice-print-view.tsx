"use client";

import { useEffect, useState } from "react";
import { InvoiceDocument, type InvoiceDoc } from "@/components/invoices/invoice-document";
import type { InvoiceSettings } from "@/lib/invoice-format";

/** Loads invoices from an API URL and shows them print-ready (one per A4 page) with a Print / Save as PDF bar. */
export function InvoicePrintView({ url, title }: { url: string; title: string }) {
  const [data, setData] = useState<{ invoices: InvoiceDoc[]; settings: InvoiceSettings } | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(url).then(async r => {
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error ?? "Couldn't load the invoice");
      setData(d);
    }).catch(e => setError(e instanceof Error ? e.message : "Couldn't load the invoice"));
  }, [url]);

  useEffect(() => { document.title = title; }, [title]);

  return (
    <div style={{ background: "#E5E7EB", minHeight: "100vh", paddingBottom: 24 }}>
      <style>{`
        @page { size: A4; margin: 10mm; }
        @media print {
          .no-print { display: none !important; }
          body, html { background: #fff !important; }
          .print-root { background: #fff !important; padding: 0 !important; }
          .invoice-sheet { box-shadow: none !important; margin: 0 !important; padding: 0 !important; }
          .invoice-sheet + .invoice-sheet { break-before: page; page-break-before: always; }
        }
      `}</style>
      <div className="no-print" style={{ position: "sticky", top: 0, zIndex: 10, background: "#0C1220", color: "#fff", padding: "10px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, fontFamily: "Arial, sans-serif", fontSize: 13 }}>
        <span>{error ? "Invoice" : data ? `${data.invoices.length} invoice${data.invoices.length === 1 ? "" : "s"}` : "Loading…"}</span>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => window.print()} disabled={!data?.invoices.length}
            style={{ background: "#4361EE", color: "#fff", border: 0, borderRadius: 8, padding: "8px 14px", fontWeight: 700, cursor: "pointer", opacity: data?.invoices.length ? 1 : 0.5 }}>
            Print / Save as PDF
          </button>
          <button onClick={() => window.close()} style={{ background: "transparent", color: "#fff", border: "1px solid #ffffff55", borderRadius: 8, padding: "8px 12px", cursor: "pointer" }}>Close</button>
        </div>
      </div>
      <div className="print-root" style={{ padding: "16px 8px" }}>
        {error && <p style={{ textAlign: "center", fontFamily: "Arial", color: "#B91C1C", marginTop: 40 }}>{error}</p>}
        {data && data.invoices.length === 0 && <p style={{ textAlign: "center", fontFamily: "Arial", color: "#6B7280", marginTop: 40 }}>No invoices for this month.</p>}
        {data?.invoices.map(inv => (
          <div key={inv.id} className="invoice-sheet" style={{ background: "#fff", maxWidth: "210mm", margin: "0 auto 16px", padding: "10mm", boxShadow: "0 2px 12px rgba(0,0,0,0.12)", overflowX: "auto" }}>
            <InvoiceDocument inv={inv} settings={data.settings} />
          </div>
        ))}
      </div>
    </div>
  );
}
