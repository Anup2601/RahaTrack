"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/common/status-badge";
import {
  getAnnexureStatusRows,
  subscribeAnnexuresBySection,
  subscribeSections,
} from "@/lib/firestore";
import { Annexure, AnnexureTableRow, Section } from "@/lib/types";

export default function DashboardPage() {
  const [sections, setSections] = useState<Section[]>([]);
  const [annexures, setAnnexures] = useState<Annexure[]>([]);
  const [tableRows, setTableRows] = useState<AnnexureTableRow[]>([]);
  const [selectedSection, setSelectedSection] = useState<Section | null>(null);
  const [selectedAnnexure, setSelectedAnnexure] = useState<Annexure | null>(null);
  const [loadingSections, setLoadingSections] = useState(true);
  const [loadingAnnexures, setLoadingAnnexures] = useState(false);
  const [loadingTable, setLoadingTable] = useState(false);

  useEffect(() => {
    const unsubscribe = subscribeSections(
      (data) => {
        setSections(data);
        setLoadingSections(false);

        if (!selectedSection && data.length > 0) {
          setLoadingAnnexures(true);
          setSelectedSection(data[0]);
        }
      },
      () => {
        setLoadingSections(false);
        toast.error("Unable to load sections");
      },
    );

    return () => unsubscribe();
  }, [selectedSection]);

  useEffect(() => {
    if (!selectedSection) {
      return;
    }

    const unsubscribe = subscribeAnnexuresBySection(
      selectedSection.id,
      (data) => {
        setAnnexures(data);
        setLoadingAnnexures(false);

        if (data.length > 0) {
          const initial = data[0];
          setSelectedAnnexure((prev) => prev ?? initial);
        } else {
          setSelectedAnnexure(null);
          setTableRows([]);
        }
      },
      () => {
        setLoadingAnnexures(false);
        toast.error("Unable to load annexures");
      },
    );

    return () => unsubscribe();
  }, [selectedSection]);

  useEffect(() => {
    if (!selectedAnnexure) {
      return;
    }

    let active = true;

    const load = async () => {
      try {
        const rows = await getAnnexureStatusRows(selectedAnnexure.id);
        if (!active) {
          return;
        }
        setTableRows(rows);
      } catch {
        if (!active) {
          return;
        }
        toast.error("Unable to load annexure table");
      } finally {
        if (active) {
          setLoadingTable(false);
        }
      }
    };

    load();

    return () => {
      active = false;
    };
  }, [selectedAnnexure]);

  const handleSectionSelect = (section: Section) => {
    setLoadingAnnexures(true);
    setLoadingTable(false);
    setSelectedSection(section);
    setSelectedAnnexure(null);
    setTableRows([]);
  };

  const handleAnnexureSelect = (annexure: Annexure) => {
    setLoadingTable(true);
    setSelectedAnnexure(annexure);
  };

  const visibleAnnexures = useMemo(() => {
    if (!selectedSection) {
      return [];
    }
    return annexures;
  }, [annexures, selectedSection]);

  return (
    <div className="space-y-6">
      <section className="rounded-[1.6rem] border border-black/10 bg-[#8f8f8f] p-5 text-white shadow-[0_12px_24px_rgba(0,0,0,0.2)]">
        <h2 className="text-2xl font-bold">Dashboard</h2>
        <p className="mt-1 text-sm text-white/85">
          Select section, then annexure. The table opens here without leaving this page.
        </p>
      </section>

      <Card className="rounded-[1.6rem] border border-black/20 bg-[#8f8f8f] text-white shadow-[0_12px_24px_rgba(0,0,0,0.2)]">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-white">All Sections</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingSections ? (
            <p className="text-sm text-white/80">Loading sections...</p>
          ) : sections.length === 0 ? (
            <p className="text-sm text-white/80">No sections available.</p>
          ) : (
            <div className="flex flex-wrap gap-4">
              {sections.map((section) => {
                const active = selectedSection?.id === section.id;
                return (
                  <button
                    key={section.id}
                    type="button"
                    onClick={() => handleSectionSelect(section)}
                    className={`rounded-full border px-6 py-3 text-sm transition ${
                      active
                        ? "border-[#ffe600] bg-[#ffe600] font-semibold text-black"
                        : "border-white/30 bg-white/10 text-white hover:border-[#ffe600]/80 hover:bg-white/15"
                    }`}
                  >
                    {section.name}
                  </button>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-[1.6rem] border border-black/20 bg-[#8f8f8f] text-white shadow-[0_12px_24px_rgba(0,0,0,0.2)]">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-white">
            {selectedSection ? `All Annexures of ${selectedSection.name}` : "All Annexures"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!selectedSection ? (
            <p className="text-sm text-white/80">Select a section first.</p>
          ) : loadingAnnexures ? (
            <p className="text-sm text-white/80">Loading annexures...</p>
          ) : visibleAnnexures.length === 0 ? (
            <p className="text-sm text-white/80">No annexures found for selected section.</p>
          ) : (
            <div className="flex flex-wrap gap-4">
              {visibleAnnexures.map((annexure) => {
                const active = selectedAnnexure?.id === annexure.id;
                return (
                  <button
                    key={annexure.id}
                    type="button"
                    onClick={() => handleAnnexureSelect(annexure)}
                    className={`rounded-full border px-6 py-3 text-sm transition ${
                      active
                        ? "border-[#ffe600] bg-[#ffe600] font-semibold text-black"
                        : "border-white/30 bg-white/10 text-white hover:border-[#ffe600]/80 hover:bg-white/15"
                    }`}
                  >
                    {annexure.name}
                  </button>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-[1.6rem] border border-black/20 bg-[#8f8f8f] text-white shadow-[0_12px_24px_rgba(0,0,0,0.2)]">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-white">
            {selectedAnnexure ? `Table: ${selectedAnnexure.name}` : "Annexure Table"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!selectedAnnexure ? (
            <p className="text-sm text-white/80">Select an annexure to open its table here.</p>
          ) : loadingTable ? (
            <p className="text-sm text-white/80">Loading table...</p>
          ) : (
            <Table className="rounded-xl bg-white/95 text-black">
              <TableHeader>
                <TableRow>
                  <TableHead>S No.</TableHead>
                  <TableHead>Requirements</TableHead>
                  <TableHead>Current Status</TableHead>
                  <TableHead>Latest Remark</TableHead>
                  <TableHead>Row Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tableRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-16 text-center text-black/65">
                      No rows available in this annexure table.
                    </TableCell>
                  </TableRow>
                ) : (
                  tableRows.map((row, index) => (
                    <TableRow key={row.id}>
                      <TableCell>{index + 1}</TableCell>
                      <TableCell>
                        <p className="max-w-55 truncate" title={row.requirements}>{row.requirements}</p>
                      </TableCell>
                      <TableCell className="capitalize">{row.currentStatus}</TableCell>
                      <TableCell>
                        <p className="max-w-75 truncate" title={row.latestRemark || "-"}>{row.latestRemark || "-"}</p>
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={row.status ?? "active"} />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
