"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, PenLine } from "lucide-react";
import { toast } from "sonner";
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
import { PolarAngleAxis, RadialBar, RadialBarChart, ResponsiveContainer } from "recharts";

const clampPercent = (value: number) => Math.max(0, Math.min(100, value));

const toPercentLabel = (value: number) => `${Math.round(clampPercent(value))}%`;

function GaugeCard({ item }: { item: AnnexureStatusDefinition & { percentage: number } }) {
  const percent = clampPercent(item.percentage);

  return (
    <div className="rounded-[1.4rem] border border-black/10 bg-white p-4 shadow-[0_8px_20px_rgba(0,0,0,0.08)]">
      <div className="mx-auto mb-2 h-40 w-full max-w-60">
        <ResponsiveContainer>
          <RadialBarChart
            data={[{ name: item.label, value: percent }]}
            innerRadius="72%"
            outerRadius="98%"
            startAngle={180}
            endAngle={0}
            cy="88%"
          >
            <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
            <RadialBar dataKey="value" background={{ fill: "#d7d7d7" }} cornerRadius={10} fill="#ffd200" />
          </RadialBarChart>
        </ResponsiveContainer>
      </div>
      <p className="text-center text-xs uppercase tracking-[0.2em] text-muted-foreground">{item.label}</p>
      <p className="mt-1 text-center text-sm font-semibold text-[#202020]">{item.title}</p>
      <p className="mt-2 text-center text-3xl font-black text-[#1f1f1f]">{toPercentLabel(percent)}</p>
    </div>
  );
}

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
  const [activeView, setActiveView] = useState<"dashboard" | "comment-log" | "attachment">("dashboard");
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

  const currentItems = useMemo(
    () =>
      mergedItems.map((item) => ({
        ...item,
        percentage: clampPercent(item.percentage),
      })),
    [mergedItems],
  );

  return (
    <div className="space-y-6">
      <section className="rounded-[1.6rem] border border-black/10 bg-white/90 p-5 shadow-[0_8px_20px_rgba(0,0,0,0.08)] backdrop-blur">
        <h2 className="text-2xl font-semibold text-[#1f1f1f]">Annexure Status</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Track the percentage completion for each annexure and edit it whenever the status changes.
        </p>
      </section>

      {/* <div className="flex flex-wrap gap-2">
        <Button variant={activeView === "dashboard" ? "default" : "outline"} onClick={() => setActiveView("dashboard")}>Dashboard</Button>
        <Button variant={activeView === "comment-log" ? "default" : "outline"} onClick={() => setActiveView("comment-log")}>Comment Log</Button>
        <Button variant={activeView === "attachment" ? "default" : "outline"} onClick={() => setActiveView("attachment")}>Attachment</Button>
      </div> */}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {currentItems.map((item) => (
          <GaugeCard key={item.id} item={item} />
        ))}
      </section>

      {activeView === "dashboard" ? (
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
      ) : null}

      {activeView === "comment-log" ? (
        <section className="space-y-4">
          <Card className="rounded-[1.4rem] border border-black/10 bg-white shadow-[0_8px_20px_rgba(0,0,0,0.08)]">
            <CardHeader>
              <CardTitle>Comment Log View</CardTitle>
              <CardDescription>This tab uses the same annexure status data in a compact table layout.</CardDescription>
            </CardHeader>
            <CardContent>
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
            </CardContent>
          </Card>
        </section>
      ) : null}

      {activeView === "attachment" ? (
        <section className="space-y-4">
          <Card className="rounded-[1.4rem] border border-black/10 bg-white shadow-[0_8px_20px_rgba(0,0,0,0.08)]">
            <CardHeader>
              <CardTitle>Attachment View</CardTitle>
              <CardDescription>The same percentage controls remain available here for quick switching.</CardDescription>
            </CardHeader>
            <CardContent>
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
            </CardContent>
          </Card>
        </section>
      ) : null}
    </div>
  );
}