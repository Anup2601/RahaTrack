"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, FolderKanban, ShieldUser } from "lucide-react";
import { useAuth } from "@/components/providers/auth-provider";
import { cn } from "@/lib/utils";
import Image from "next/image";

export function Sidebar() {
  const pathname = usePathname();
  const { isSuperAdmin } = useAuth();

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
    ...(isSuperAdmin
      ? [
          {
            label: "Users",
            href: "/users",
            icon: ShieldUser,
          },
        ]
      : []),
  ];

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex md:w-64 md:flex-col bg-[#8a8a8a] px-4 shadow-[6px_0_20px_rgba(0,0,0,0.12)]">
        
        <div className="space-y-7">
          
          {/* ✅ BIG LOGO ONLY */}
          <div className="flex justify-center items-center py-4">
            <Image
              src="/rahalogo.png"
              alt="Logo"
              width={160}
              height={160}
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

      </aside>

      {/* Mobile Header */}
      <header className="flex items-center bg-[#8a8a8a] px-4 py-3 md:hidden">
        
        {/* ✅ Logo only */}
        <Image
          src="/rahalogo.png"
          alt="Logo"
          width={40}
          height={40}
        />

      </header>
    </>
  );
}