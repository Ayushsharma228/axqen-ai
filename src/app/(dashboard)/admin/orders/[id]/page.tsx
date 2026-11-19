import { redirect } from "next/navigation";

// The old order detail page (supplier and settlement era) is replaced by the order drawer on All Orders.
export default async function AdminOrderRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/admin/orders?order=${encodeURIComponent(id)}`);
}
