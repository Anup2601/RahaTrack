"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Bell, Menu, Moon, Search, Settings, UserRound } from "lucide-react";
import { Sidebar } from "@/components/layout/sidebar";
import { LoadingCards } from "@/components/common/loading-cards";
import { useAuth } from "@/components/providers/auth-provider";

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [loading, router, user]);

  if (loading) {
    return (
      <div className="p-6">
        <LoadingCards count={5} />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[#ececec] md:grid md:grid-cols-[15.5rem_1fr]">
      <Sidebar />

      <div className="min-w-0 px-3 py-3 sm:px-4 sm:py-4 md:px-5 md:py-5">
        <header className="mb-4 flex items-center gap-2 rounded-[1.65rem] bg-primary px-3 py-2.5 shadow-[0_8px_20px_rgba(0,0,0,0.12)] sm:px-4">
          <button
            type="button"
            className="grid h-9 w-9 place-items-center rounded-full border border-black/15 bg-white/85 text-black md:hidden"
            aria-label="Open navigation"
          >
            <Menu className="size-4" />
          </button>

          <div className="relative w-full max-w-md">
            <Search className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-black/65" />
            <input
              className="h-10 w-full rounded-xl border border-black/20 bg-white px-4 pr-10 text-sm text-black placeholder:text-black/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/40"
              placeholder="Search & Navigate"
            />
          </div>

          <div className="ml-auto flex items-center gap-1 sm:gap-2">
            <button type="button" aria-label="Toggle theme" className="grid h-8 w-8 place-items-center rounded-full text-black transition hover:bg-black/10">
              <Moon className="size-4" />
            </button>
            <button type="button" aria-label="Notifications" className="relative grid h-8 w-8 place-items-center rounded-full text-black transition hover:bg-black/10">
              <Bell className="size-4" />
              <span className="absolute right-0.5 top-0.5 grid h-4 w-4 place-items-center rounded-full bg-red-500 text-[10px] font-bold text-white">5</span>
            </button>
            <button type="button" aria-label="Settings" className="grid h-8 w-8 place-items-center rounded-full text-black transition hover:bg-black/10">
              <Settings className="size-4" />
            </button>
            <button type="button" aria-label="Profile" className="grid h-8 w-8 place-items-center rounded-full text-black transition hover:bg-black/10">
              <UserRound className="size-4" />
            </button>
          </div>
        </header>

        <main>{children}</main>
      </div>
    </div>
  );
}
