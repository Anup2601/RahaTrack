"use client";

import { useEffect, useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const formSchema = z.object({
  name: z.string().min(2, "Please enter at least 2 characters"),
  description: z.string().max(500, "Description must be 500 characters or less"),
});

type FormValues = z.infer<typeof formSchema>;

interface AddModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  label: string;
  placeholder: string;
  descriptionLabel?: string;
  descriptionPlaceholder?: string;
  initialValue?: string;
  initialDescription?: string;
  submitLabel?: string;
  onSubmit: (name: string, description: string) => Promise<void>;
}

export function AddModal({
  open,
  onOpenChange,
  title,
  label,
  placeholder,
  descriptionLabel = "Description",
  descriptionPlaceholder = "Add a short description",
  initialValue = "",
  initialDescription = "",
  submitLabel = "Save",
  onSubmit,
}: AddModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: initialValue, description: initialDescription },
  });

  useEffect(() => {
    if (open) {
      form.reset({ name: initialValue, description: initialDescription });
    }
  }, [form, initialDescription, initialValue, open]);

  const handleSubmit = async (values: FormValues) => {
    setSubmitting(true);
    try {
      await onSubmit(values.name, values.description.trim());
      form.reset();
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="entityName">{label}</Label>
            <Input id="entityName" placeholder={placeholder} {...form.register("name")} />
            {form.formState.errors.name && (
              <p className="text-sm text-red-600">{form.formState.errors.name.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="entityDescription">{descriptionLabel}</Label>
            <textarea
              id="entityDescription"
              placeholder={descriptionPlaceholder}
              rows={4}
              className="min-h-24 w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              {...form.register("description")}
            />
            {form.formState.errors.description && (
              <p className="text-sm text-red-600">{form.formState.errors.description.message}</p>
            )}
          </div>
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? "Saving..." : submitLabel}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
