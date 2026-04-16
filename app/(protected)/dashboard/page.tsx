"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, ClipboardList, Layers3, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/common/status-badge";
import {
  getAnnexureStatusRows,
  subscribeAllAnnexures,
  subscribeSections,
} from "@/lib/firestore";
import { Annexure, AnnexureTableRow, Section } from "@/lib/types";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  PolarAngleAxis,
  RadialBar,
  RadialBarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const theme = {
  yellow: "#ffe600",
  yellowSoft: "#fff4a3",
  yellowDeep: "#ffd200",
  grayDark: "#575757",
  grayMid: "#8b8b8b",
  graySoft: "#efefef",
  grayLine: "#d7d7d7",
  text: "#1f1f1f",
};

const clampPercent = (value: number) => Math.max(0, Math.min(100, value));

const formatPercent = (value: number) => `${Math.round(clampPercent(value))}%`;

const buildSectionNameMap = (sections: Section[]) => {
  return sections.reduce<Record<string, string>>((acc, section) => {
    acc[section.id] = section.name;
    return acc;
  }, {});
};

function SemiGauge({
  value,
  title,
  subtitle,
  compact = false,
}: {
  value: number;
  title: string;
  subtitle: string;
  compact?: boolean;
}) {
  const percent = clampPercent(value);
  const chartData = [{ name: title, value: percent }];

  const height = compact ? 170 : 230;
  const innerRadius = compact ? "72%" : "70%";
  const outerRadius = compact ? "100%" : "98%";

  return (
    <div className="relative rounded-[1.4rem] border border-black/10 bg-white p-4 shadow-[0_8px_20px_rgba(0,0,0,0.08)]">
      <div className="mb-2 text-center">
        <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">{title}</p>
        <p className={`font-black text-[#1e1e1e] ${compact ? "text-3xl" : "text-5xl"}`}>{formatPercent(percent)}</p>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </div>

      <div style={{ width: "100%", height }}>
        <ResponsiveContainer>
          <RadialBarChart
            data={chartData}
            innerRadius={innerRadius}
            outerRadius={outerRadius}
            startAngle={180}
            endAngle={0}
            cy="88%"
          >
            <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
            <RadialBar
              dataKey="value"
              background={{ fill: theme.grayLine }}
              cornerRadius={10}
              fill={theme.yellowDeep}
            />
          </RadialBarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function SummaryCard({
  title,
  value,
  icon,
  tone = "default",
}: {
  title: string;
  value: string;
  icon: React.ReactNode;
  tone?: "default" | "yellow";
}) {
  return (
    <div className="flex items-center gap-3 rounded-[1.2rem] border border-black/10 bg-white p-4 shadow-[0_8px_18px_rgba(0,0,0,0.08)]">
      <div
        className={`grid h-11 w-11 place-items-center rounded-xl ${
          tone === "yellow" ? "bg-[#fff2a3] text-black" : "bg-[#ececec] text-[#2f2f2f]"
        }`}
      >
        {icon}
      </div>
      <div>
        <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">{title}</p>
        <p className="text-2xl font-black text-[#1f1f1f]">{value}</p>
      </div>
    </div>
  );
}

function PriorityList({
  title,
  items,
  emptyText,
}: {
  title: string;
  items: Array<AnnexureTableRow & { annexureName: string; sectionName: string }>;
  emptyText: string;
}) {
  return (
    <Card className="rounded-[1.4rem] border border-black/10 bg-white shadow-[0_8px_20px_rgba(0,0,0,0.08)]">
      <CardHeader className="pb-3">
        <div className="rounded-lg bg-[#ececec] px-3 py-2 text-center text-sm font-semibold text-[#222]">
          {title}
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">{emptyText}</p>
        ) : (
          items.map((item) => (
            <div key={item.id} className="rounded-xl border border-black/8 bg-[#fafafa] p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[#222]">{item.requirements || "Untitled row"}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {item.sectionName} / {item.annexureName}
                  </p>
                  <p className="mt-1 text-xs text-[#575757]">{item.latestRemark || "No latest remark"}</p>
                </div>
                <StatusBadge status={item.status ?? "active"} />
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const [sections, setSections] = useState<Section[]>([]);
  const [annexures, setAnnexures] = useState<Annexure[]>([]);
  const [rowsByAnnexure, setRowsByAnnexure] = useState<Record<string, AnnexureTableRow[]>>({});
  const [loadingSections, setLoadingSections] = useState(true);
  const [loadingAnnexures, setLoadingAnnexures] = useState(true);
  const [loadingRows, setLoadingRows] = useState(true);

  useEffect(() => {
    const unsubscribe = subscribeSections(
      (data) => {
        setSections(data);
        setLoadingSections(false);
      },
      () => {
        setLoadingSections(false);
        toast.error("Unable to load sections");
      },
    );

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeAllAnnexures(
      (data) => {
        setAnnexures(data);
        setLoadingAnnexures(false);
      },
      () => {
        setLoadingAnnexures(false);
        toast.error("Unable to load annexures");
      },
    );

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    let active = true;

    const loadRows = async () => {
      if (annexures.length === 0) {
        setRowsByAnnexure({});
        setLoadingRows(false);
        return;
      }

      setLoadingRows(true);

      try {
        const results = await Promise.allSettled(
          annexures.map(async (annexure) => {
            const rows = await getAnnexureStatusRows(annexure.id);
            return [annexure.id, rows] as const;
          }),
        );

        if (!active) {
          return;
        }

        const entries = results
          .filter(
            (
              result,
            ): result is PromiseFulfilledResult<readonly [string, AnnexureTableRow[]]> =>
              result.status === "fulfilled",
          )
          .map((result) => result.value);

        setRowsByAnnexure(Object.fromEntries(entries));

        if (entries.length < annexures.length) {
          toast.error("Some annexure progress rows could not be loaded");
        }
      } catch {
        if (!active) {
          return;
        }
        toast.error("Unable to load annexure progress");
      } finally {
        if (active) {
          setLoadingRows(false);
        }
      }
    };

    loadRows();

    return () => {
      active = false;
    };
  }, [annexures]);

  const sectionNameById = useMemo(() => buildSectionNameMap(sections), [sections]);

  const annexureSummaries = useMemo(() => {
    return annexures.map((annexure) => {
      const rows = rowsByAnnexure[annexure.id] ?? [];
      const completedRows = rows.filter((row) => row.currentStatus === "completed").length;
      const pendingRows = rows.filter((row) => row.currentStatus === "pending").length;
      const underReviewRows = rows.filter((row) => row.currentStatus === "under review").length;
      const progress = rows.length === 0 ? 0 : Math.round((completedRows / rows.length) * 100);

      return {
        ...annexure,
        rows,
        completedRows,
        pendingRows,
        underReviewRows,
        progress,
        sectionName: sectionNameById[annexure.sectionId] ?? "Unknown section",
      };
    });
  }, [annexures, rowsByAnnexure, sectionNameById]);

  const sectionSummaries = useMemo(() => {
    return sections.map((section) => {
      const sectionAnnexures = annexureSummaries.filter((item) => item.sectionId === section.id);
      const progress =
        sectionAnnexures.length === 0
          ? 0
          : Math.round(sectionAnnexures.reduce((acc, item) => acc + item.progress, 0) / sectionAnnexures.length);

      const completedAnnexures = sectionAnnexures.filter((item) => item.progress === 100).length;
      const pendingAnnexures = sectionAnnexures.filter((item) => item.progress < 100).length;

      return {
        section,
        sectionAnnexures,
        progress,
        completedAnnexures,
        pendingAnnexures,
      };
    });
  }, [annexureSummaries, sections]);

  const overallStats = useMemo(() => {
    const allRows = annexureSummaries.flatMap((item) => item.rows);
    const completedRows = allRows.filter((row) => row.currentStatus === "completed").length;
    const overallProgress = allRows.length === 0 ? 0 : Math.round((completedRows / allRows.length) * 100);

    return {
      sections: sections.length,
      annexures: annexures.length,
      rows: allRows.length,
      completedRows,
      overallProgress,
    };
  }, [annexureSummaries, annexures.length, sections.length]);

  const rowEntries = useMemo(() => {
    return annexureSummaries.flatMap((annexure) => {
      return annexure.rows.map((row) => ({
        ...row,
        annexureName: annexure.name,
        sectionName: annexure.sectionName,
      }));
    });
  }, [annexureSummaries]);

  const highPriorityItems = useMemo(() => {
    return rowEntries
      .filter((row) => row.currentStatus === "under review" || row.status === "disabled")
      .slice(0, 5);
  }, [rowEntries]);

  const notInitiatedItems = useMemo(() => {
    return rowEntries.filter((row) => row.currentStatus === "pending").slice(0, 5);
  }, [rowEntries]);

  const loading = loadingSections || loadingAnnexures || loadingRows;

  const statusDistribution = useMemo(() => {
    const allRows = annexureSummaries.flatMap((item) => item.rows);
    const counts = {
      completed: allRows.filter((row) => row.currentStatus === "completed").length,
      underReview: allRows.filter((row) => row.currentStatus === "under review").length,
      pending: allRows.filter((row) => row.currentStatus === "pending").length,
    };

    return [
      { name: "Completed", value: counts.completed, color: theme.yellowDeep },
      { name: "Under Review", value: counts.underReview, color: theme.grayMid },
      { name: "Pending", value: counts.pending, color: "#b5b5b5" },
    ];
  }, [annexureSummaries]);

  const sectionProgressBars = useMemo(() => {
    return sectionSummaries.map((item) => ({
      name: item.section.name,
      progress: item.progress,
    }));
  }, [sectionSummaries]);

  return (
    <div
      className="space-y-6 rounded-[2rem] p-4 sm:p-6"
      style={{
        backgroundImage:
          "linear-gradient(to right, rgba(0,0,0,0.04) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,0,0,0.04) 1px, transparent 1px)",
        backgroundSize: "24px 24px",
        backgroundColor: theme.graySoft,
      }}
    >
      <section className="rounded-[1.4rem] border border-black/10 bg-linear-to-r from-[#8b8b8b] to-[#bdbdbd] px-6 py-4 shadow-[0_12px_24px_rgba(0,0,0,0.08)]">
        <h2 className="text-center text-2xl font-black uppercase tracking-[0.16em] text-[#ffe600]">Dashboard</h2>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
        <Card className="rounded-[1.6rem] border border-black/10 bg-white shadow-[0_10px_24px_rgba(0,0,0,0.08)]">
          <CardHeader>
            <CardTitle className="text-base font-semibold text-[#222]">Overall %age Progress at centre</CardTitle>
            <p className="text-sm text-muted-foreground">Individual section wise %age progress</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <SemiGauge
              value={overallStats.overallProgress}
              title="Overall Progress"
              subtitle={`${overallStats.completedRows} of ${overallStats.rows} rows completed`}
            />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <SummaryCard title="Sections" value={String(overallStats.sections)} icon={<Layers3 className="size-5" />} />
              <SummaryCard title="Annexures" value={String(overallStats.annexures)} icon={<ClipboardList className="size-5" />} />
              <SummaryCard title="Rows" value={String(overallStats.rows)} icon={<AlertTriangle className="size-5" />} tone="yellow" />
              <SummaryCard title="Completed" value={String(overallStats.completedRows)} icon={<ShieldCheck className="size-5" />} />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[1.6rem] border border-black/10 bg-white shadow-[0_10px_24px_rgba(0,0,0,0.08)]">
          <CardHeader>
            <CardTitle className="text-base font-semibold text-[#222]">Current Status Mix</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={statusDistribution}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={70}
                    outerRadius={105}
                    paddingAngle={3}
                  >
                    {statusDistribution.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value, name) => [String(value ?? 0), name]}
                    contentStyle={{ borderRadius: 12, borderColor: theme.grayLine }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="grid gap-2">
              {statusDistribution.map((entry) => (
                <div key={entry.name} className="flex items-center justify-between rounded-lg border border-black/8 px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full" style={{ backgroundColor: entry.color }} />
                    <span className="text-sm text-[#222]">{entry.name}</span>
                  </div>
                  <span className="text-sm font-semibold text-[#222]">{entry.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <section className="grid gap-4 xl:grid-cols-2">
        <PriorityList
          title="High Priority and Exception Items"
          items={highPriorityItems}
          emptyText="No delayed items. High-priority rows will appear here."
        />
        <PriorityList
          title="Items Not Yet Initiated"
          items={notInitiatedItems}
          emptyText="No pending rows found."
        />
      </section>

      <section className="space-y-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-[0.22em] text-[#444]">Section wise %age progress</h3>
            <p className="text-sm text-muted-foreground">Based on annexure completion across each section</p>
          </div>
          {loading ? <p className="text-sm text-muted-foreground">Loading dashboard...</p> : null}
        </div>

        <Card className="rounded-[1.6rem] border border-black/10 bg-white shadow-[0_10px_24px_rgba(0,0,0,0.08)]">
          <CardContent className="pt-6">
            <div className="h-80">
              <ResponsiveContainer>
                <BarChart data={sectionProgressBars} margin={{ top: 8, right: 14, left: 0, bottom: 42 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={theme.grayLine} />
                  <XAxis
                    dataKey="name"
                    angle={-20}
                    textAnchor="end"
                    height={56}
                    interval={0}
                    tick={{ fontSize: 11, fill: theme.grayDark }}
                  />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: theme.grayDark }} />
                  <Tooltip
                    formatter={(value) => [`${String(value ?? 0)}%`, "Progress"]}
                    contentStyle={{ borderRadius: 12, borderColor: theme.grayLine }}
                  />
                  <Bar dataKey="progress" radius={[6, 6, 0, 0]} fill={theme.yellowDeep} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {sectionSummaries.map(({ section, progress, sectionAnnexures, completedAnnexures, pendingAnnexures }) => (
          <Card key={section.id} className="rounded-[1.4rem] border border-black/10 bg-white shadow-[0_8px_20px_rgba(0,0,0,0.08)]">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-bold text-[#222]">{section.name}</CardTitle>
              <p className="text-xs text-muted-foreground">
                {sectionAnnexures.length} annexure(s) • {completedAnnexures} complete • {pendingAnnexures} pending
              </p>
            </CardHeader>
            <CardContent>
              <SemiGauge value={progress} title="Completion" subtitle="Section-wise gauge" compact />
            </CardContent>
          </Card>
        ))}

        {!loading && sectionSummaries.length === 0 ? (
          <div className="rounded-[1.4rem] border border-dashed border-black/15 bg-white p-6 text-sm text-muted-foreground">
            No sections found.
          </div>
        ) : null}
      </section>
    </div>
  );
}
