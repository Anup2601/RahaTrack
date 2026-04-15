"use client";

import { useEffect, useMemo, useState } from "react";
import { Filter, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

export interface ColumnFilterOption {
  value: string;
  count: number;
}

interface TableColumnFilterProps {
  title: string;
  options: ColumnFilterOption[];
  selectedValues: string[] | null;
  onApply: (values: string[] | null) => void;
}

export function TableColumnFilter({
  title,
  options,
  selectedValues,
  onApply,
}: TableColumnFilterProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [draftValues, setDraftValues] = useState<string[]>([]);

  useEffect(() => {
    if (!open) {
      return;
    }

    setSearch("");
    setDraftValues(selectedValues ?? options.map((option) => option.value));
  }, [open, options, selectedValues]);

  const visibleOptions = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) {
      return options;
    }

    return options.filter((option) => option.value.toLowerCase().includes(query));
  }, [options, search]);

  const isActive = selectedValues !== null;

  const toggleValue = (value: string) => {
    setDraftValues((previous) =>
      previous.includes(value)
        ? previous.filter((item) => item !== value)
        : [...previous, value],
    );
  };

  const handleApply = () => {
    const nextValues = draftValues.length === options.length ? null : draftValues;
    onApply(nextValues);
    setOpen(false);
  };

  return (
    <>
      <button
        type="button"
        aria-label={`Filter ${title}`}
        className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-input bg-background text-foreground transition hover:bg-accent"
        onClick={(event) => {
          event.stopPropagation();
          setOpen(true);
        }}
      >
        <Filter className="size-3.5" />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="overflow-hidden p-0 sm:max-w-xl" showCloseButton={false}>
          <div className="flex items-center justify-between bg-[#8a8a8a] px-5 py-4 text-white">
            <h3 className="text-2xl font-semibold">Filter: {title}</h3>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="grid h-9 w-9 place-items-center rounded-full border-white/20 bg-white/90 text-black hover:bg-white"
              aria-label="Close filter dialog"
            >
              <X className="size-5" />
            </button>
          </div>

          <div className="space-y-3 border-b bg-white px-5 py-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search values..."
                className="h-11 pl-9"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant="outline"
                className="h-11 "
                onClick={() => setDraftValues(options.map((option) => option.value))}
              >
                Select All
              </Button>
              <Button
                type="button"
                variant="default"
                className="h-11 bg-primary"
                onClick={() => setDraftValues([])}
              >
                Clear All
              </Button>
            </div>
          </div>

          <div className="max-h-96 overflow-y-auto bg-white px-4 py-3">
            {visibleOptions.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No values found.</p>
            ) : (
              <div className="space-y-1">
                {visibleOptions.map((option) => {
                  const checked = draftValues.includes(option.value);

                  return (
                    <label
                      key={option.value}
                      className={`flex cursor-pointer items-center justify-between rounded-xl px-3 py-3 transition ${
                        checked ? "bg-muted text-primary-foreground" : "hover:bg-muted/40"
                      }`}
                    >
                     <div className="flex max-w-[90%] items-center gap-3">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleValue(option.value)}
                        className="h-5 w-5 shrink-0 rounded border border-input text-primary focus:ring-primary"
                      />
                      <span className="truncate text-lg">{option.value}</span>
                    </div>
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-700">
                        {option.count}
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 border-t bg-white px-4 py-4">
            <Button type="button" variant="outline" className="h-12" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="button" variant="default" className="h-12" onClick={handleApply}>
              Apply Filter ({isActive ? selectedValues?.length ?? 0 : 0})
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
