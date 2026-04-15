"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { Download, Plus } from "lucide-react";
import { toast } from "sonner";
import { TableColumnFilter, type ColumnFilterOption } from "@/components/common/table-column-filter";
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
import { AttachmentDoc, LogRow } from "@/lib/types";

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
  const { user, canComment, loading: authLoading } = useAuth();

  const [rows, setRows] = useState<LogRow[]>([]);
  const [attachments, setAttachments] = useState<AttachmentDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"comments" | "attachments">("comments");
  const [remark, setRemark] = useState("");
  const [commentFilters, setCommentFilters] = useState({
    date: null as string[] | null,
    time: null as string[] | null,
    username: null as string[] | null,
    remark: null as string[] | null,
  });
  const [attachmentFilters, setAttachmentFilters] = useState({
    name: null as string[] | null,
    status: null as string[] | null,
  });

  const username = useMemo(() => user?.displayName || user?.email || "Unknown user", [user]);

  const commentFilterOptions = useMemo(() => {
    const buildOptions = (values: string[]): ColumnFilterOption[] => {
      const counts = values.reduce<Record<string, number>>((acc, value) => {
        acc[value] = (acc[value] ?? 0) + 1;
        return acc;
      }, {});

      return Object.entries(counts)
        .map(([value, count]) => ({ value, count }))
        .sort((a, b) => a.value.localeCompare(b.value));
    };

    return {
      date: buildOptions(rows.map((row) => row.date || "-")),
      time: buildOptions(rows.map((row) => row.time || "-")),
      username: buildOptions(rows.map((row) => row.username || "-")),
      remark: buildOptions(rows.map((row) => row.remark || "-")),
    };
  }, [rows]);

  const filteredLogRows = useMemo(() => {
    return rows.filter((row) => {
      if (commentFilters.date && !commentFilters.date.includes(row.date || "-")) {
        return false;
      }

      if (commentFilters.time && !commentFilters.time.includes(row.time || "-")) {
        return false;
      }

      if (commentFilters.username && !commentFilters.username.includes(row.username || "-")) {
        return false;
      }

      if (commentFilters.remark && !commentFilters.remark.includes(row.remark || "-")) {
        return false;
      }

      return true;
    });
  }, [commentFilters, rows]);

  const attachmentFilterOptions = useMemo(() => {
    const buildOptions = (values: string[]): ColumnFilterOption[] => {
      const counts = values.reduce<Record<string, number>>((acc, value) => {
        acc[value] = (acc[value] ?? 0) + 1;
        return acc;
      }, {});

      return Object.entries(counts)
        .map(([value, count]) => ({ value, count }))
        .sort((a, b) => a.value.localeCompare(b.value));
    };

    return {
      name: buildOptions(attachments.map((item) => item.name || "-")),
      status: buildOptions(attachments.map((item) => item.status)),
    };
  }, [attachments]);

  const filteredAttachments = useMemo(() => {
    return attachments.filter((item) => {
      if (attachmentFilters.name && !attachmentFilters.name.includes(item.name || "-")) {
        return false;
      }

      if (attachmentFilters.status && !attachmentFilters.status.includes(item.status)) {
        return false;
      }

      return true;
    });
  }, [attachmentFilters, attachments]);

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
    if (!canComment) {
      toast.error("Only superadmin or analyst can add comments");
      return;
    }

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
      status: "not started",
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
        <CardHeader className="space-y-4">
          <div className="inline-flex w-full rounded-lg border bg-muted/40 p-1">
            <button
              type="button"
              onClick={() => setActiveTab("comments")}
              className={`rounded-md px-4 py-2 text-sm font-medium transition ${
                activeTab === "comments"
                  ? "bg-white text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Comments Log
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("attachments")}
              className={`rounded-md px-4 py-2 text-sm font-medium transition ${
                activeTab === "attachments"
                  ? "bg-white text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Attachment Table
            </button>
          </div>

          <div className="flex items-center justify-between">
            <CardTitle>{activeTab === "comments" ? "Comments Log" : "Attachment Table"}</CardTitle>
            {activeTab === "comments" && canComment ? (
              <Button onClick={openAdd}>
                <Plus className="mr-2 size-4" />
                Add Comment
              </Button>
            ) : null}
          </div>
        </CardHeader>
        <CardContent>
          {activeTab === "comments" ? (
            <div className="overflow-x-auto">
              <Table className="min-w-225">
                <TableHeader>
                  <TableRow>
                    <TableHead>S No.</TableHead>
                    <TableHead>
                      <div className="flex items-center justify-between gap-2">
                        <span>Date</span>
                        <TableColumnFilter
                          title="Date"
                          options={commentFilterOptions.date}
                          selectedValues={commentFilters.date}
                          onApply={(values) =>
                            setCommentFilters((previous) => ({ ...previous, date: values }))
                          }
                        />
                      </div>
                    </TableHead>
                    <TableHead>
                      <div className="flex items-center justify-between gap-2">
                        <span>Time</span>
                        <TableColumnFilter
                          title="Time"
                          options={commentFilterOptions.time}
                          selectedValues={commentFilters.time}
                          onApply={(values) =>
                            setCommentFilters((previous) => ({ ...previous, time: values }))
                          }
                        />
                      </div>
                    </TableHead>
                    <TableHead>
                      <div className="flex items-center justify-between gap-2">
                        <span>Username</span>
                        <TableColumnFilter
                          title="Username"
                          options={commentFilterOptions.username}
                          selectedValues={commentFilters.username}
                          onApply={(values) =>
                            setCommentFilters((previous) => ({ ...previous, username: values }))
                          }
                        />
                      </div>
                    </TableHead>
                    <TableHead>
                      <div className="flex items-center justify-between gap-2">
                        <span>Remark</span>
                        <TableColumnFilter
                          title="Remark"
                          options={commentFilterOptions.remark}
                          selectedValues={commentFilters.remark}
                          onApply={(values) =>
                            setCommentFilters((previous) => ({ ...previous, remark: values }))
                          }
                        />
                      </div>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLogRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="h-14 text-center text-muted-foreground">
                        No comments found for selected filters.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredLogRows.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell>{row.sNo}</TableCell>
                        <TableCell>{row.date}</TableCell>
                        <TableCell>{row.time}</TableCell>
                        <TableCell>{row.username}</TableCell>
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
          ) : (
            <div className="overflow-x-auto">
              <Table className="min-w-180">
                <TableHeader>
                  <TableRow>
                    <TableHead>S No.</TableHead>
                    <TableHead>
                      <div className="flex items-center justify-between gap-2">
                        <span>Name</span>
                        <TableColumnFilter
                          title="Attachment Name"
                          options={attachmentFilterOptions.name}
                          selectedValues={attachmentFilters.name}
                          onApply={(values) =>
                            setAttachmentFilters((previous) => ({ ...previous, name: values }))
                          }
                        />
                      </div>
                    </TableHead>
                    <TableHead>Download</TableHead>
                    <TableHead>
                      <div className="flex items-center justify-between gap-2">
                        <span>Status</span>
                        <TableColumnFilter
                          title="Attachment Status"
                          options={attachmentFilterOptions.status}
                          selectedValues={attachmentFilters.status}
                          onApply={(values) =>
                            setAttachmentFilters((previous) => ({ ...previous, status: values }))
                          }
                        />
                      </div>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAttachments.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="h-14 text-center text-muted-foreground">
                        No attachments found for selected filters.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredAttachments.map((item, index) => (
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
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="rounded-2xl sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Comment</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="rounded-lg border px-3 py-2 text-sm">
              <span className="font-medium">Username:</span> {username}
            </div>
           <textarea
  placeholder="Remark"
  value={remark}
  onChange={(e) => setRemark(e.target.value)}
  className="w-full h-28 resize-none rounded-lg border border-gray-300 p-3 text-sm outline-none focus:ring-2 focus:ring-black"
/>
            <Button className="w-full" onClick={saveLog}>
              Save
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}