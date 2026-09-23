import React, { useMemo, useState } from "react";
import {
  Activity,
  AlertCircle,
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  Clock3,
  FileText,
  Phone,
  RotateCcw,
  Search,
  UserCheck,
  UserPlus,
  UserRound,
  UserX,
  Users,
  XCircle,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

const PERIODS = [
  { key: "7d", label: "7 Days", days: 7 },
  { key: "1m", label: "1 Month", days: 30 },
  { key: "3m", label: "3 Months", days: 90 },
  { key: "6m", label: "6 Months", days: 180 },
];

const GRACE_DAYS = 15;

function startOfWeek(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

function toMs(value) {
  if (value == null) return 0;
  if (typeof value === "number") return value < 100000000000 ? value * 1000 : value;
  const n = new Date(value).getTime();
  return Number.isFinite(n) ? n : 0;
}

function latestVisit(patient) {
  const visits = patient?.visits || [];
  if (!visits.length) return null;
  return [...visits].sort((a, b) => toMs(b.ts || b.date || b.created_at) - toMs(a.ts || a.date || a.created_at))[0];
}

function visitTime(visit) {
  return toMs(visit?.ts || visit?.date || visit?.created_at);
}

function formatDate(value) {
  const ms = toMs(value);
  if (!ms) return "—";
  return new Date(ms).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function shortDate(value) {
  const ms = toMs(value);
  if (!ms) return "—";
  return new Date(ms).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
  });
}

function getComplaint(patient) {
  const v = latestVisit(patient);
  return v?.complaint || v?.diagnosis || "No complaint recorded";
}

function getDueInfo(patient, nowMs) {
  if (!patient || patient.status !== "open") {
    return { state: "not-open", dueMs: 0, overdueDays: 0, daysUntilDue: 0 };
  }

  const v = latestVisit(patient);
  if (!v) return { state: "no-visit", dueMs: 0, overdueDays: 0, daysUntilDue: 0 };

  const duration = Number(v.duration_days);
  const ts = visitTime(v);

  if (!ts || !Number.isFinite(duration) || duration <= 0) {
    return { state: "no-followup", dueMs: 0, overdueDays: 0, daysUntilDue: 0 };
  }

  const dueMs = ts + duration * 24 * 60 * 60 * 1000;
  const diffDays = Math.floor((nowMs - dueMs) / (24 * 60 * 60 * 1000));

  if (diffDays > GRACE_DAYS) {
    return { state: "lost-derived", dueMs, overdueDays: diffDays, daysUntilDue: -diffDays };
  }
  if (diffDays > 0) {
    return { state: "overdue", dueMs, overdueDays: diffDays, daysUntilDue: -diffDays };
  }
  if (diffDays >= -3) {
    return { state: "due-soon", dueMs, overdueDays: 0, daysUntilDue: Math.abs(diffDays) };
  }
  return { state: "running", dueMs, overdueDays: 0, daysUntilDue: Math.abs(diffDays) };
}

function getLifecycle(patient, nowMs) {
  if (patient.status === "lost") return "lost";
  if (patient.status === "closed") return "closed";
  if (patient.status === "open") {
    const due = getDueInfo(patient, nowMs);
    if (due.state === "lost-derived") return "lost";
    if (due.state === "overdue") return "overdue";
    if (due.state === "due-soon") return "due-soon";
    if (due.state === "no-followup") return "no-followup";
    return "running";
  }
  return "unknown";
}

function initials(name = "") {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((x) => x[0]?.toUpperCase() || "")
    .join("") || "?";
}

function matchesSearch(patient, q) {
  if (!q) return true;
  const latest = latestVisit(patient);
  const haystack = [
    patient.name,
    patient.contact,
    patient.phone,
    patient.serial_no,
    patient.id,
    latest?.complaint,
    latest?.diagnosis,
    latest?.medicines,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return haystack.includes(q.toLowerCase());
}

export default function PatientsAnalyticsView({ patients = [], onSelect }) {
  const [period, setPeriod] = useState("1m");
  const [search, setSearch] = useState("");
  const [view, setView] = useState("overview");

  const nowMs = Date.now();
  const periodDef = PERIODS.find((p) => p.key === period) || PERIODS[1];
  const cutoff = nowMs - periodDef.days * 24 * 60 * 60 * 1000;

  const enriched = useMemo(
    () =>
      patients.map((p) => ({
        patient: p,
        latest: latestVisit(p),
        lifecycle: getLifecycle(p, nowMs),
        due: getDueInfo(p, nowMs),
      })),
    [patients, nowMs]
  );

  const stats = useMemo(() => {
    const totalPatients = patients.length;
    const running = enriched.filter((x) => x.lifecycle === "running").length;
    const dueSoon = enriched.filter((x) => x.lifecycle === "due-soon").length;
    const overdue = enriched.filter((x) => x.lifecycle === "overdue").length;
    const lost = enriched.filter((x) => x.lifecycle === "lost").length;
    const closed = enriched.filter((x) => x.lifecycle === "closed").length;
    const noFollowup = enriched.filter((x) => x.lifecycle === "no-followup").length;
    const returning = patients.filter((p) => (p.visits || []).length > 1).length;
    const newPatients = patients.filter((p) => (p.visits || []).length === 1).length;
    const active = enriched.filter((x) => x.lifecycle === "running" || x.lifecycle === "due-soon").length;
    const attention = dueSoon + overdue + noFollowup;

    const periodPatientIds = new Set();
    patients.forEach((p) =>
      (p.visits || []).forEach((v) => {
        if (visitTime(v) >= cutoff) periodPatientIds.add(p.id);
      })
    );

    let newInPeriod = 0;
    let returningInPeriod = 0;
    periodPatientIds.forEach((id) => {
      const p = patients.find((x) => x.id === id);
      const visits = p?.visits || [];
      if (!visits.length) return;
      const first = Math.min(...visits.map(visitTime).filter(Boolean));
      if (first >= cutoff) newInPeriod += 1;
      else returningInPeriod += 1;
    });

    const lostInPeriod = patients.filter(
      (p) =>
        (p.status === "lost" && p.lost_at && toMs(p.lost_at) >= cutoff) ||
        (p.status !== "lost" && getLifecycle(p, nowMs) === "lost" && latestVisit(p) && visitTime(latestVisit(p)) >= cutoff)
    ).length;

    const closedInPeriod = patients.filter(
      (p) =>
        p.status === "closed" &&
        (p.visits || []).some((v) => visitTime(v) >= cutoff)
    ).length;

    const withVisits = patients.filter((p) => (p.visits || []).length > 0).length;
    const multiple = patients.filter((p) => (p.visits || []).length > 1).length;
    const totalVisits = patients.reduce((s, p) => s + (p.visits || []).length, 0);

    return {
      totalPatients,
      running,
      dueSoon,
      overdue,
      lost,
      closed,
      noFollowup,
      returning,
      newPatients,
      active,
      attention,
      newInPeriod,
      returningInPeriod,
      lostInPeriod,
      closedInPeriod,
      returnRate: withVisits ? Math.round((multiple / withVisits) * 100) : 0,
      lostRate: totalPatients ? Math.round((lost / totalPatients) * 100) : 0,
      avgVisits: withVisits ? (totalVisits / withVisits).toFixed(1) : "0",
    };
  }, [patients, enriched, cutoff, nowMs]);

  const weeks = useMemo(() => {
    const now = new Date(nowMs);
    const result = [];

    for (let i = 7; i >= 0; i -= 1) {
      const weekStart = startOfWeek(now);
      weekStart.setDate(weekStart.getDate() - i * 7);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 7);

      const ids = new Set();
      patients.forEach((p) => {
        (p.visits || []).forEach((v) => {
          const t = visitTime(v);
          if (t >= weekStart.getTime() && t < weekEnd.getTime()) ids.add(p.id);
        });
      });

      result.push({
        label: weekStart.toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
        patients: ids.size,
      });
    }
    return result;
  }, [patients, nowMs]);

  const searchResults = useMemo(
    () =>
      enriched
        .filter((x) => matchesSearch(x.patient, search))
        .sort((a, b) => (b.due.overdueDays || 0) - (a.due.overdueDays || 0)),
    [enriched, search]
  );

  const lists = useMemo(
    () => ({
      running: enriched.filter((x) => x.lifecycle === "running"),
      due: enriched.filter((x) => x.lifecycle === "due-soon"),
      overdue: enriched.filter((x) => x.lifecycle === "overdue"),
      lost: enriched.filter((x) => x.lifecycle === "lost"),
      closed: enriched.filter((x) => x.lifecycle === "closed"),
      returning: enriched.filter((x) => (x.patient.visits || []).length > 1),
      new: enriched.filter((x) => (x.patient.visits || []).length === 1),
      noFollowup: enriched.filter((x) => x.lifecycle === "no-followup"),
      attention: enriched.filter((x) =>
        ["due-soon", "overdue", "no-followup"].includes(x.lifecycle)
      ),
    }),
    [enriched]
  );

  const listConfig = {
    attention: {
      title: "Needs Attention",
      subtitle: "Patients who may need a follow-up action",
      icon: <AlertCircle size={17} />,
    },
    running: {
      title: "Running Patients",
      subtitle: "Currently active treatment cases",
      icon: <Activity size={17} />,
    },
    due: {
      title: "Due Soon",
      subtitle: "Due today or within the next 3 days",
      icon: <CalendarClock size={17} />,
    },
    overdue: {
      title: "Overdue",
      subtitle: "Follow-up window has passed",
      icon: <Clock3 size={17} />,
    },
    returning: {
      title: "Returning Patients",
      subtitle: "Patients with more than one recorded visit",
      icon: <RotateCcw size={17} />,
    },
    new: {
      title: "New Patients",
      subtitle: "Patients with one recorded visit",
      icon: <UserPlus size={17} />,
    },
    lost: {
      title: "Lost Patients",
      subtitle: "Stored as lost or beyond the follow-up grace window",
      icon: <UserX size={17} />,
    },
    closed: {
      title: "Closed Patients",
      subtitle: "Cases marked closed",
      icon: <CheckCircle2 size={17} />,
    },
    noFollowup: {
      title: "No Follow-up Set",
      subtitle: "Open cases without a usable treatment duration",
      icon: <XCircle size={17} />,
    },
  };

  const openList = (key) => setView(key);
  const goBack = () => setView("overview");

  return (
    <div className="pb-6">
      {view !== "overview" ? (
        <PatientList
          title={listConfig[view]?.title || "Patients"}
          subtitle={listConfig[view]?.subtitle}
          icon={listConfig[view]?.icon}
          items={lists[view] || []}
          search={search}
          setSearch={setSearch}
          onBack={goBack}
          onSelect={onSelect}
        />
      ) : (
        <>
          <div className="bg-white rounded-2xl p-4 shadow-sm mb-4">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div>
                <p className="text-lg font-bold" style={{ color: "#0A5C54" }}>
                  Patient Management
                </p>
                <p className="text-[11px]" style={{ color: "#0A5C5499" }}>
                  Turn patient data into daily management actions.
                </p>
              </div>
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: "#E8F7F4", color: "#148A7A" }}
              >
                <Users size={19} />
              </div>
            </div>

            <div
              className="flex items-center gap-2 rounded-xl px-3 py-2.5"
              style={{ background: "#F4FAF9", border: "1px solid #14B8A622" }}
            >
              <Search size={16} style={{ color: "#148A7A" }} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search patient, phone, complaint..."
                className="flex-1 bg-transparent outline-none text-sm"
                style={{ color: "#0A5C54" }}
              />
              {search && (
                <button onClick={() => setSearch("")} style={{ color: "#0A5C5499" }}>
                  <XCircle size={16} />
                </button>
              )}
            </div>

            {search && (
              <div className="mt-3">
                <p className="text-[10px] font-semibold uppercase tracking-wide mb-2" style={{ color: "#148A7A" }}>
                  Search results · {searchResults.length}
                </p>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {searchResults.slice(0, 12).map((x) => (
                    <PatientRow
                      key={x.patient.id}
                      item={x}
                      onSelect={onSelect}
                    />
                  ))}
                  {!searchResults.length && (
                    <p className="text-xs py-4 text-center" style={{ color: "#0A5C5499" }}>
                      No patient found.
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <MetricCard
              label="Running"
              value={stats.running}
              icon={<Activity size={14} />}
              onClick={() => openList("running")}
            />
            <MetricCard
              label="Needs attention"
              value={stats.attention}
              icon={<AlertCircle size={14} />}
              danger={stats.attention > 0}
              onClick={() => openList("attention")}
            />
            <MetricCard
              label="Returning"
              value={stats.returning}
              icon={<RotateCcw size={14} />}
              onClick={() => openList("returning")}
            />
            <MetricCard
              label="New"
              value={stats.newPatients}
              icon={<UserPlus size={14} />}
              onClick={() => openList("new")}
            />
          </div>

          <div
            className="bg-white rounded-2xl p-4 shadow-sm mb-4"
            style={{ border: stats.attention ? "1px solid #F59E0B33" : "1px solid #14B8A61A" }}
          >
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-sm font-bold" style={{ color: "#0A5C54" }}>
                  Needs Attention
                </p>
                <p className="text-[10px]" style={{ color: "#0A5C5499" }}>
                  Actual patient names, not just counts.
                </p>
              </div>
              <button
                onClick={() => openList("attention")}
                className="text-[11px] font-semibold"
                style={{ color: "#148A7A" }}
              >
                View all
              </button>
            </div>

            {lists.attention.slice(0, 5).map((x) => (
              <PatientRow key={x.patient.id} item={x} onSelect={onSelect} />
            ))}

            {!lists.attention.length && (
              <div className="rounded-xl p-4 text-center" style={{ background: "#F4FAF9" }}>
                <CheckCircle2 size={22} className="mx-auto mb-1" style={{ color: "#148A7A" }} />
                <p className="text-xs font-semibold" style={{ color: "#0A5C54" }}>
                  No immediate follow-up issue detected
                </p>
              </div>
            )}
          </div>

          <SectionTitle text="Patient lifecycle" />

          <div className="grid grid-cols-2 gap-2.5 mb-5">
            <LifecycleCard label="Due soon" value={stats.dueSoon} color="#B45309" onClick={() => openList("due")} />
            <LifecycleCard label="Overdue" value={stats.overdue} color="#DC2626" onClick={() => openList("overdue")} />
            <LifecycleCard label="Lost" value={stats.lost} color="#DC2626" onClick={() => openList("lost")} />
            <LifecycleCard label="Closed" value={stats.closed} color="#148A7A" onClick={() => openList("closed")} />
            <LifecycleCard label="No follow-up" value={stats.noFollowup} color="#7C3AED" onClick={() => openList("noFollowup")} />
            <LifecycleCard label="All patients" value={stats.totalPatients} color="#0A5C54" onClick={() => setSearch("")} />
          </div>

          <SectionTitle text="Management snapshot" />

          <div className="bg-white rounded-2xl p-4 shadow-sm mb-5">
            <ManagementLine
              label="Active treatment"
              value={`${stats.active} patients`}
              hint="Running + due soon"
            />
            <ManagementLine
              label="Follow-up attention"
              value={`${stats.attention} patients`}
              hint="Due, overdue or no follow-up"
              danger={stats.attention > 0}
            />
            <ManagementLine
              label="Returning base"
              value={`${stats.returning} patients`}
              hint="2+ recorded visits"
            />
            <ManagementLine
              label="Lost / inactive"
              value={`${stats.lost} patients`}
              hint={`${stats.lostRate}% of all patients`}
              danger={stats.lost > 0}
            />
          </div>

          <div className="bg-white rounded-2xl p-4 shadow-sm mb-5">
            <div className="flex items-center justify-between gap-2 mb-3">
              <div>
                <p className="text-sm font-bold" style={{ color: "#0A5C54" }}>
                  Patient analytics
                </p>
                <p className="text-[10px]" style={{ color: "#0A5C5499" }}>
                  Choose a period for acquisition and retention analysis.
                </p>
              </div>
              <Activity size={17} style={{ color: "#148A7A" }} />
            </div>

            <div className="flex gap-1.5 mb-4 bg-white/60 rounded-xl p-1 overflow-x-auto">
              {PERIODS.map((p) => (
                <button
                  key={p.key}
                  onClick={() => setPeriod(p.key)}
                  className="flex-1 py-2 rounded-lg text-xs font-semibold transition whitespace-nowrap"
                  style={{
                    background:
                      period === p.key
                        ? "linear-gradient(135deg, #148A7A, #0A5C54)"
                        : "transparent",
                    color: period === p.key ? "white" : "#0A5C54",
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <MiniStat label="New patients" value={stats.newInPeriod} icon={<UserPlus size={13} />} />
              <MiniStat label="Returning" value={stats.returningInPeriod} icon={<RotateCcw size={13} />} />
              <MiniStat label="Closed cases" value={stats.closedInPeriod} icon={<CheckCircle2 size={13} />} />
              <MiniStat label="Lost" value={stats.lostInPeriod} icon={<UserX size={13} />} danger />
            </div>

            <p className="text-xs font-semibold mb-3" style={{ color: "#0A5C54" }}>
              Weekly patient trend · last 8 weeks
            </p>

            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={weeks} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#14B8A633" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 9, fill: "#0A5C5499" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "#0A5C5499" }}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  formatter={(v) => [v, "Patients"]}
                  contentStyle={{
                    borderRadius: 10,
                    border: "1px solid #14B8A655",
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="patients" radius={[6, 6, 0, 0]} fill="#148A7A" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <SectionTitle text="Lifetime intelligence" />

          <div className="bg-white rounded-2xl p-4 shadow-sm mb-4">
            <InfoRow label="Total patients ever" value={stats.totalPatients} icon={<Users size={13} />} />
            <InfoRow label="Currently open" value={stats.running + stats.dueSoon + stats.overdue + stats.noFollowup} />
            <InfoRow label="Closed" value={stats.closed} />
            <InfoRow label="Lost" value={stats.lost} color={stats.lost > 0 ? "#DC2626" : undefined} />
            <InfoRow label="Average visits per patient" value={stats.avgVisits} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <MiniStat
              label="Return rate"
              value={`${stats.returnRate}%`}
              icon={<Activity size={13} />}
              helper="Patients with 2+ visits"
            />
            <MiniStat
              label="Lost rate"
              value={`${stats.lostRate}%`}
              icon={<UserX size={13} />}
              danger
              helper="Of all patients ever"
            />
          </div>
        </>
      )}
    </div>
  );
}

function PatientList({ title, subtitle, icon, items, search, setSearch, onBack, onSelect }) {
  const filtered = items.filter((x) => matchesSearch(x.patient, search));

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <button
          onClick={onBack}
          className="w-9 h-9 rounded-xl bg-white shadow-sm flex items-center justify-center"
          style={{ color: "#0A5C54" }}
        >
          <ArrowLeft size={17} />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-1.5">
            <span style={{ color: "#148A7A" }}>{icon}</span>
            <p className="font-bold text-base" style={{ color: "#0A5C54" }}>{title}</p>
          </div>
          <p className="text-[10px]" style={{ color: "#0A5C5499" }}>{subtitle}</p>
        </div>
        <span className="text-xs font-bold px-2 py-1 rounded-lg" style={{ background: "#E8F7F4", color: "#0A5C54" }}>
          {filtered.length}
        </span>
      </div>

      <div
        className="flex items-center gap-2 rounded-xl px-3 py-2.5 mb-3"
        style={{ background: "#F4FAF9", border: "1px solid #14B8A622" }}
      >
        <Search size={15} style={{ color: "#148A7A" }} />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search in this list..."
          className="flex-1 bg-transparent outline-none text-sm"
          style={{ color: "#0A5C54" }}
        />
      </div>

      <div className="space-y-2">
        {filtered.map((x) => (
          <PatientRow key={x.patient.id} item={x} onSelect={onSelect} />
        ))}
        {!filtered.length && (
          <div className="bg-white rounded-2xl p-6 text-center shadow-sm">
            <UserRound size={24} className="mx-auto mb-2" style={{ color: "#148A7A" }} />
            <p className="text-xs font-semibold" style={{ color: "#0A5C54" }}>No patients in this list.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function PatientRow({ item, onSelect }) {
  const { patient, latest, lifecycle, due } = item;
  const visits = patient.visits || [];

  const badge = {
    running: ["Running", "#148A7A", "#E8F7F4"],
    "due-soon": ["Due soon", "#B45309", "#FFF7E6"],
    overdue: [`${due.overdueDays}d overdue`, "#DC2626", "#FEF2F2"],
    lost: ["Lost", "#DC2626", "#FEF2F2"],
    closed: ["Closed", "#148A7A", "#E8F7F4"],
    "no-followup": ["No follow-up", "#7C3AED", "#F5F3FF"],
  }[lifecycle] || ["Open", "#0A5C54", "#E8F7F4"];

  return (
    <button
      onClick={() => onSelect?.(patient)}
      className="w-full text-left bg-white rounded-xl p-3 shadow-sm flex items-center gap-3 transition"
      style={{ border: "1px solid #14B8A615" }}
    >
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center text-xs font-bold shrink-0"
        style={{ background: "#E8F7F4", color: "#0A5C54" }}
      >
        {initials(patient.name)}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold truncate" style={{ color: "#0A5C54" }}>
            {patient.name || "Unnamed patient"}
          </p>
          <span
            className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full shrink-0"
            style={{ color: badge[1], background: badge[2] }}
          >
            {badge[0]}
          </span>
        </div>

        <p className="text-[10px] truncate mt-0.5" style={{ color: "#0A5C5499" }}>
          {getComplaint(patient)}
        </p>

        <div className="flex items-center gap-3 mt-1.5 text-[9px]" style={{ color: "#0A5C5488" }}>
          <span>Last: {shortDate(latest && visitTime(latest))}</span>
          <span>{visits.length} visit{visits.length === 1 ? "" : "s"}</span>
          {patient.contact && (
            <span className="flex items-center gap-0.5">
              <Phone size={9} /> {patient.contact}
            </span>
          )}
        </div>
      </div>

      <ChevronRight size={16} className="shrink-0" style={{ color: "#0A5C5466" }} />
    </button>
  );
}

function MetricCard({ label, value, icon, onClick, danger }) {
  return (
    <button
      onClick={onClick}
      className="bg-white rounded-2xl p-3.5 shadow-sm text-left"
      style={{ border: danger ? "1px solid #F59E0B33" : "1px solid #14B8A61A" }}
    >
      <div className="flex items-center gap-1.5 mb-1" style={{ color: danger ? "#B45309" : "#148A7A" }}>
        {icon}
        <span className="text-[10px] font-semibold uppercase">{label}</span>
      </div>
      <p className="text-xl font-bold" style={{ color: danger ? "#92400E" : "#0A5C54" }}>
        {value}
      </p>
    </button>
  );
}

function LifecycleCard({ label, value, color, onClick }) {
  return (
    <button
      onClick={onClick}
      className="bg-white rounded-xl p-3 text-left shadow-sm"
      style={{ border: "1px solid #14B8A615" }}
    >
      <p className="text-[10px] font-medium" style={{ color: "#0A5C5499" }}>{label}</p>
      <p className="text-lg font-bold mt-0.5" style={{ color }}>{value}</p>
    </button>
  );
}

function ManagementLine({ label, value, hint, danger }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5 border-b last:border-0" style={{ borderColor: "#14B8A61A" }}>
      <div>
        <p className="text-xs font-semibold" style={{ color: "#0A5C54" }}>{label}</p>
        <p className="text-[10px]" style={{ color: "#0A5C5499" }}>{hint}</p>
      </div>
      <span className="text-xs font-bold" style={{ color: danger ? "#DC2626" : "#148A7A" }}>{value}</span>
    </div>
  );
}

function MiniStat({ label, value, icon, danger, helper }) {
  return (
    <div className="bg-white rounded-2xl p-3.5 shadow-sm" style={{ border: "1px solid #14B8A61A" }}>
      <div className="flex items-center gap-1.5 mb-1" style={{ color: danger ? "#DC2626" : "#148A7A" }}>
        {icon}
        <span className="text-[10px] font-medium uppercase">{label}</span>
      </div>
      <p className="text-xl font-bold" style={{ color: "#0A5C54" }}>{value}</p>
      {helper && <p className="text-[10px] mt-1" style={{ color: "#0A5C5499" }}>{helper}</p>}
    </div>
  );
}

function InfoRow({ label, value, icon, color }) {
  return (
    <div className="flex items-center justify-between text-xs py-1.5 border-b last:border-0" style={{ borderColor: "#14B8A61A" }}>
      <span className="flex items-center gap-1.5" style={{ color: "#0A5C5499" }}>
        {icon}{label}
      </span>
      <span className="font-semibold" style={{ color: color || "#0A5C54" }}>{value}</span>
    </div>
  );
}

function SectionTitle({ text }) {
  return (
    <p className="text-xs mb-2 font-semibold uppercase tracking-wide" style={{ color: "#148A7A" }}>
      {text}
    </p>
  );
}
