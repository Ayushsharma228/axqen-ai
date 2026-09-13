import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { SupplierSidebar } from "@/components/layout/supplier-sidebar";
import { SupplierMobileBottomNav } from "@/components/layout/supplier-mobile-bottom-nav";

export default async function SupplierLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  if (!session) redirect("/login");
  if (session.user.role !== "SUPPLIER") redirect("/login");

  return (
    <div className="min-h-screen flex" style={{ background: "#F7F8FC" }}>
      <SupplierSidebar
        userName={session.user.name ?? ""}
        userEmail={session.user.email ?? ""}
      />
      {/* Desktop: offset for fixed 232px sidebar. Mobile: full width with top/bottom bars */}
      <main className="flex-1 min-h-screen pb-[72px] md:pb-0 md:ml-[232px]">
        {children}
      </main>
      <SupplierMobileBottomNav userName={session.user.name ?? ""} />
    </div>
  );
}
