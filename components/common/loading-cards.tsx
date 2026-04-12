import { Skeleton } from "@/components/ui/skeleton";

export function LoadingCards({ count = 6 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="rounded-2xl border bg-white/80 p-5 shadow-sm backdrop-blur">
          <Skeleton className="mb-3 h-4 w-24" />
          <Skeleton className="mb-6 h-6 w-40" />
          <div className="flex gap-2">
            <Skeleton className="h-9 w-20" />
            <Skeleton className="h-9 w-24" />
          </div>
        </div>
      ))}
    </div>
  );
}
