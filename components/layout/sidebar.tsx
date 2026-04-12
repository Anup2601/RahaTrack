"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, FolderKanban, LogOut } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { logoutUser } from "@/lib/auth";
import { cn } from "@/lib/utils";

const navItems = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    label: "Sections",
    href: "/section",
    icon: FolderKanban,
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await logoutUser();
      toast.success("Logged out successfully");
      router.replace("/login");
    } catch {
      toast.error("Unable to logout. Please try again.");
    }
  };

  return (
    <>
      <aside className="hidden md:flex md:w-62 md:flex-col md:justify-between md:bg-[#8a8a8a] md:px-4 md:py-5 md:shadow-[6px_0_20px_rgba(0,0,0,0.12)]">
        <div className="space-y-7">
          <div className="rounded-r-3xl rounded-l-lg bg-[#8a8a8a]">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-black/80">
              PLI Tracker
            </p>
            <h1 className="mt-2 text-2xl font-bold text-black">Overview</h1>
          </div>

          <nav className="space-y-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href || (item.href.includes("#") && pathname === "/dashboard");

              return (
                <Link
                  key={item.label}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold text-white transition",
                    isActive
                      ? "bg-white text-black shadow-[0_6px_16px_rgba(0,0,0,0.2)]"
                      : "hover:bg-white/20 hover:text-white",
                  )}
                >
                  <Icon className="size-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <Button
          variant="outline"
          className="justify-start gap-2 border-black/20 bg-white/95 text-black hover:bg-white"
          onClick={handleLogout}
        >
          <LogOut className="size-4" />
          Logout
        </Button>
      </aside>

      <header className="flex items-center justify-between bg-[#8a8a8a] px-4 py-3 text-white md:hidden">
        <p className="font-semibold tracking-wide">PLI Tracker</p>
        <Button size="sm" variant="outline" className="border-white/20 bg-white text-black hover:bg-white" onClick={handleLogout}>
          Logout
        </Button>
      </header>
    </>
  );
}
