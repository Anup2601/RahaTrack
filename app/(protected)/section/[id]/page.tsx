"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { MoreHorizontal, Plus } from "lucide-react";
import { toast } from "sonner";
import { AddModal } from "@/components/common/add-modal";
import { LoadingCards } from "@/components/common/loading-cards";
import { StatusBadge } from "@/components/common/status-badge";
import { useAuth } from "@/components/providers/auth-provider";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import {
  createAnnexure,
  deleteAnnexure,
  getSectionById,
  subscribeAnnexuresBySection,
  updateAnnexure,
  updateAnnexureStatus,
} from "@/lib/firestore";
import { Annexure, Section } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function SectionPage() {
  const params = useParams<{ id: string }>();
  const [section, setSection] = useState<Section | null>(null);
  const [annexures, setAnnexures] = useState<Annexure[]>([]);
  const [loading, setLoading] = useState(true);
  const [openModal, setOpenModal] = useState(false);
  const [editingAnnexure, setEditingAnnexure] = useState<Annexure | null>(null);
  const { isSuperAdmin } = useAuth();

  useEffect(() => {
    const sectionId = params.id;

    getSectionById(sectionId)
      .then((data) => setSection(data))
      .catch(() => toast.error("Unable to load section details"));

    const unsubscribe = subscribeAnnexuresBySection(
      sectionId,
      (data) => {
        setAnnexures(data);
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

        toast.error("Unable to load annexures. Please check Firebase setup.");
      },
    );

    return () => unsubscribe();
  }, [params.id]);

  const handleCreateAnnexure = async (name: string) => {
    if (!isSuperAdmin) {
      toast.error("Only superadmin can add annexures");
      return;
    }

    try {
      if (editingAnnexure) {
        await updateAnnexure(editingAnnexure.id, name.trim());
        toast.success("Annexure updated");
      } else {
        await createAnnexure(params.id, name.trim());
        toast.success("Annexure added");
      }

      setEditingAnnexure(null);
    } catch {
      toast.error(editingAnnexure ? "Failed to update annexure" : "Failed to add annexure");
    }
  };

  const handleToggleAnnexure = async (annexure: Annexure) => {
    if (!isSuperAdmin) {
      toast.error("Only superadmin can update annexure status");
      return;
    }

    try {
      await updateAnnexureStatus(
        annexure.id,
        annexure.status === "disabled" ? "active" : "disabled",
      );
      toast.success("Annexure updated");
    } catch {
      toast.error("Unable to update annexure");
    }
  };

  const handleDeleteAnnexure = async (annexure: Annexure) => {
    if (!isSuperAdmin) {
      toast.error("Only superadmin can delete annexures");
      return;
    }

    if (!window.confirm(`Delete annexure \"${annexure.name}\"? This will remove its related data too.`)) {
      return;
    }

    try {
      await deleteAnnexure(annexure.id);
      toast.success("Annexure deleted");
    } catch {
      toast.error("Unable to delete annexure");
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border bg-white/85 p-5 shadow-sm backdrop-blur">
        <h2 className="text-2xl font-semibold">{section?.name ?? "Section"}</h2>
        <p className="mt-1 text-sm text-muted-foreground">Manage annexures mapped to this section.</p>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-semibold">Annexures</h3>
          {isSuperAdmin && (
            <Button
              onClick={() => {
                setEditingAnnexure(null);
                setOpenModal(true);
              }}
            >
              <Plus className="mr-2 size-4" />
              Add Annexure
            </Button>
          )}
        </div>

        {loading ? (
          <LoadingCards count={4} />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {annexures.map((annexure) => (
              <Card key={annexure.id} className="rounded-2xl border bg-white/90 shadow-sm">
                <CardHeader className="flex flex-row items-start justify-between space-y-0">
                  <CardTitle className="text-lg">{annexure.name}</CardTitle>
                  <StatusBadge status={annexure.status} />
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">Linked to section {section?.name ?? "-"}.</p>
                </CardContent>
                <CardFooter className="flex flex-wrap gap-2">
                  <Link
                    href={`/annexure/${annexure.id}`}
                    className={cn(buttonVariants({ size: "sm", variant: "outline" }))}
                  >
                    Open
                  </Link>
                  {isSuperAdmin && (
                    <>
                      <Button size="sm" onClick={() => handleToggleAnnexure(annexure)}>
                        {annexure.status === "disabled" ? "Enable" : "Disable"}
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger className="inline-flex h-9 items-center justify-center rounded-md border border-input bg-background px-3 text-sm ring-offset-background transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                          <MoreHorizontal className="size-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-40">
                          <DropdownMenuItem
                            onClick={() => {
                              setEditingAnnexure(annexure);
                              setOpenModal(true);
                            }}
                          >
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem variant="destructive" onClick={() => handleDeleteAnnexure(annexure)}>
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </>
                  )}
                </CardFooter>
              </Card>
            ))}

            {annexures.length === 0 && (
              <p className="text-sm text-muted-foreground">No annexures available yet.</p>
            )}
          </div>
        )}
      </section>

      <AddModal
        open={openModal}
        onOpenChange={(open) => {
          setOpenModal(open);
          if (!open) {
            setEditingAnnexure(null);
          }
        }}
        title={editingAnnexure ? "Edit Annexure" : "Add Annexure"}
        label="Annexure Name"
        placeholder="For example: Annexure 1"
        initialValue={editingAnnexure?.name}
        submitLabel={editingAnnexure ? "Update" : "Save"}
        onSubmit={handleCreateAnnexure}
      />
    </div>
  );
}
