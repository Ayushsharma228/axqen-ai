import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { SellerSidebar } from "@/components/layout/seller-sidebar";

export default async function SellerLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);

  if (!session) redirect("/login");
  if (session.user.role !== "SELLER") redirect("/login");

  const status = (session.user as { accountStatus?: string }).accountStatus;
  if (status && status !== "ACTIVE") redirect("/onboarding");
  if (!session.user.plan && status === undefined) redirect("/onboarding");

  return (
    <div className="min-h-screen flex" style={{ background: "var(--bg-page)" }}>
      <SellerSidebar
        plan={session.user.plan ?? undefined}
        userName={session.user.name ?? ""}
        userEmail={session.user.email ?? ""}
      />
      <main className="flex-1 min-h-screen" style={{ marginLeft: "232px" }}>{children}</main>
    </div>
  );
}
