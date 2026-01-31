import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { isAdmin } from "@/types/auth-mode";
import type { UserRole } from "@/types/auth-mode";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  // Check if user is admin
  if (!session?.user || !isAdmin(session.user.role as UserRole)) {
    redirect("/");
  }

  // Just render children - sidebar is in the shared (main) layout
  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-3xl px-4 pt-8 pb-16">
        {children}
      </div>
    </div>
  );
}
