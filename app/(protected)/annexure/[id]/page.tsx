"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { Download, FileSpreadsheet, Plus, Users } from "lucide-react";
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
import { storage } from "@/lib/firebase";
import {
  createAttachment,
  createContact,
  getAnnexureById,
  getAnnexureStatusRows,
  saveAnnexureStatusRows,
  subscribeAttachmentsByAnnexure,
  subscribeContactsByAnnexure,
  updateAttachment,
  updateAttachmentStatus,
  updateContact,
  updateContactStatus,
} from "@/lib/firestore";
import {
  AnnexureRowStatus,
  Annexure,
  AnnexureTableRow,
  AttachmentDoc,
  ContactDoc,
} from "@/lib/types";

const statusTone: Record<AnnexureRowStatus, string> = {
  pending: "border-amber-300 bg-amber-100 text-amber-900",
  "under review": "border-sky-300 bg-sky-100 text-sky-900",
  completed: "border-emerald-300 bg-emerald-100 text-emerald-900",
};

const chipClass =
  "inline-flex max-w-full items-center rounded-full border px-3 py-1 text-xs font-semibold shadow-sm";

const parseMultiValue = (value: string) =>
  value
    .split(/[,\n]/)
    .map((item) => item.trim())
    .filter(Boolean);

const createList = (value: string) => {
  const items = parseMultiValue(value);
  return items.length > 0 ? items : [""];
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

export default function AnnexurePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const annexureId = params.id;

  const [annexure, setAnnexure] = useState<Annexure | null>(null);
  const [attachments, setAttachments] = useState<AttachmentDoc[]>([]);
  const [contacts, setContacts] = useState<ContactDoc[]>([]);
  const [rows, setRows] = useState<AnnexureTableRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [attachmentListOpen, setAttachmentListOpen] = useState(false);
  const [contactListOpen, setContactListOpen] = useState(false);

  const [attachmentModalOpen, setAttachmentModalOpen] = useState(false);
  const [attachmentName, setAttachmentName] = useState("");
  const [attachmentFiles, setAttachmentFiles] = useState<File[]>([]);
  const [editingAttachment, setEditingAttachment] = useState<AttachmentDoc | null>(null);

  const [contactModalOpen, setContactModalOpen] = useState(false);
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [editingContact, setEditingContact] = useState<ContactDoc | null>(null);

  const [rowModalOpen, setRowModalOpen] = useState(false);
  const [editingRow, setEditingRow] = useState<AnnexureTableRow | null>(null);
  const [requirements, setRequirements] = useState("");
  const [rowCurrentStatus, setRowCurrentStatus] = useState<AnnexureRowStatus>("pending");
  const [rowLatestRemark, setRowLatestRemark] = useState("");
  const [rowAttachments, setRowAttachments] = useState<string[]>([]);
  const [rowAttachmentFiles, setRowAttachmentFiles] = useState<File[]>([]);
  const [concernedTeamMembers, setConcernedTeamMembers] = useState<string[]>([""]);

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        const [annexureData, tableRows] = await Promise.all([
          getAnnexureById(annexureId),
          getAnnexureStatusRows(annexureId),
        ]);

        if (!active) {
          return;
        }

        setAnnexure(annexureData);
        setRows(tableRows);
      } catch {
        toast.error("Failed to load annexure details");
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    load();

    const unsubscribeAttachments = subscribeAttachmentsByAnnexure(
      annexureId,
      setAttachments,
      () => toast.error("Unable to load attachment list"),
    );

    const unsubscribeContacts = subscribeContactsByAnnexure(
      annexureId,
      setContacts,
      () => toast.error("Unable to load contact list"),
    );

    return () => {
      active = false;
      unsubscribeAttachments();
      unsubscribeContacts();
    };
  }, [annexureId]);

  const attachmentLabel = useMemo(() => {
    if (attachmentFiles.length === 0) {
      return "Select Excel file";
    }

    if (attachmentFiles.length === 1) {
      return attachmentFiles[0].name;
    }

    return `${attachmentFiles.length} files selected`;
  }, [attachmentFiles]);

  const persistRows = async (nextRows: AnnexureTableRow[]) => {
    await saveAnnexureStatusRows(annexureId, nextRows);
    setRows(nextRows);
  };

  const uploadAttachmentFiles = async (files: File[]) => {
    const hasInvalidFile = files.some(
      (file) =>
        !file.name.toLowerCase().endsWith(".xlsx") &&
        !file.name.toLowerCase().endsWith(".xls") &&
        !file.name.toLowerCase().endsWith(".csv"),
    );

    if (hasInvalidFile) {
      throw new Error("invalid-file");
    }

    const uploadedNames = await Promise.all(
      files.map(async (file) => {
        const filePath = `annexures/${annexureId}/attachments/${Date.now()}-${file.name}`;
        const storageRef = ref(storage, filePath);
        await uploadBytes(storageRef, file);
        const fileUrl = await getDownloadURL(storageRef);

        await createAttachment({
          annexureId,
          name: file.name,
          fileUrl,
          filePath,
        });

        return file.name;
      }),
    );

    return uploadedNames;
  };

  const handleCreateAttachment = async () => {
    if (attachmentFiles.length === 0) {
      toast.error("Please select an Excel file");
      return;
    }

    try {
      await uploadAttachmentFiles(attachmentFiles);

      toast.success(`${attachmentFiles.length} attachment(s) uploaded and saved`);
      setAttachmentModalOpen(false);
      setAttachmentName("");
      setAttachmentFiles([]);
    } catch (error) {
      if (error instanceof Error && error.message === "invalid-file") {
        toast.error("Upload only .xlsx, .xls or .csv files");
        return;
      }
      console.error("Attachment upload failed:", error);
      toast.error(getStorageUploadErrorMessage(error));
    }
  };

  const handleUpdateAttachment = async () => {
    if (!editingAttachment || !attachmentName.trim()) {
      toast.error("Attachment name is required");
      return;
    }

    try {
      await updateAttachment(editingAttachment.id, attachmentName.trim());
      toast.success("Attachment updated");
      setEditingAttachment(null);
      setAttachmentName("");
    } catch {
      toast.error("Failed to update attachment");
    }
  };

  const handleCreateContact = async () => {
    if (!contactName.trim() || !contactEmail.trim() || !contactNumber.trim()) {
      toast.error("Name, email and number are required");
      return;
    }

    try {
      await createContact({
        annexureId,
        name: contactName.trim(),
        email: contactEmail.trim(),
        number: contactNumber.trim(),
      });

      toast.success("Contact added");
      setContactModalOpen(false);
      setContactName("");
      setContactEmail("");
      setContactNumber("");
    } catch {
      toast.error("Failed to add contact");
    }
  };

  const handleUpdateContact = async () => {
    if (!editingContact || !contactName.trim() || !contactEmail.trim() || !contactNumber.trim()) {
      toast.error("Name, email and number are required");
      return;
    }

    try {
      await updateContact(editingContact.id, {
        name: contactName.trim(),
        email: contactEmail.trim(),
        number: contactNumber.trim(),
      });

      toast.success("Contact updated");
      setEditingContact(null);
      setContactName("");
      setContactEmail("");
      setContactNumber("");
    } catch {
      toast.error("Failed to update contact");
    }
  };

  const handleAddMainRow = async () => {
    if (!requirements.trim()) {
      toast.error("Requirements are required");
      return;
    }

    let uploadedFileNames: string[] = [];

    try {
      if (rowAttachmentFiles.length > 0) {
        uploadedFileNames = await uploadAttachmentFiles(rowAttachmentFiles);
      }
    } catch (error) {
      if (error instanceof Error && error.message === "invalid-file") {
        toast.error("Upload only .xlsx, .xls or .csv files");
        return;
      }
      console.error("Row attachment upload failed:", error);
      toast.error(getStorageUploadErrorMessage(error));
      return;
    }

    const cleanedAttachments = Array.from(
      new Set([...rowAttachments.map((item) => item.trim()).filter(Boolean), ...uploadedFileNames]),
    );
    const cleanedMembers = concernedTeamMembers.map((item) => item.trim()).filter(Boolean);

    const updatedRow: AnnexureTableRow = {
      id: editingRow?.id ?? crypto.randomUUID(),
      requirements: requirements.trim(),
      attachment: cleanedAttachments.join(", "),
      concernedTeamMembers: cleanedMembers.join(", "),
      currentStatus: rowCurrentStatus,
      latestRemark: rowLatestRemark.trim(),
      status: editingRow?.status ?? "active",
    };

    const nextRows: AnnexureTableRow[] = editingRow
      ? rows.map((row) => (row.id === editingRow.id ? updatedRow : row))
      : [...rows, updatedRow];

    try {
      await persistRows(nextRows);
      setRequirements("");
      setRowAttachments([]);
      setRowAttachmentFiles([]);
      setConcernedTeamMembers([""]);
      setEditingRow(null);
      setRowModalOpen(false);
      toast.success(editingRow ? "Row updated" : "Row added");
    } catch {
      toast.error(editingRow ? "Failed to update row" : "Failed to add row");
    }
  };

  const openRowEditor = (row?: AnnexureTableRow) => {
    if (row) {
      setEditingRow(row);
      setRequirements(row.requirements);
      setRowCurrentStatus(row.currentStatus);
      setRowLatestRemark(row.latestRemark);
      setRowAttachments(createList(row.attachment));
      setRowAttachmentFiles([]);
      setConcernedTeamMembers(createList(row.concernedTeamMembers));
    } else {
      setEditingRow(null);
      setRequirements("");
      setRowCurrentStatus("pending");
      setRowLatestRemark("");
      setRowAttachments([]);
      setRowAttachmentFiles([]);
      setConcernedTeamMembers([""]);
    }

    setRowModalOpen(true);
  };

  const openLogTable = (row: AnnexureTableRow) => {
    router.push(`/table/${row.id}`);
  };

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading annexure details...</p>;
  }

  if (!annexure) {
    return <p className="text-sm text-red-600">Annexure not found.</p>;
  }

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-white/85 p-5 shadow-sm backdrop-blur">
        <div>
          <h2 className="text-2xl font-semibold">{annexure.name}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Annexure tracking table with requirement, attachment and comment log access.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={annexure.status} />

        </div>
      </section>

      <Card className="overflow-hidden rounded-2xl border border-slate-300 bg-white shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Annexure Table</CardTitle>
          <Button onClick={() => openRowEditor()}>
            <Plus className="mr-2 size-4" />
            Add Row
          </Button>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table className="min-w-280 table-fixed">
              <TableHeader className="bg-slate-200">
                <TableRow className="border-slate-300 hover:bg-slate-200">
                  <TableHead className="w-16 text-center text-slate-900">S No.</TableHead>
                  <TableHead className="w-[30rem] text-center text-slate-900">Requirements</TableHead>
                  <TableHead className="w-44 text-center text-slate-900">Current Status</TableHead>
                  <TableHead className="w-64 text-center text-slate-900">Attachment</TableHead>
                  <TableHead className="w-72 text-center text-slate-900">Concerned Team Member(s)</TableHead>
                  <TableHead className="w-[44rem] text-center text-slate-900">Latest Remark</TableHead>
                  <TableHead className="w-28 text-center text-slate-900">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-14 text-center text-muted-foreground">
                      No rows in annexure table.
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((row, index) => (
                    <TableRow
                      key={row.id}
                      className="cursor-pointer border-slate-200 odd:bg-slate-50/80 even:bg-white hover:bg-slate-100"
                      onClick={() => openLogTable(row)}
                    >
                      <TableCell className="text-center align-middle font-medium">{index + 1}</TableCell>
                      <TableCell className="text-center align-middle">
                        <p className="mx-auto max-w-[30rem] whitespace-normal wrap-break-word leading-6" title={row.requirements}>
                          {row.requirements}
                        </p>
                      </TableCell>
                      <TableCell className="text-center align-middle">
                        <span className={`${chipClass} ${statusTone[row.currentStatus]} justify-center`}>
                          {row.currentStatus}
                        </span>
                      </TableCell>
                      <TableCell className="text-center align-middle">
                        <div className="flex flex-wrap justify-center gap-2">
                          {parseMultiValue(row.attachment).length === 0 ? (
                            <span className="text-xs text-muted-foreground">-</span>
                          ) : (
                            parseMultiValue(row.attachment).map((item) => (
                              <span
                                key={`${row.id}-${item}`}
                                className="inline-flex max-w-52 truncate rounded-full border border-sky-300 bg-sky-100 px-2.5 py-1 text-xs font-semibold text-sky-900"
                                title={item}
                              >
                                {item}
                              </span>
                            ))
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-center align-middle">
                        <div className="flex flex-wrap justify-center gap-2">
                          {parseMultiValue(row.concernedTeamMembers).length === 0 ? (
                            <span className="text-xs text-muted-foreground">-</span>
                          ) : (
                            parseMultiValue(row.concernedTeamMembers).map((item) => (
                              <span
                                key={`${row.id}-member-${item}`}
                                className="inline-flex max-w-60 truncate rounded-full border border-fuchsia-300 bg-fuchsia-100 px-2.5 py-1 text-xs font-semibold text-fuchsia-900"
                                title={item}
                              >
                                {item}
                              </span>
                            ))
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-center align-middle">
                        <p className="mx-auto max-w-[44rem] whitespace-normal wrap-break-word leading-6" title={row.latestRemark || "-"}>
                          {row.latestRemark || "-"}
                        </p>
                      </TableCell>
                      <TableCell className="text-center align-middle">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(event) => {
                            event.stopPropagation();
                            openRowEditor(row);
                          }}
                        >
                          Update
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={attachmentListOpen} onOpenChange={setAttachmentListOpen}>
        <DialogContent className="w-[95vw] max-w-5xl rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>List of Attachment</span>
              <Button onClick={() => setAttachmentModalOpen(true)}>
                <Plus className="mr-2 size-4" />
                Upload Excel
              </Button>
            </DialogTitle>
          </DialogHeader>
          <div className="overflow-x-auto">
            <Table className="min-w-180">
              <TableHeader>
                <TableRow>
                  <TableHead>S No.</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Download</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {attachments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-14 text-center text-muted-foreground">
                      No attachments uploaded yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  attachments.map((item, index) => (
                    <TableRow key={item.id}>
                      <TableCell>{index + 1}</TableCell>
                      <TableCell>
                        <p className="max-w-55 truncate" title={item.name}>
                          {item.name}
                        </p>
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
                      <TableCell className="text-right">
                        <div className="inline-flex items-center gap-1">
                          <Button
                            size="icon-sm"
                            variant="outline"
                            title="Update"
                            aria-label="Update"
                            onClick={() => {
                              setEditingAttachment(item);
                              setAttachmentName(item.name);
                            }}
                          >
                            Update
                          </Button>
                          <Button
                            size="icon-sm"
                            variant="outline"
                            title={item.status === "disabled" ? "Enable" : "Disable"}
                            aria-label={item.status === "disabled" ? "Enable" : "Disable"}
                            onClick={() =>
                              updateAttachmentStatus(
                                item.id,
                                item.status === "disabled" ? "active" : "disabled",
                              )
                            }
                          >
                            {item.status === "disabled" ? "Enable" : "Disable"}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={contactListOpen} onOpenChange={setContactListOpen}>
        <DialogContent className="w-[95vw] max-w-5xl rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>List of Contact in Attachment</span>
              <Button onClick={() => setContactModalOpen(true)}>
                <Plus className="mr-2 size-4" />
                Add Contact
              </Button>
            </DialogTitle>
          </DialogHeader>
          <div className="overflow-x-auto">
            <Table className="min-w-190">
              <TableHeader>
                <TableRow>
                  <TableHead>S No.</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Mail</TableHead>
                  <TableHead>Number</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contacts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-14 text-center text-muted-foreground">
                      No contacts added yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  contacts.map((item, index) => (
                    <TableRow key={item.id}>
                      <TableCell>{index + 1}</TableCell>
                      <TableCell>
                        <p className="max-w-45 truncate" title={item.name}>
                          {item.name}
                        </p>
                      </TableCell>
                      <TableCell>
                        <p className="max-w-55 truncate" title={item.email}>
                          {item.email}
                        </p>
                      </TableCell>
                      <TableCell>{item.number}</TableCell>
                      <TableCell>
                        <StatusBadge status={item.status} />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="inline-flex items-center gap-1">
                          <Button
                            size="icon-sm"
                            variant="outline"
                            title="Update"
                            aria-label="Update"
                            onClick={() => {
                              setEditingContact(item);
                              setContactName(item.name);
                              setContactEmail(item.email);
                              setContactNumber(item.number);
                            }}
                          >
                            Update
                          </Button>
                          <Button
                            size="icon-sm"
                            variant="outline"
                            title={item.status === "disabled" ? "Enable" : "Disable"}
                            aria-label={item.status === "disabled" ? "Enable" : "Disable"}
                            onClick={() =>
                              updateContactStatus(
                                item.id,
                                item.status === "disabled" ? "active" : "disabled",
                              )
                            }
                          >
                            {item.status === "disabled" ? "Enable" : "Disable"}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={attachmentModalOpen} onOpenChange={setAttachmentModalOpen}>
        <DialogContent className="rounded-2xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Upload Excel Attachment</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              type="file"
              accept=".xlsx,.xls,.csv"
              multiple
              onChange={(e) => setAttachmentFiles(Array.from(e.target.files ?? []))}
            />
            <p className="text-xs text-muted-foreground">{attachmentLabel}</p>
            <Button onClick={handleCreateAttachment} className="w-full">
              Upload and Save All
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(editingAttachment)} onOpenChange={(open) => !open && setEditingAttachment(null)}>
        <DialogContent className="rounded-2xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Update Attachment</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              placeholder="Attachment name"
              value={attachmentName}
              onChange={(e) => setAttachmentName(e.target.value)}
            />
            <Button onClick={handleUpdateAttachment} className="w-full">
              Save
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={contactModalOpen} onOpenChange={setContactModalOpen}>
        <DialogContent className="rounded-2xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Contact</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Name" value={contactName} onChange={(e) => setContactName(e.target.value)} />
            <Input placeholder="Mail" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} />
            <Input placeholder="Number" value={contactNumber} onChange={(e) => setContactNumber(e.target.value)} />
            <Button onClick={handleCreateContact} className="w-full">
              Add
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(editingContact)} onOpenChange={(open) => !open && setEditingContact(null)}>
        <DialogContent className="rounded-2xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Update Contact</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Name" value={contactName} onChange={(e) => setContactName(e.target.value)} />
            <Input placeholder="Mail" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} />
            <Input placeholder="Number" value={contactNumber} onChange={(e) => setContactNumber(e.target.value)} />
            <Button onClick={handleUpdateContact} className="w-full">
              Save
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={rowModalOpen} onOpenChange={setRowModalOpen}>
        <DialogContent className="rounded-2xl sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingRow ? "Update Annexure Table Row" : "Add Annexure Table Row"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <textarea
              className="min-h-24 w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder="Requirements"
              value={requirements}
              onChange={(e) => setRequirements(e.target.value)}
            />
            <select
              className="h-9 w-full rounded-lg border border-input bg-transparent px-3 text-sm"
              value={rowCurrentStatus}
              onChange={(e) => setRowCurrentStatus(e.target.value as AnnexureRowStatus)}
            >
              <option value="pending">pending</option>
              <option value="under review">under review</option>
              <option value="completed">completed</option>
            </select>
            <textarea
              className="min-h-20 w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder="Latest Remark"
              value={rowLatestRemark}
              onChange={(e) => setRowLatestRemark(e.target.value)}
            />
            <div className="space-y-2 rounded-xl border bg-muted/20 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium">Attachment(s)</p>
              </div>
              {rowAttachments.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {rowAttachments.map((name, index) => (
                    <span
                      key={`row-attached-${name}-${index}`}
                      className="inline-flex items-center gap-2 rounded-full border border-sky-300 bg-sky-100 px-2.5 py-1 text-xs font-semibold text-sky-900"
                    >
                      {name}
                      <button
                        type="button"
                        className="rounded px-1 text-[10px] leading-none hover:bg-sky-200"
                        onClick={() =>
                          setRowAttachments((previous) => previous.filter((_, itemIndex) => itemIndex !== index))
                        }
                      >
                        x
                      </button>
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">No attachments linked to this row yet.</p>
              )}
              <div className="space-y-2">
                <Input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  multiple
                  onChange={(e) => setRowAttachmentFiles(Array.from(e.target.files ?? []))}
                />
                {rowAttachmentFiles.length > 0 ? (
                  <p className="text-xs text-muted-foreground">
                    {rowAttachmentFiles.length} file(s) will upload to Firebase when you save this row.
                  </p>
                ) : null}
              </div>
            </div>
            <div className="space-y-2 rounded-xl border bg-muted/20 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium">Concerned Team Member(s)</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setConcernedTeamMembers((previous) => [...previous, ""])}
                >
                  Add Member
                </Button>
              </div>
              <div className="space-y-2">
                {concernedTeamMembers.map((value, index) => (
                  <Input
                    key={`member-${index}`}
                    placeholder={`Team member ${index + 1}`}
                    value={value}
                    onChange={(e) =>
                      setConcernedTeamMembers((previous) =>
                        previous.map((item, itemIndex) => (itemIndex === index ? e.target.value : item)),
                      )
                    }
                  />
                ))}
              </div>
            </div>
            <Button onClick={handleAddMainRow} className="w-full">
              {editingRow ? "Update" : "Add"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}