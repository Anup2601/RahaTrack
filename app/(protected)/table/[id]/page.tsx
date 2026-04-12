"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { Download, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/common/status-badge";
import { useAuth } from "@/components/providers/auth-provider";
import {
  getAnnexureContextByRowId,
  getAttachmentsByAnnexure,
  getLogRowsByParentRow,
  saveLogRowsByParentRow,
} from "@/lib/firestore";
import { AttachmentDoc, LogRow, WorkStatus } from "@/lib/types";

const statuses: WorkStatus[] = ["not started", "progress", "delay", "complete"];

const statusTone: Record<WorkStatus, string> = {
  "not started": "border-slate-300 bg-slate-100 text-slate-900",
  progress: "border-sky-300 bg-sky-100 text-sky-900",
  delay: "border-amber-300 bg-amber-100 text-amber-900",
  complete: "border-emerald-300 bg-emerald-100 text-emerald-900",
};

const getNow = () => {
  const now = new Date();
  return {
    date: now.toISOString().slice(0, 10),
    time: now.toTimeString().slice(0, 5),
  };
};

export default function TableLogPage() {
  const params = useParams<{ id: string }>();
  const parentRowId = params.id;
  const { user, loading: authLoading } = useAuth();

  const [rows, setRows] = useState<LogRow[]>([]);
  const [attachments, setAttachments] = useState<AttachmentDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<WorkStatus>("not started");
  const [remark, setRemark] = useState("");

  const username = useMemo(() => user?.displayName || user?.email || "Unknown user", [user]);

  useEffect(() => {
    const load = async () => {
      try {
        const [logData, annexureContext] = await Promise.all([
          getLogRowsByParentRow(parentRowId),
          getAnnexureContextByRowId(parentRowId),
        ]);

        setRows(logData);

        if (annexureContext?.annexureId) {
          const attachmentData = await getAttachmentsByAnnexure(annexureContext.annexureId);
          setAttachments(attachmentData);
        } else {
          setAttachments([]);
        }
      } catch {
        toast.error("Failed to load logs");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [parentRowId]);

  const persist = async (nextRows: LogRow[]) => {
    await saveLogRowsByParentRow(parentRowId, nextRows);
    setRows(nextRows);
  };

  const openAdd = () => {
    setStatus("not started");
    setRemark("");
    setOpen(true);
  };

  const saveLog = async () => {
    if (!remark.trim()) {
      toast.error("Remark is required");
      return;
    }

    const now = getNow();
    const nextRecord: LogRow = {
      id: crypto.randomUUID(),
      sNo: String(rows.length + 1),
      date: now.date,
      time: now.time,
      username,
      status,
      remark: remark.trim(),
    };

    const nextRows = [...rows, nextRecord];

    try {
      await persist(nextRows);
      toast.success("Comment added");
      setOpen(false);
    } catch {
      toast.error("Failed to save log");
    }
  };

  if (loading || authLoading) {
    return <p className="text-sm text-muted-foreground">Loading comments log...</p>;
  }

  return (
    <div className="space-y-6">
      <Card className="rounded-2xl border bg-white/90 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Comments Log</CardTitle>
          <Button onClick={openAdd}>
            <Plus className="mr-2 size-4" />
            Add Comment
          </Button>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table className="min-w-225">
              <TableHeader>
                <TableRow>
                  <TableHead>S No.</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead>Username</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Remark</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-14 text-center text-muted-foreground">
                      No comments added yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>{row.sNo}</TableCell>
                      <TableCell>{row.date}</TableCell>
                      <TableCell>{row.time}</TableCell>
                      <TableCell>{row.username}</TableCell>
                      <TableCell>
                        <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold capitalize ${statusTone[row.status]}`}>
                          {row.status}
                        </span>
                      </TableCell>
                      <TableCell>
                        <p className="max-w-90 wrap-break-word" title={row.remark || "-"}>
                          {row.remark || "-"}
                        </p>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border bg-white/90 shadow-sm">
        <CardHeader>
          <CardTitle>Attachment Table</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table className="min-w-180">
              <TableHeader>
                <TableRow>
                  <TableHead>S No.</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Download</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {attachments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="h-14 text-center text-muted-foreground">
                      No attachments found for this row.
                    </TableCell>
                  </TableRow>
                ) : (
                  attachments.map((item, index) => (
                    <TableRow key={item.id}>
                      <TableCell>{index + 1}</TableCell>
                      <TableCell>
                        <p className="max-w-75 truncate" title={item.name}>{item.name}</p>
                      </TableCell>
                      <TableCell>
                        <a
                          href={item.fileUrl}
                          download={item.name}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary transition hover:bg-primary/15"
                        >
                          <Download className="size-4" />
                          Download
                        </a>
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={item.status} />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="rounded-2xl sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Comment</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="rounded-xl border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
              S No., date, time and username are filled automatically when you save.
            </div>
            <div className="rounded-lg border px-3 py-2 text-sm">
              <span className="font-medium">Username:</span> {username}
            </div>
            <select
              className="h-9 w-full rounded-lg border border-input bg-transparent px-3 text-sm"
              value={status}
              onChange={(e) => setStatus(e.target.value as WorkStatus)}
            >
              {statuses.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
            <Input placeholder="Remark" value={remark} onChange={(e) => setRemark(e.target.value)} />
            <Button className="w-full" onClick={saveLog}>
              Save
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}