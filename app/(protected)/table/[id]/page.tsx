"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { Download, Eye, Pencil, Plus, Trash2 } from "lucide-react";
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
import { useAuth } from "@/components/providers/auth-provider";
import {
  createAttachment,
  deleteAttachment,
  getAnnexureContextByRowId,
  getAttachmentsByAnnexure,
  getLogRowsByParentRow,
  saveLogRowsByParentRow,
  updateAttachment,
} from "@/lib/firestore";
import { storage } from "@/lib/firebase";
import { AttachmentDoc, LogRow } from "@/lib/types";

const getNow = () => {
  const now = new Date();
  return {
    date: now.toISOString().slice(0, 10),
    time: now.toTimeString().slice(0, 5),
  };
};

const getStorageUploadErrorMessage = (error: unknown) => {
  if (!error || typeof error !== "object" || !("code" in error)) {
    return "Upload failed. Check Firebase Storage setup and bucket name.";
  }

  const code = String((error as { code?: string }).code ?? "");

  if (code.includes("storage/unauthorized")) {
    return "Upload blocked by Firebase Storage Rules. Allow authenticated write access.";
  }

  if (code.includes("storage/bucket-not-found")) {
    return "Storage bucket not found. Check NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET in .env and Firebase project settings.";
  }

  if (code.includes("storage/invalid-argument")) {
    return "Invalid storage configuration. Check your Firebase env values and restart the app.";
  }

  return `Upload failed (${code || "unknown"}). Check Firebase Storage configuration.`;
};

