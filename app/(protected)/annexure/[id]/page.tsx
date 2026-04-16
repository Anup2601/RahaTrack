"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { Download, FileSpreadsheet, Pencil, Plus, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TableColumnFilter, type ColumnFilterOption } from "@/components/common/table-column-filter";
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
import { storage } from "@/lib/firebase";
import {
  appendLogRowByParentRow,
  createAttachment,
  createContact,
  deleteNestedTableByParentRow,
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

const mergeUniqueFiles = (existing: File[], incoming: File[]) => {
  const seen = new Set(existing.map((file) => `${file.name}-${file.size}-${file.lastModified}`));
  const merged = [...existing];

  incoming.forEach((file) => {
    const key = `${file.name}-${file.size}-${file.lastModified}`;
    if (!seen.has(key)) {
      merged.push(file);
      seen.add(key);
    }
  });

  return merged;
};

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

export default function AnnexurePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const annexureId = params.id;
  const { isSuperAdmin, user } = useAuth();

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
  const [mainTableFilters, setMainTableFilters] = useState({
    requirements: null as string[] | null,
    currentStatus: null as string[] | null,
    attachment: null as string[] | null,
    members: null as string[] | null,
    latestRemark: null as string[] | null,
  });
  const [attachmentTableFilters, setAttachmentTableFilters] = useState({
    name: null as string[] | null,
    status: null as string[] | null,
  });
  const [contactTableFilters, setContactTableFilters] = useState({
    name: null as string[] | null,
    email: null as string[] | null,
    number: null as string[] | null,
    status: null as string[] | null,
  });
  const attachmentPickerRef = useRef<HTMLInputElement | null>(null);
  const rowAttachmentPickerRef = useRef<HTMLInputElement | null>(null);

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
      return "No files selected yet";
    }

    if (attachmentFiles.length === 1) {
      return attachmentFiles[0].name;
    }

    return `${attachmentFiles.length} files selected`;
  }, [attachmentFiles]);

  const mainTableFilterOptions = useMemo(() => {
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
      requirements: buildOptions(rows.map((row) => row.requirements || "-")),
      currentStatus: buildOptions(rows.map((row) => row.currentStatus || "-")),
      attachment: buildOptions(rows.map((row) => row.attachment || "-")),
      members: buildOptions(rows.map((row) => row.concernedTeamMembers || "-")),
      latestRemark: buildOptions(rows.map((row) => row.latestRemark || "-")),
    };
  }, [rows]);

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      if (mainTableFilters.requirements && !mainTableFilters.requirements.includes(row.requirements || "-")) {
        return false;
      }

      if (mainTableFilters.currentStatus && !mainTableFilters.currentStatus.includes(row.currentStatus || "-")) {
        return false;
      }

      if (mainTableFilters.attachment && !mainTableFilters.attachment.includes(row.attachment || "-")) {
        return false;
      }

      if (mainTableFilters.members && !mainTableFilters.members.includes(row.concernedTeamMembers || "-")) {
        return false;
      }

      if (mainTableFilters.latestRemark && !mainTableFilters.latestRemark.includes(row.latestRemark || "-")) {
        return false;
      }

      return true;
    });
  }, [mainTableFilters, rows]);

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
      if (attachmentTableFilters.name && !attachmentTableFilters.name.includes(item.name || "-")) {
        return false;
      }

      if (attachmentTableFilters.status && !attachmentTableFilters.status.includes(item.status)) {
        return false;
      }

      return true;
    });
  }, [attachmentTableFilters, attachments]);

  const contactFilterOptions = useMemo(() => {
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
      name: buildOptions(contacts.map((item) => item.name || "-")),
      email: buildOptions(contacts.map((item) => item.email || "-")),
      number: buildOptions(contacts.map((item) => item.number || "-")),
      status: buildOptions(contacts.map((item) => item.status)),
    };
  }, [contacts]);

  const filteredContacts = useMemo(() => {
    return contacts.filter((item) => {
      if (contactTableFilters.name && !contactTableFilters.name.includes(item.name || "-")) {
        return false;
      }

      if (contactTableFilters.email && !contactTableFilters.email.includes(item.email || "-")) {
        return false;
      }

      if (contactTableFilters.number && !contactTableFilters.number.includes(item.number || "-")) {
        return false;
      }

      if (contactTableFilters.status && !contactTableFilters.status.includes(item.status)) {
        return false;
      }

      return true;
    });
  }, [contactTableFilters, contacts]);

  const handleAddAttachmentFiles = (fileList: FileList | null) => {
    const selected = Array.from(fileList ?? []);
    if (selected.length === 0) {
      return;
    }

    setAttachmentFiles((previous) => mergeUniqueFiles(previous, selected));
  };

  const handleAddRowAttachmentFiles = (fileList: FileList | null) => {
    const selected = Array.from(fileList ?? []);
    if (selected.length === 0) {
      return;
    }

    setRowAttachmentFiles((previous) => mergeUniqueFiles(previous, selected));
  };

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
    if (!isSuperAdmin) {
      toast.error("Only superadmin can upload attachments");
      return;
    }

    if (attachmentFiles.length === 0) {
      toast.error("Please select one or more attachment files");
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
    if (!isSuperAdmin) {
      toast.error("Only superadmin can update attachments");
      return;
    }

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
    if (!isSuperAdmin) {
      toast.error("Only superadmin can add contacts");
      return;
    }

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
    if (!isSuperAdmin) {
      toast.error("Only superadmin can update contacts");
      return;
    }

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
    if (!isSuperAdmin) {
      toast.error("Only superadmin can add or update rows");
      return;
    }

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

      if (!editingRow) {
        try {
          const now = getNow();
          const initialRemark = rowLatestRemark.trim();
          await appendLogRowByParentRow(updatedRow.id, {
            id: crypto.randomUUID(),
            sNo: "1",
            date: now.date,
            time: now.time,
            username: user?.displayName || user?.email || "Unknown user",
            status: "not started",
            remark: initialRemark || "-",
          });
        } catch {
          toast.error("Row saved, but the comment log could not be created");
        }
      }

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
    if (!isSuperAdmin) {
      toast.error("Only superadmin can edit rows");
      return;
    }

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

  const handleDeleteRow = async (row: AnnexureTableRow) => {
    if (!isSuperAdmin) {
      toast.error("Only superadmin can delete rows");
      return;
    }

    if (!window.confirm(`Delete row "${row.requirements}"? This will remove its comment log too.`)) {
      return;
    }

    try {
      const nextRows = rows.filter((item) => item.id !== row.id);
      await saveAnnexureStatusRows(annexureId, nextRows);
      await deleteNestedTableByParentRow(row.id);
      setRows(nextRows);
      toast.success("Row deleted");
    } catch {
      toast.error("Unable to delete row");
    }
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
            {annexure.description ?? "Annexure tracking table with requirement, attachment and comment log access."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={annexure.status} />

        </div>
      </section>

      <Card className="overflow-hidden rounded-2xl border border-slate-300 bg-white shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Annexure Table</CardTitle>
          {isSuperAdmin ? (
            <Button onClick={() => openRowEditor()}>
              <Plus className="mr-2 size-4" />
              Add Row
            </Button>
          ) : null}
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table className="min-w-280 table-fixed rounded-full">
              <TableHeader className="bg-[#8a8a8a]">
                <TableRow className="border-slate-300 hover:bg-[#8a8a8a]/20">
                  <TableHead className="w-12 text-center text-white">S No.</TableHead>
                  <TableHead className="w-140 text-center text-white">
                    <div className="flex items-center justify-between gap-2">
                      <span>Requirements</span>
                      <TableColumnFilter
                        title="Requirements"
                        options={mainTableFilterOptions.requirements}
                        selectedValues={mainTableFilters.requirements}
                        onApply={(values) =>
                          setMainTableFilters((previous) => ({ ...previous, requirements: values }))
                        }
                      />
                    </div>
                  </TableHead>
                  <TableHead className="w-45 text-center text-white">
                    <div className="flex items-center justify-between gap-2">
                      <span>Current Status</span>
                      <TableColumnFilter
                        title="Current Status"
                        options={mainTableFilterOptions.currentStatus}
                        selectedValues={mainTableFilters.currentStatus}
                        onApply={(values) =>
                          setMainTableFilters((previous) => ({ ...previous, currentStatus: values }))
                        }
                      />
                    </div>
                  </TableHead>
                  <TableHead className="w-44 text-center text-white">
                    <div className="flex items-center justify-between gap-2">
                      <span>Attachment</span>
                      <TableColumnFilter
                        title="Attachment"
                        options={mainTableFilterOptions.attachment}
                        selectedValues={mainTableFilters.attachment}
                        onApply={(values) =>
                          setMainTableFilters((previous) => ({ ...previous, attachment: values }))
                        }
                      />
                    </div>
                  </TableHead>
                  <TableHead className="w-52 text-center text-white">
                    <div className="flex items-center justify-between gap-2">
                      <span> Team Member(s)</span>
                      <TableColumnFilter
                        title="Concerned Team Member(s)"
                        options={mainTableFilterOptions.members}
                        selectedValues={mainTableFilters.members}
                        onApply={(values) =>
                          setMainTableFilters((previous) => ({ ...previous, members: values }))
                        }
                      />
                    </div>
                  </TableHead>
                  <TableHead className="w-102 text-center text-white">
                    <div className="flex items-center justify-between gap-2">
                      <span>Latest Remark</span>
                      <TableColumnFilter
                        title="Latest Remark"
                        options={mainTableFilterOptions.latestRemark}
                        selectedValues={mainTableFilters.latestRemark}
                        onApply={(values) =>
                          setMainTableFilters((previous) => ({ ...previous, latestRemark: values }))
                        }
                      />
                    </div>
                  </TableHead>
                  <TableHead className="w-28 text-center text-white">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-14 text-center text-muted-foreground">
                      No rows in annexure table for selected filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredRows.map((row, index) => (
                    <TableRow
                      key={row.id}
                      className="cursor-pointer border-slate-200 odd:bg-slate-50/80 even:bg-white hover:bg-yellow-300"
                      onClick={() => openLogTable(row)}
                    >
                      <TableCell className="text-center align-middle font-medium">{index + 1}</TableCell>
                      <TableCell className="text-left align-middle">
                        <p className="mx-auto max-w-140 whitespace-normal wrap-break-word leading-6" title={row.requirements}>
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
                      <TableCell className="text-left align-middle">
                        <p className="mx-auto max-w-176 whitespace-normal wrap-break-word leading-6" title={row.latestRemark || "-"}>
                          {row.latestRemark || "-"}
                        </p>
                      </TableCell>
                      <TableCell className="text-center align-middle">
                        <div className="inline-flex items-center gap-1">
                          {isSuperAdmin ? (
                            <>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  openRowEditor(row);
                                }}
                              >
                                <Pencil className="mr-2 size-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-red-600 hover:bg-red-50 hover:text-red-700"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  handleDeleteRow(row);
                                }}
                              >
                                <Trash2 className="mr-2 size-4" />
                              
                              </Button>
                            </>
                          ) : (
                            <span className="text-xs text-muted-foreground">View</span>
                          )}
                        </div>
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
              {isSuperAdmin ? (
                <Button onClick={() => setAttachmentModalOpen(true)}>
                  <Plus className="mr-2 size-4" />
                  Upload Excel
                </Button>
              ) : null}
            </DialogTitle>
          </DialogHeader>
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
                        selectedValues={attachmentTableFilters.name}
                        onApply={(values) =>
                          setAttachmentTableFilters((previous) => ({ ...previous, name: values }))
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
                        selectedValues={attachmentTableFilters.status}
                        onApply={(values) =>
                          setAttachmentTableFilters((previous) => ({ ...previous, status: values }))
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
                    <TableCell colSpan={5} className="h-14 text-center text-muted-foreground">
                      No attachments found for selected filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredAttachments.map((item, index) => (
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
                        {isSuperAdmin ? (
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
                        ) : (
                          <span className="text-xs text-muted-foreground">View</span>
                        )}
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
              {isSuperAdmin ? (
                <Button onClick={() => setContactModalOpen(true)}>
                  <Plus className="mr-2 size-4" />
                  Add Contact
                </Button>
              ) : null}
            </DialogTitle>
          </DialogHeader>
          <div className="overflow-x-auto">
            <Table className="min-w-190">
              <TableHeader>
                <TableRow>
                  <TableHead>S No.</TableHead>
                  <TableHead>
                    <div className="flex items-center justify-between gap-2">
                      <span>Name</span>
                      <TableColumnFilter
                        title="Contact Name"
                        options={contactFilterOptions.name}
                        selectedValues={contactTableFilters.name}
                        onApply={(values) =>
                          setContactTableFilters((previous) => ({ ...previous, name: values }))
                        }
                      />
                    </div>
                  </TableHead>
                  <TableHead>
                    <div className="flex items-center justify-between gap-2">
                      <span>Mail</span>
                      <TableColumnFilter
                        title="Contact Mail"
                        options={contactFilterOptions.email}
                        selectedValues={contactTableFilters.email}
                        onApply={(values) =>
                          setContactTableFilters((previous) => ({ ...previous, email: values }))
                        }
                      />
                    </div>
                  </TableHead>
                  <TableHead>
                    <div className="flex items-center justify-between gap-2">
                      <span>Number</span>
                      <TableColumnFilter
                        title="Contact Number"
                        options={contactFilterOptions.number}
                        selectedValues={contactTableFilters.number}
                        onApply={(values) =>
                          setContactTableFilters((previous) => ({ ...previous, number: values }))
                        }
                      />
                    </div>
                  </TableHead>
                  <TableHead>
                    <div className="flex items-center justify-between gap-2">
                      <span>Status</span>
                      <TableColumnFilter
                        title="Contact Status"
                        options={contactFilterOptions.status}
                        selectedValues={contactTableFilters.status}
                        onApply={(values) =>
                          setContactTableFilters((previous) => ({ ...previous, status: values }))
                        }
                      />
                    </div>
                  </TableHead>
                  <TableHead className="text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredContacts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-14 text-center text-muted-foreground">
                      No contacts found for selected filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredContacts.map((item, index) => (
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
                        {isSuperAdmin ? (
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
                        ) : (
                          <span className="text-xs text-muted-foreground">View</span>
                        )}
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
            <DialogTitle>Upload Attachments</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="rounded-xl border bg-muted/20 p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium">Upload file(s)</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => attachmentPickerRef.current?.click()}
                >
                  Add Files
                </Button>
              </div>
              <input
                ref={attachmentPickerRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                multiple
                className="hidden"
                onChange={(e) => {
                  handleAddAttachmentFiles(e.target.files);
                  e.currentTarget.value = "";
                }}
              />
              {attachmentFiles.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {attachmentFiles.map((file, index) => (
                    <span
                      key={`${file.name}-${file.lastModified}-${index}`}
                      className="inline-flex items-center gap-2 rounded-full border border-sky-300 bg-sky-100 px-2.5 py-1 text-xs font-semibold text-sky-900"
                      title={file.name}
                    >
                      <span className="max-w-52 truncate">{file.name}</span>
                      <button
                        type="button"
                        className="rounded px-1 text-[10px] leading-none hover:bg-sky-200"
                        onClick={() =>
                          setAttachmentFiles((previous) =>
                            previous.filter((_, itemIndex) => itemIndex !== index),
                          )
                        }
                      >
                        x
                      </button>
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">No files added yet.</p>
              )}
            </div>
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
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => rowAttachmentPickerRef.current?.click()}
                >
                  Add Files
                </Button>
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
                <input
                  ref={rowAttachmentPickerRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    handleAddRowAttachmentFiles(e.target.files);
                    e.currentTarget.value = "";
                  }}
                />
                {rowAttachmentFiles.length > 0 ? (
                  <div className="space-y-2">
                    <div className="flex flex-wrap gap-2">
                      {rowAttachmentFiles.map((file, index) => (
                        <span
                          key={`${file.name}-${file.lastModified}-${index}`}
                          className="inline-flex items-center gap-2 rounded-full border border-sky-300 bg-sky-100 px-2.5 py-1 text-xs font-semibold text-sky-900"
                          title={file.name}
                        >
                          <span className="max-w-52 truncate">{file.name}</span>
                          <button
                            type="button"
                            className="rounded px-1 text-[10px] leading-none hover:bg-sky-200"
                            onClick={() =>
                              setRowAttachmentFiles((previous) =>
                                previous.filter((_, itemIndex) => itemIndex !== index),
                              )
                            }
                          >
                            x
                          </button>
                        </span>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {rowAttachmentFiles.length} file(s) will upload to Firebase when you save this row.
                    </p>
                  </div>
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