import { InvoicePrintView } from "@/components/invoices/invoice-print-view";

// All AXP invoices of a month, one per page. ?month=YYYY-MM (&sellerId= for admins)
export default async function PrintMonthInvoicesPage({ searchParams }: { searchParams: Promise<{ month?: string; sellerId?: string }> }) {
  const { month = "", sellerId = "" } = await searchParams;
  const q = new URLSearchParams({ month, ...(sellerId ? { sellerId } : {}) });
  return <InvoicePrintView url={`/api/invoices/month?${q}`} title={`Tax invoices ${month}`} />;
}
