"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

interface BackButtonProps {
  fallbackRoute?: string;
  label?: string;
  className?: string;
}

export function BackButton({
  fallbackRoute = "/dashboard",
  label = "Back",
  className,
}: BackButtonProps) {
  const router = useRouter();

  const handleBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }

    router.push(fallbackRoute);
  };

  return (
    <Button type="button" variant="outline" onClick={handleBack} className={className}>
      <ArrowLeft className="mr-2 size-4" />
      {label}
    </Button>
  );
}
