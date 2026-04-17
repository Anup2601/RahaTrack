"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, PenLine } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  ANNEXURE_STATUS_ITEMS,
  formatAnnexureStatusTitle,
  type AnnexureStatusDefinition,
} from "@/lib/annexure-status";
import { saveAnnexureStatusRecord, subscribeAnnexureStatusRecords } from "@/lib/firestore";
import { AnnexureStatusRecord } from "@/lib/types";

const clampPercent = (value: number) => Math.max(0, Math.min(100, value));

function StatusTable({
  mergedItems,
  loading,
  drafts,
  editing,
  savingId,
  onDraftChange,
  onEdit,
  onSave,
}: {
  mergedItems: Array<AnnexureStatusDefinition & { percentage: number; isSaved: boolean }>;
  loading: boolean;
  drafts: Record<string, string>;
  editing: Record<string, boolean>;
  savingId: string | null;
  onDraftChange: (id: string, value: string) => void;
  onEdit: (id: string) => void;
  onSave: (item: AnnexureStatusDefinition) => void;
}) {
  return (
    <Card className="rounded-[1.4rem] border border-black/10 bg-white shadow-[0_8px_20px_rgba(0,0,0,0.08)]">
      <CardHeader>
        <CardTitle>Annexure Status Table</CardTitle>
        <CardDescription>Update the completion percentage for every annexure entry.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table className="min-w-225">
            <TableHeader className="bg-[#8a8a8a]">
              <TableRow className="border-slate-300 hover:bg-[#8a8a8a]/20">
                <TableHead className="w-16 text-center text-white">S No.</TableHead>
                <TableHead className="w-[60%] text-white">Annexure</TableHead>
                <TableHead className="w-56 text-center text-white">Percentage</TableHead>
                <TableHead className="w-44 text-center text-white">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                    Loading annexure status rows...
                  </TableCell>
                </TableRow>
              ) : (
                mergedItems.map((item, index) => {
                  const rowEditing = editing[item.id] ?? !item.isSaved;

                  return (
                    <TableRow key={item.id} className="border-slate-200 odd:bg-slate-50/80 even:bg-white">
                      <TableCell className="text-center font-medium">{index + 1}</TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <p className="font-semibold text-[#202020]">{item.label}</p>
                          <p className="text-sm text-muted-foreground">{item.title}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          value={drafts[item.id] ?? String(item.percentage)}
                          onChange={(event) => onDraftChange(item.id, event.target.value)}
                          disabled={!rowEditing}
                          className="mx-auto max-w-36 text-center"
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        {rowEditing ? (
                          <Button disabled={savingId === item.id} onClick={() => onSave(item)}>
                            <Check className="mr-2 size-4" />
                            Save
                          </Button>
                        ) : (
                          <Button variant="outline" onClick={() => onEdit(item.id)}>
                            <PenLine className="mr-2 size-4" />
                            Edit
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AnnexureStatusPage() {
  const { isSuperAdmin, loading: authLoading } = useAuth();
  const [records, setRecords] = useState<AnnexureStatusRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<Record<string, boolean>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeAnnexureStatusRecords(
      (data) => {
        setRecords(data);
        setLoading(false);
      },
      () => {
        setLoading(false);
        toast.error("Unable to load annexure status data");
      },
    );

    return () => unsubscribe();
  }, []);

  const mergedItems = useMemo(() => {
    const recordById = new Map(records.map((record) => [record.id, record] as const));

    return ANNEXURE_STATUS_ITEMS.map((item) => {
      const saved = recordById.get(item.id);

      return {
        ...item,
        percentage: clampPercent(saved?.percentage ?? 0),
        isSaved: Boolean(saved),
      };
    });
  }, [records]);

  useEffect(() => {
    setDrafts((previous) => {
      const next = { ...previous };

      mergedItems.forEach((item) => {
        if (next[item.id] === undefined) {
          next[item.id] = String(item.percentage);
        }
      });

      return next;
    });

    setEditing((previous) => {
      const next = { ...previous };

      mergedItems.forEach((item) => {
        if (next[item.id] === undefined) {
          next[item.id] = !item.isSaved;
        }
      });

      return next;
    });
  }, [mergedItems]);

  const handleSave = async (item: AnnexureStatusDefinition) => {
    const rawValue = Number(drafts[item.id]);

    if (Number.isNaN(rawValue)) {
      toast.error("Enter a valid percentage");
      return;
    }

    const percentage = clampPercent(rawValue);
    setSavingId(item.id);

    try {
      await saveAnnexureStatusRecord(item.id, {
        name: formatAnnexureStatusTitle(item),
        percentage,
        order: item.order,
      });
      setDrafts((previous) => ({ ...previous, [item.id]: String(percentage) }));
      setEditing((previous) => ({ ...previous, [item.id]: false }));
      toast.success("Annexure status saved");
    } catch {
      toast.error("Unable to save annexure status");
    } finally {
      setSavingId(null);
    }
  };

  const currentItems = useMemo(() => {
    return mergedItems.map((item) => ({
      ...item,
      percentage: clampPercent(item.percentage),
    }));
  }, [mergedItems]);

  if (authLoading) {
    return <p className="text-sm text-muted-foreground">Loading user access...</p>;
  }

  if (!isSuperAdmin) {
    return (
      <section className="rounded-[1.6rem] border border-black/10 bg-white/90 p-5 shadow-[0_8px_20px_rgba(0,0,0,0.08)] backdrop-blur">
        <h2 className="text-xl font-semibold text-[#1f1f1f]">Access Restricted</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Annexure Status is visible only for superadmin users.
        </p>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[1.6rem] border border-black/10 bg-white/90 p-5 shadow-[0_8px_20px_rgba(0,0,0,0.08)] backdrop-blur">
        <h2 className="text-2xl font-semibold text-[#1f1f1f]">Annexure Status</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Track the percentage completion for each annexure and edit it whenever the status changes.
        </p>
      </section>

      <section>
        <StatusTable
          mergedItems={currentItems}
          loading={loading}
          drafts={drafts}
          editing={editing}
          savingId={savingId}
          onDraftChange={(id, value) => setDrafts((previous) => ({ ...previous, [id]: value }))}
          onEdit={(id) => setEditing((previous) => ({ ...previous, [id]: true }))}
          onSave={(item) => void handleSave(item)}
        />
      </section>
    </div>
  );
}