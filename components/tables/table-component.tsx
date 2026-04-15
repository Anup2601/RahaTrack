"use client";

import { useMemo, useState } from "react";
import { MoreHorizontal, Plus } from "lucide-react";
import { toast } from "sonner";
import { TableColumnFilter, type ColumnFilterOption } from "@/components/common/table-column-filter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/common/status-badge";
import { DynamicRow, EntityStatus } from "@/lib/types";

interface TableComponentProps {
  title: string;
  columns: string[];
  rows: DynamicRow[];
  onSave: (rows: DynamicRow[], columns: string[], status: EntityStatus) => Promise<void>;
  onRowClick?: (row: DynamicRow) => void;
  status?: EntityStatus;
}

const toLabel = (value: string) =>
  value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());

const createRowTemplate = (columns: string[]) => {
  return columns.reduce<Record<string, string>>((acc, column) => {
    acc[column] = "";
    return acc;
  }, {});
};

export function TableComponent({
  title,
  columns,
  rows,
  onSave,
  onRowClick,
  status = "active",
}: TableComponentProps) {
  const [openEditor, setOpenEditor] = useState(false);
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Record<string, string>>(createRowTemplate(columns));
  const [localColumns, setLocalColumns] = useState<string[]>(columns);
  const [columnInput, setColumnInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [filters, setFilters] = useState<Record<string, string[] | null>>({});

  const byId = useMemo(() => {
    return rows.reduce<Record<string, DynamicRow>>((acc, item) => {
      acc[item.id] = item;
      return acc;
    }, {});
  }, [rows]);

  const filterOptions = useMemo(() => {
    const buildOptions = (values: string[]): ColumnFilterOption[] => {
      const counts = values.reduce<Record<string, number>>((acc, value) => {
        acc[value] = (acc[value] ?? 0) + 1;
        return acc;
      }, {});

      return Object.entries(counts)
        .map(([value, count]) => ({ value, count }))
        .sort((a, b) => a.value.localeCompare(b.value));
    };

    const options: Record<string, ColumnFilterOption[]> = {};

    localColumns.forEach((column) => {
      options[column] = buildOptions(rows.map((row) => String(row[column] ?? "-")));
    });

    options.status = buildOptions(rows.map((row) => String(row.status ?? "active")));

    return options;
  }, [localColumns, rows]);

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      return Object.entries(filters).every(([key, value]) => {
        if (!value) {
          return true;
        }

        if (key === "status") {
          return value.includes(String(row.status ?? "active"));
        }

        return value.includes(String(row[key] ?? "-"));
      });
    });
  }, [filters, rows]);

  const handleAddColumn = async () => {
    const parsed = columnInput.trim().toLowerCase().replace(/\s+/g, "_");

    if (!parsed) {
      toast.error("Column name is required");
      return;
    }

    if (localColumns.includes(parsed)) {
      toast.error("Column already exists");
      return;
    }

    const nextColumns = [...localColumns, parsed];
    const nextRows = rows.map((item) => ({ ...item, [parsed]: "" }));

    try {
      await onSave(nextRows, nextColumns, status);
      setLocalColumns(nextColumns);
      setColumnInput("");
      toast.success("Column added");
    } catch {
      toast.error("Could not add column");
    }
  };

  const openCreateDialog = () => {
    setEditingRowId(null);
    setFormData(createRowTemplate(localColumns));
    setOpenEditor(true);
  };

  const openEditDialog = (rowId: string) => {
    const row = byId[rowId];
    if (!row) {
      return;
    }

    const mapped = localColumns.reduce<Record<string, string>>((acc, column) => {
      acc[column] = String(row[column] ?? "");
      return acc;
    }, {});

    setEditingRowId(rowId);
    setFormData(mapped);
    setOpenEditor(true);
  };

  const disableRow = async (rowId: string) => {
    const nextRows = rows.map((item) =>
      item.id === rowId
        ? {
            ...item,
            status:
              item.status === "disabled"
                ? ("active" as EntityStatus)
                : ("disabled" as EntityStatus),
          }
        : item,
    );

    try {
      await onSave(nextRows, localColumns, status);
      toast.success("Row status updated");
    } catch {
      toast.error("Unable to update row status");
    }
  };

  const saveRow = async () => {
    setSubmitting(true);

    const payload = {
      id: editingRowId ?? crypto.randomUUID(),
      status: (editingRowId ? byId[editingRowId]?.status : "active") ?? "active",
      ...formData,
    } as DynamicRow;

    const nextRows = editingRowId
      ? rows.map((item) => (item.id === editingRowId ? payload : item))
      : [...rows, payload];

    try {
      await onSave(nextRows, localColumns, status);
      toast.success(editingRowId ? "Row updated" : "Row added");
      setOpenEditor(false);
    } catch {
      toast.error("Failed to save row");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="space-y-4 rounded-2xl border bg-white/85 p-5 shadow-sm backdrop-blur">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">{title}</h2>
        <div className="flex flex-wrap gap-2">
          <Input
            placeholder="Add new column"
            value={columnInput}
            onChange={(event) => setColumnInput(event.target.value)}
            className="w-40"
          />
          <Button variant="outline" onClick={handleAddColumn}>
            Add Column
          </Button>
          <Button onClick={openCreateDialog}>
            <Plus className="mr-2 size-4" />
            Add Row
          </Button>
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            {localColumns.map((column) => (
              <TableHead key={column}>
                <div className="flex items-center justify-between gap-2">
                  <span>{toLabel(column)}</span>
                  <TableColumnFilter
                    title={toLabel(column)}
                    options={filterOptions[column] ?? []}
                    selectedValues={filters[column] ?? null}
                    onApply={(values) =>
                      setFilters((previous) => ({
                        ...previous,
                        [column]: values,
                      }))
                    }
                  />
                </div>
              </TableHead>
            ))}
            <TableHead>
              <div className="flex items-center justify-between gap-2">
                <span>Status</span>
                <TableColumnFilter
                  title="Status"
                  options={filterOptions.status ?? []}
                  selectedValues={filters.status ?? null}
                  onApply={(values) =>
                    setFilters((previous) => ({
                      ...previous,
                      status: values,
                    }))
                  }
                />
              </div>
            </TableHead>
            <TableHead className="text-center">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredRows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={localColumns.length + 2} className="h-24 text-center text-muted-foreground">
                No rows found for selected filters.
              </TableCell>
            </TableRow>
          ) : (
            filteredRows.map((row) => (
              <TableRow
                key={row.id}
                className={onRowClick && row.status !== "disabled" ? "cursor-pointer" : ""}
                onClick={() => {
                  if (onRowClick && row.status !== "disabled") {
                    onRowClick(row);
                  }
                }}
              >
                {localColumns.map((column) => (
                  <TableCell key={`${row.id}-${column}`}>{String(row[column] ?? "-")}</TableCell>
                ))}
                <TableCell>
                  <StatusBadge status={row.status} />
                </TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      className="inline-flex size-8 items-center justify-center rounded-md border border-transparent hover:bg-muted"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <MoreHorizontal className="size-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-40">
                      <DropdownMenuItem
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          openEditDialog(row.id);
                        }}
                      >
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          disableRow(row.id);
                        }}
                      >
                        {row.status === "disabled" ? "Enable" : "Disable"}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      <Dialog open={openEditor} onOpenChange={setOpenEditor}>
        <DialogContent className="rounded-2xl sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{editingRowId ? "Edit Row" : "Add Row"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            {localColumns.map((column) => (
              <div key={column} className="space-y-2">
                <p className="text-sm font-medium">{toLabel(column)}</p>
                <Input
                  value={formData[column] ?? ""}
                  onChange={(event) =>
                    setFormData((previous) => ({
                      ...previous,
                      [column]: event.target.value,
                    }))
                  }
                />
              </div>
            ))}
          </div>
          <Button onClick={saveRow} disabled={submitting}>
            {submitting ? "Saving..." : "Save"}
          </Button>
        </DialogContent>
      </Dialog>
    </section>
  );
}
