import { Badge } from "@/components/ui/badge";
import { EntityStatus } from "@/lib/types";

const statusStyles: Record<EntityStatus, string> = {
  active: "border-emerald-300 bg-emerald-100 text-emerald-900 shadow-sm shadow-emerald-200/60",
  disabled: "border-rose-300 bg-rose-100 text-rose-900 shadow-sm shadow-rose-200/60",
  pending: "border-amber-300 bg-amber-100 text-amber-900 shadow-sm shadow-amber-200/60",
};

export function StatusBadge({ status }: { status: EntityStatus }) {
  return (
    <Badge className={`capitalize border ${statusStyles[status]}`} variant="outline">
      {status}
    </Badge>
  );
}