export default function TableLogPage() {
  const params = useParams<{ id: string }>();
  const parentRowId = params.id;
  const { user, canComment, isSuperAdmin, loading: authLoading } = useAuth();

  const [rows, setRows] = useState<LogRow[]>([]);
  const [attachments, setAttachments] = useState<AttachmentDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [addAttachmentOpen, setAddAttachmentOpen] = useState(false);
  const [editAttachmentOpen, setEditAttachmentOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"comments" | "attachments">("comments");
  const [remark, setRemark] = useState("");
  const [attachmentAnnexureId, setAttachmentAnnexureId] = useState<string | null>(null);
  const [rowAttachmentNames, setRowAttachmentNames] = useState<string[]>([]);
  const [attachmentName, setAttachmentName] = useState("");
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [editingAttachment, setEditingAttachment] = useState<AttachmentDoc | null>(null);
  const [attachmentSaving, setAttachmentSaving] = useState(false);
  const [commentFilters, setCommentFilters] = useState({
    date: null as string[] | null,
    time: null as string[] | null,
    username: null as string[] | null,
    remark: null as string[] | null,
  });
  const [attachmentFilters, setAttachmentFilters] = useState({
    name: null as string[] | null,
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

  const scopedAttachments = useMemo(() => {
    if (rowAttachmentNames.length === 0) {
      return attachments;
    }

    const allowed = new Set(
      rowAttachmentNames.map((name) => name.trim().toLowerCase()).filter(Boolean),
    );

    return attachments.filter((item) => allowed.has(item.name.trim().toLowerCase()));
  }, [attachments, rowAttachmentNames]);

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
      name: buildOptions(scopedAttachments.map((item) => item.name || "-")),
    };
  }, [scopedAttachments]);

  const filteredAttachments = useMemo(() => {
    return scopedAttachments.filter((item) => {
      if (attachmentFilters.name && !attachmentFilters.name.includes(item.name || "-")) {
        return false;
      }

      return true;
    });
  }, [attachmentFilters, scopedAttachments]);

  useEffect(() => {
    const load = async () => {
      try {
        const [logData, annexureContext] = await Promise.all([
          getLogRowsByParentRow(parentRowId),
          getAnnexureContextByRowId(parentRowId),
        ]);

        setRows(logData);

        if (annexureContext?.annexureId) {
          setAttachmentAnnexureId(annexureContext.annexureId);
          setRowAttachmentNames(annexureContext.attachmentNames ?? []);
          const attachmentData = await getAttachmentsByAnnexure(annexureContext.annexureId);
          setAttachments(attachmentData);
        } else {
          setAttachmentAnnexureId(null);
          setRowAttachmentNames([]);
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

  const refreshAttachments = async (annexureId: string) => {
    const attachmentData = await getAttachmentsByAnnexure(annexureId);
    setAttachments(attachmentData);
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

  const openAddAttachment = () => {
    if (!isSuperAdmin) {
      toast.error("Only superadmin can add attachments");
      return;
    }

    if (!attachmentAnnexureId) {
      toast.error("Annexure context not found for this row");
      return;
    }

    setAttachmentName("");
    setAttachmentFile(null);
    setAddAttachmentOpen(true);
  };

  const openEditAttachment = (item: AttachmentDoc) => {
    if (!isSuperAdmin) {
      toast.error("Only superadmin can update attachments");
      return;
    }

    setEditingAttachment(item);
    setAttachmentName(item.name);
    setEditAttachmentOpen(true);
  };

  const handleCreateAttachment = async () => {
    if (!attachmentAnnexureId) {
      toast.error("Annexure context not found for this row");
      return;
    }

    if (!attachmentFile) {
      toast.error("Please select a file");
      return;
    }

    const finalName = attachmentName.trim() || attachmentFile.name;

    setAttachmentSaving(true);
    try {
      const filePath = `annexures/${attachmentAnnexureId}/attachments/${Date.now()}-${attachmentFile.name}`;
      const storageRef = ref(storage, filePath);
      await uploadBytes(storageRef, attachmentFile);
      const fileUrl = await getDownloadURL(storageRef);

      await createAttachment({
        annexureId: attachmentAnnexureId,
        name: finalName,
        fileUrl,
        filePath,
      });

      setRowAttachmentNames((previous) => {
        const normalizedName = finalName.trim().toLowerCase();
        const hasName = previous.some((name) => name.trim().toLowerCase() === normalizedName);
        return hasName ? previous : [...previous, finalName];
      });

      await refreshAttachments(attachmentAnnexureId);
      toast.success("Attachment added");
      setAddAttachmentOpen(false);
      setAttachmentName("");
      setAttachmentFile(null);
    } catch (error) {
      console.error("Attachment upload failed:", error);
      toast.error(getStorageUploadErrorMessage(error));
    } finally {
      setAttachmentSaving(false);
    }
  };

  const handleUpdateAttachment = async () => {
    if (!editingAttachment) {
      toast.error("Attachment not found");
      return;
    }

    if (!attachmentName.trim()) {
      toast.error("Attachment name is required");
      return;
    }

    setAttachmentSaving(true);
    try {
      await updateAttachment(editingAttachment.id, attachmentName.trim());

      if (attachmentAnnexureId) {
        await refreshAttachments(attachmentAnnexureId);
      }

      toast.success("Attachment updated");
      setEditAttachmentOpen(false);
      setEditingAttachment(null);
      setAttachmentName("");
    } catch {
      toast.error("Failed to update attachment");
    } finally {
      setAttachmentSaving(false);
    }
  };

  const handleDeleteAttachment = async (item: AttachmentDoc) => {
    if (!isSuperAdmin) {
      toast.error("Only superadmin can delete attachments");
      return;
    }

    const confirmed = toast(`Delete attachment \"${item.name}\"?`);
    if (!confirmed) {
      return;
    }

    try {
      await deleteAttachment(item.id);

      if (attachmentAnnexureId) {
        await refreshAttachments(attachmentAnnexureId);
      }

      toast.success("Attachment deleted");
    } catch {
      toast.error("Failed to delete attachment");
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
            ) : activeTab === "attachments" && isSuperAdmin ? (
              <Button onClick={openAddAttachment}>
                <Plus className="mr-2 size-4" />
                Add Attachment
              </Button>
            ) : null}
          </div>
        </CardHeader>
        <CardContent>
          {activeTab === "comments" ? (
            <div className="overflow-x-auto">
              <Table className="min-w-225">
                <TableHeader>
                  <TableRow className="bg-[#8a8a8a] border-slate-300 hover:bg-[#8a8a8a]/20">
                    <TableHead className="w-12">S No.</TableHead>
                    <TableHead className="w-28">
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
                    <TableHead className="w-32">
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
                    <TableHead className="w-42">
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
                          <p className="mx-auto max-w-176 text-left  whitespace-normal wrap-break-word leading-6" title={row.remark || "-"}>
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
                <TableHeader className="bg-[#8a8a8a]">
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
                    <TableHead className="text-center">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAttachments.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="h-14 text-center text-muted-foreground">
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
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              title="View"
                              aria-label={`View ${item.name}`}
                              onClick={() => window.open(item.fileUrl, "_blank", "noopener,noreferrer")}
                            >
                              <Eye className="size-4" />
                            </Button>
                            {isSuperAdmin ? (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-sm"
                                title="Delete"
                                aria-label={`Delete ${item.name}`}
                                onClick={() => handleDeleteAttachment(item)}
                              >
                                <Trash2 className="size-4" />
                              </Button>
                            ) : null}
                            {/* <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              title="Update"
                              aria-label={`Update ${item.name}`}
                              onClick={() => openEditAttachment(item)}
                            >
                              <Pencil className="size-4" />
                            </Button> */}
                            <a
                              href={item.fileUrl}
                              download={item.name}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex"
                              title="Download"
                              aria-label={`Download ${item.name}`}
                            >
                              <Button type="button" variant="ghost" size="icon-sm">
                                <Download className="size-4" />
                              </Button>
                            </a>
                          </div>
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

      <Dialog open={addAttachmentOpen} onOpenChange={setAddAttachmentOpen}>
        <DialogContent className="rounded-2xl sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Attachment</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              placeholder="Attachment name (optional)"
              value={attachmentName}
              onChange={(e) => setAttachmentName(e.target.value)}
            />
            <Input
              type="file"
              onChange={(e) => setAttachmentFile(e.target.files?.[0] ?? null)}
            />
            <Button className="w-full" onClick={handleCreateAttachment} disabled={attachmentSaving}>
              {attachmentSaving ? "Saving..." : "Save"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={editAttachmentOpen}
        onOpenChange={(next) => {
          setEditAttachmentOpen(next);
          if (!next) {
            setEditingAttachment(null);
            setAttachmentName("");
          }
        }}
      >
        <DialogContent className="rounded-2xl sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Update Attachment</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              placeholder="Attachment name"
              value={attachmentName}
              onChange={(e) => setAttachmentName(e.target.value)}
            />
            <Button className="w-full" onClick={handleUpdateAttachment} disabled={attachmentSaving}>
              {attachmentSaving ? "Updating..." : "Update"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}