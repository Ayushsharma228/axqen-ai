import { InvoicePrintView } from "@/components/invoices/invoice-print-view";

// One AXP invoice, print-ready. Access is checked by /api/invoices/[id] (seller: own invoices only).
export default async function PrintInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <InvoicePrintView url={`/api/invoices/${encodeURIComponent(id)}`} title="Tax Invoice" />;
}
