import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AdminSidebar } from "@/components/layout/admin-sidebar";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  if (!session) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/login");

  return (
    <div className="flex min-h-screen" style={{ background: "var(--bg-page)" }}>
      <AdminSidebar userName={session.user.name ?? ""} />
      <main className="flex-1 min-w-0 min-h-screen pt-14 md:pt-0 md:ml-[var(--admin-nav-w,248px)] transition-[margin] duration-200">
        {children}
      </main>
    </div>
  );
}
