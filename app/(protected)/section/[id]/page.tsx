"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { AddModal } from "@/components/common/add-modal";
import { LoadingCards } from "@/components/common/loading-cards";
import { StatusBadge } from "@/components/common/status-badge";
import { useAuth } from "@/components/providers/auth-provider";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import {
  createAnnexure,
  getSectionById,
  subscribeAnnexuresBySection,
  updateAnnexureStatus,
} from "@/lib/firestore";
import { Annexure, Section } from "@/lib/types";
import { cn } from "@/lib/utils";

export default function SectionPage() {
  const params = useParams<{ id: string }>();
  const [section, setSection] = useState<Section | null>(null);
  const [annexures, setAnnexures] = useState<Annexure[]>([]);
  const [loading, setLoading] = useState(true);
  const [openModal, setOpenModal] = useState(false);
  const { isAdmin } = useAuth();

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
    try {
      await createAnnexure(params.id, name);
      toast.success("Annexure added");
    } catch {
      toast.error("Failed to add annexure");
    }
  };

  const handleToggleAnnexure = async (annexure: Annexure) => {
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

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border bg-white/85 p-5 shadow-sm backdrop-blur">
        <h2 className="text-2xl font-semibold">{section?.name ?? "Section"}</h2>
        <p className="mt-1 text-sm text-muted-foreground">Manage annexures mapped to this section.</p>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-semibold">Annexures</h3>
          {isAdmin && (
            <Button onClick={() => setOpenModal(true)}>
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
                  {isAdmin && (
                    <>
                      <Button size="sm" onClick={() => handleToggleAnnexure(annexure)}>
                        {annexure.status === "disabled" ? "Enable" : "Disable"}
                      </Button>
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
        onOpenChange={setOpenModal}
        title="Add Annexure"
        label="Annexure Name"
        placeholder="For example: Annexure 1"
        onSubmit={handleCreateAnnexure}
      />
    </div>
  );
}
