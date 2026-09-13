import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { SidebarV2 } from "@/components/layout/sidebar-v2";
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
    <div className="min-h-screen flex" style={{ background: "var(--bg-page)" }}>
      <SidebarV2
        role="supplier"
        userName={session.user.name ?? ""}
        userEmail={session.user.email ?? ""}
      />
      <main className="flex-1 min-h-screen pb-[72px] md:pb-0 pt-14 md:pt-0">
        {children}
      </main>
      <SupplierMobileBottomNav userName={session.user.name ?? ""} />
    </div>
  );
}
