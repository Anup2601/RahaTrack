"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, FolderKanban, LogOut } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { logoutUser } from "@/lib/auth";
import { cn } from "@/lib/utils";
import Image from "next/image";

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
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex md:w-64 md:flex-col md:justify-between bg-[#8a8a8a] px-4  shadow-[6px_0_20px_rgba(0,0,0,0.12)]">
        
        <div className="">
          
          {/* ✅ BIG LOGO ONLY */}
          <div className="flex justify-center items-center">
            <Image
              src="/rahalogo.png"
              alt="Logo"
              width={120}
              height={120}
              className="object-contain"
              priority
            />
          </div>

          {/* Navigation */}
          <nav className="">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive =
                pathname === item.href ||
                (item.href.includes("#") && pathname === "/dashboard");

              return (
                <Link
                  key={item.label}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold text-white transition",
                    isActive
                      ? "bg-white text-black shadow-[0_6px_16px_rgba(0,0,0,0.2)]"
                      : "hover:bg-white/20"
                  )}
                >
                  <Icon className="size-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Logout Button */}
        <Button
          variant="outline"
          className="justify-start gap-2 border-black/20 bg-white/95 text-black hover:bg-white"
          onClick={handleLogout}
        >
          <LogOut className="size-4" />
          Logout
        </Button>
      </aside>

      {/* Mobile Header */}
      <header className="flex items-center justify-between bg-[#8a8a8a] px-4 py-3 md:hidden">
        
        {/* ✅ Logo only */}
        <Image
          src="/rahalogo.png"
          alt="Logo"
          width={40}
          height={40}
        />

        <Button
          size="sm"
          variant="outline"
          className="border-white/20 bg-white text-black hover:bg-white"
          onClick={handleLogout}
        >
          Logout
        </Button>
      </header>
    </>
  );
}