import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { SellerSidebar } from "@/components/layout/seller-sidebar";
import { MobileBottomNav } from "@/components/layout/mobile-bottom-nav";

export default async function SellerLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);

  if (!session) redirect("/login");
  if (session.user.role !== "SELLER") redirect("/login");

  const status = (session.user as { accountStatus?: string }).accountStatus;
  if (status && status !== "ACTIVE") redirect("/onboarding");
  if (!session.user.plan && status === undefined) redirect("/onboarding");

  return (
    <div className="min-h-screen flex" style={{ background: "var(--bg-page)" }}>
      {/* Sidebar — desktop only */}
      <SellerSidebar
        plan={session.user.plan ?? undefined}
        userName={session.user.name ?? ""}
        userEmail={session.user.email ?? ""}
      />

      {/* Main content — full width on mobile, offset on desktop */}
      <main className="flex-1 min-h-screen pb-[72px] md:pb-0 md:ml-[232px]">
        {children}
      </main>

      {/* Bottom nav — mobile only */}
      <MobileBottomNav
        userName={session.user.name ?? ""}
        plan={session.user.plan ?? undefined}
      />
    </div>
  );
}
