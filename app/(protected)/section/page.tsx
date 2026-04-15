"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { MoreHorizontal, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { AddModal } from "@/components/common/add-modal";
import { LoadingCards } from "@/components/common/loading-cards";
import { StatusBadge } from "@/components/common/status-badge";
import { useAuth } from "@/components/providers/auth-provider";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  createSection,
  deleteSection,
  subscribeSections,
  updateSection,
  updateSectionStatus,
} from "@/lib/firestore";
import { Section } from "@/lib/types";
import { useEffect } from "react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const allStatuses = ["all", "active", "disabled"] as const;

export default function DashboardPage() {
  const [sections, setSections] = useState<Section[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<(typeof allStatuses)[number]>("all");
  const [openModal, setOpenModal] = useState(false);
  const [editingSection, setEditingSection] = useState<Section | null>(null);
  const { isSuperAdmin } = useAuth();

  useEffect(() => {
    const unsubscribe = subscribeSections(
      (items) => {
        setSections(items);
        setLoading(false);
      },
      (error) => {
        setLoading(false);
        if (error.message.includes("Database '(default)' not found")) {
          toast.error("Firestore is not enabled for this Firebase project yet.");
          return;
        }

        if (error.message.toLowerCase().includes("insufficient permissions")) {
          toast.error("Firestore rules denied access. Update your Firestore security rules.");
          return;
        }

        toast.error("Unable to load sections. Please check Firebase setup.");
      },
    );

    return () => unsubscribe();
  }, []);

  const filteredSections = useMemo(() => {
    return sections
      .filter((section) => {
        const matchesName = section.name.toLowerCase().includes(search.toLowerCase());
        const matchesStatus = statusFilter === "all" || section.status === statusFilter;
        return matchesName && matchesStatus;
      })
      .sort((a, b) => {
        const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return aTime - bTime;
      });
  }, [search, sections, statusFilter]);

  const handleCreateSection = async (name: string, description: string) => {
    if (!isSuperAdmin) {
      toast.error("Only superadmin can create sections");
      return;
    }

    try {
      if (editingSection) {
        await updateSection(editingSection.id, name.trim(), description.trim());
        toast.success("Section updated");
      } else {
        await createSection(name.trim(), description.trim());
        toast.success("Section created");
      }

      setEditingSection(null);
    } catch {
      toast.error(editingSection ? "Failed to update section" : "Failed to create section");
    }
  };

  const handleToggleStatus = async (section: Section) => {
    if (!isSuperAdmin) {
      toast.error("Only superadmin can update section status");
      return;
    }

    try {
      await updateSectionStatus(section.id, section.status === "disabled" ? "active" : "disabled");
      toast.success("Section status updated");
    } catch {
      toast.error("Unable to update section status");
    }
  };

  const handleDeleteSection = async (section: Section) => {
    if (!isSuperAdmin) {
      toast.error("Only superadmin can delete sections");
      return;
    }

    if (!window.confirm(`Delete section \"${section.name}\"? This will remove its annexures too.`)) {
      return;
    }

    try {
      await deleteSection(section.id);
      toast.success("Section deleted");
    } catch {
      toast.error("Unable to delete section");
    }
  };

  return (
    <div className="space-y-6">
      

      <section id="sections" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-xl font-semibold">Sections</h3>
          {isSuperAdmin && (
            <Button
              onClick={() => {
                setEditingSection(null);
                setOpenModal(true);
              }}
            >
              <Plus className="mr-2 size-4" />
              Add Section
            </Button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative w-full max-w-md">
            <Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search sections"
              className="pl-9"
            />
          </div>
          <div className="flex gap-2">
            {allStatuses.map((status) => (
              <Button
                key={status}
                variant={statusFilter === status ? "default" : "outline"}
                size="sm"
                onClick={() => setStatusFilter(status)}
                className="capitalize"
              >
                {status}
              </Button>
            ))}
          </div>
        </div>

        {loading ? (
          <LoadingCards count={6} />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {filteredSections.map((section) => (
              <Card key={section.id} className="rounded-2xl border bg-white/90 shadow-sm transition hover:shadow-md">
                <CardHeader className="flex flex-row items-start justify-between space-y-0">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Section</p>
                    <CardTitle className="mt-1 text-lg">{section.name}</CardTitle>
                    <CardDescription className="mt-2 line-clamp-2">
                      {section.description ?? "No description provided."}
                    </CardDescription>
                  </div>
                  <StatusBadge status={section.status} />
                </CardHeader>
                <CardFooter className="flex flex-wrap gap-2">
                  <Link
                    href={`/section/${section.id}`}
                    className={cn(buttonVariants({ size: "sm", variant: "outline" }))}
                  >
                    View
                  </Link>
                  {isSuperAdmin && (
                    <>
                      <Button size="sm" onClick={() => handleToggleStatus(section)}>
                        {section.status === "disabled" ? "Enable" : "Disable"}
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger className="inline-flex h-9 items-center justify-center rounded-md border border-input bg-background px-3 text-sm ring-offset-background transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                          <MoreHorizontal className="size-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-40">
                          <DropdownMenuItem
                            onClick={() => {
                              setEditingSection(section);
                              setOpenModal(true);
                            }}
                          >
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem variant="destructive" onClick={() => handleDeleteSection(section)}>
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </>
                  )}
                </CardFooter>
              </Card>
            ))}

            {filteredSections.length === 0 && (
              <p className="text-sm text-muted-foreground">No sections found for your current search and filters.</p>
            )}
          </div>
        )}
      </section>

      <AddModal
        open={openModal}
        onOpenChange={(open) => {
          setOpenModal(open);
          if (!open) {
            setEditingSection(null);
          }
        }}
        title={editingSection ? "Edit Section" : "Add Section"}
        label="Section Name"
        placeholder="For example: Section A"
        descriptionLabel="Section Description"
        descriptionPlaceholder="Add a short description for this section"
        initialValue={editingSection?.name}
        initialDescription={editingSection?.description}
        submitLabel={editingSection ? "Update" : "Save"}
        onSubmit={handleCreateSection}
      />
    </div>
  );
}
