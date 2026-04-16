"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOut, Menu, Search, ShieldUser, UserRound } from "lucide-react";
import { toast } from "sonner";
import { BackButton } from "@/components/common/back-button";
import { Sidebar } from "@/components/layout/sidebar";
import { LoadingCards } from "@/components/common/loading-cards";
import { useAuth } from "@/components/providers/auth-provider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { logoutUser } from "@/lib/auth";
import { Button } from "@/components/ui/button";

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, appUser, role, isSuperAdmin, loading } = useAuth();

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [loading, router, user]);

  useEffect(() => {
    if (!loading && user && appUser?.status === "disabled") {
      void logoutUser();
      toast.error("Your account is disabled. Please contact superadmin.");
      router.replace("/login");
    }
  }, [appUser?.status, loading, router, user]);

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

  const displayName = appUser?.name?.trim() || user.displayName || user.email || "User";

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

          <BackButton
            fallbackRoute="/dashboard"
            className="h-9 rounded-xl border-black/20 bg-white/90 text-black hover:bg-white"
          />

          {/* <div className="relative w-full max-w-md">
            <Search className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-black/65" />
            <input
              className="h-10 w-full rounded-xl border border-black/20 bg-white px-4 pr-10 text-sm text-black placeholder:text-black/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/40"
              placeholder="Search & Navigate"
            />
          </div> */}

          <div className="ml-auto flex items-center gap-1 sm:gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger
                aria-label="Profile"
                className="grid h-8 w-8 place-items-center rounded-full text-black transition hover:bg-black/10"
              >
                <UserRound className="size-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuGroup>
                  <DropdownMenuLabel>
                    <div className="space-y-1 py-1">
                      <p className="truncate text-sm font-semibold text-foreground">{displayName}</p>
                      <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                      <p className="text-xs capitalize text-muted-foreground">Role: {role}</p>
                    </div>
                  </DropdownMenuLabel>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                {isSuperAdmin ? (
                  <DropdownMenuItem>
                    <Link href="/users" className="flex w-full items-center gap-2">
                      <ShieldUser className="size-4" />
                      Manage users
                    </Link>
                  </DropdownMenuItem>
                ) : null}
                <DropdownMenuItem variant="destructive" onClick={handleLogout}>
                  <LogOut className="size-4" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main>{children}</main>
      </div>
    </div>
  );
}
