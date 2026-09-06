import React, { useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { Users, UserPlus, RotateCcw, UserX, CheckCircle2, Activity } from "lucide-react";

const PERIODS = [
  { key: "7d", label: "7 Days", days: 7 },
  { key: "1m", label: "1 Month", days: 30 },
  { key: "3m", label: "3 Months", days: 90 },
  { key: "6m", label: "6 Months", days: 180 },
];

function startOfWeek(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

export default function PatientsAnalyticsView({ patients }) {
  const [period, setPeriod] = useState("1m");
  const periodDef = PERIODS.find((p) => p.key === period);
  const cutoff = Date.now() - periodDef.days * 24 * 60 * 60 * 1000;

  // ---- Period-specific: new vs returning ----
  const patientIdsInPeriod = new Set();
  patients.forEach((p) => {
    (p.visits || []).forEach((v) => {
      if (v.ts >= cutoff) patientIdsInPeriod.add(p.id);
    });
  });
  let newCount = 0, returningCount = 0;
  patientIdsInPeriod.forEach((id) => {
    const p = patients.find((pp) => pp.id === id);
    const visits = p.visits || [];
    if (visits.length === 0) return;
    const firstVisitTs = Math.min(...visits.map((v) => v.ts));
    if (firstVisitTs >= cutoff) newCount += 1;
    else returningCount += 1;
  });

  // ---- Lost in period ----
  const lostInPeriod = patients.filter((p) => p.status === "lost" && p.lost_at && new Date(p.lost_at).getTime() >= cutoff).length;
  const closedInPeriod = patients.filter((p) => {
    if (p.status !== "closed") return false;
    return (p.visits || []).some((v) => v.ts >= cutoff);
  }).length;

  // ---- Lifetime stats ----
  const totalPatients = patients.length;
  const openCount = patients.filter((p) => p.status === "open").length;
  const closedCount = patients.filter((p) => p.status === "closed").length;
  const lostCount = patients.filter((p) => p.status === "lost").length;
  const patientsWithAnyVisit = patients.filter((p) => (p.visits || []).length > 0).length;
  const patientsWithMultipleVisits = patients.filter((p) => (p.visits || []).length > 1).length;
  const returnRate = patientsWithAnyVisit > 0 ? Math.round((patientsWithMultipleVisits / patientsWithAnyVisit) * 100) : 0;
  const lostRate = totalPatients > 0 ? Math.round((lostCount / totalPatients) * 100) : 0;
  const totalVisitsEver = patients.reduce((s, p) => s + (p.visits || []).length, 0);
  const avgVisitsPerPatient = patientsWithAnyVisit > 0 ? (totalVisitsEver / patientsWithAnyVisit).toFixed(1) : 0;

  // ---- Weekly trend (last 8 weeks, distinct patients per week) ----
  const now = new Date();
  const weeks = [];
  for (let i = 7; i >= 0; i--) {
    const weekStart = new Date(startOfWeek(now));
    weekStart.setDate(weekStart.getDate() - i * 7);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);
    const idsThisWeek = new Set();
    patients.forEach((p) => {
      (p.visits || []).forEach((v) => {
        if (v.ts >= weekStart.getTime() && v.ts < weekEnd.getTime()) idsThisWeek.add(p.id);
      });
    });
    weeks.push({ label: weekStart.toLocaleDateString("en-IN", { day: "numeric", month: "short" }), patients: idsThisWeek.size });
  }

  return (
    <div>
      <div className="flex gap-1.5 mb-4 bg-white/60 rounded-xl p-1 overflow-x-auto">
        {PERIODS.map((p) => (
          <button
            key={p.key}
            onClick={() => setPeriod(p.key)}
            className="flex-1 py-2 rounded-lg text-xs font-semibold transition whitespace-nowrap"
            style={{
              background: period === p.key ? "linear-gradient(135deg, #148A7A, #0A5C54)" : "transparent",
              color: period === p.key ? "white" : "#0A5C54",
            }}
          >
            {p.label}
          </button>
        ))}
      </div>

      <p className="text-xs mb-2 font-semibold uppercase tracking-wide" style={{ color: "#148A7A" }}>This period</p>
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-white rounded-2xl p-3.5 shadow-sm">
          <div className="flex items-center gap-1.5 mb-1" style={{ color: "#148A7A" }}>
            <UserPlus size={13} /><span className="text-[11px] font-medium uppercase">New patients</span>
          </div>
          <p className="text-xl font-bold" style={{ color: "#0A5C54" }}>{newCount}</p>
        </div>
        <div className="bg-white rounded-2xl p-3.5 shadow-sm">
          <div className="flex items-center gap-1.5 mb-1" style={{ color: "#148A7A" }}>
            <RotateCcw size={13} /><span className="text-[11px] font-medium uppercase">Returning</span>
          </div>
          <p className="text-xl font-bold" style={{ color: "#0A5C54" }}>{returningCount}</p>
        </div>
        <div className="bg-white rounded-2xl p-3.5 shadow-sm">
          <div className="flex items-center gap-1.5 mb-1" style={{ color: "#148A7A" }}>
            <CheckCircle2 size={13} /><span className="text-[11px] font-medium uppercase">Closed cases</span>
          </div>
          <p className="text-xl font-bold" style={{ color: "#0A5C54" }}>{closedInPeriod}</p>
        </div>
        <div className="bg-white rounded-2xl p-3.5 shadow-sm">
          <div className="flex items-center gap-1.5 mb-1" style={{ color: "#DC2626" }}>
            <UserX size={13} /><span className="text-[11px] font-medium uppercase">Lost</span>
          </div>
          <p className="text-xl font-bold" style={{ color: "#0A5C54" }}>{lostInPeriod}</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl p-4 shadow-sm mb-4">
        <p className="text-xs font-semibold mb-3" style={{ color: "#0A5C54" }}>Weekly patient trend (last 8 weeks)</p>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={weeks} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#14B8A633" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 9, fill: "#0A5C5499" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: "#0A5C5499" }} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip formatter={(v) => [v, "Patients"]} contentStyle={{ borderRadius: 10, border: "1px solid #14B8A655", fontSize: 12 }} />
            <Bar dataKey="patients" radius={[6, 6, 0, 0]} fill="#148A7A" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <p className="text-xs mb-2 font-semibold uppercase tracking-wide" style={{ color: "#148A7A" }}>Overall (lifetime)</p>
      <div className="bg-white rounded-2xl p-4 shadow-sm mb-4">
        <Row label="Total patients ever" value={totalPatients} icon={<Users size={13} />} />
        <Row label="Currently open" value={openCount} />
        <Row label="Closed" value={closedCount} />
        <Row label="Lost" value={lostCount} color={lostCount > 0 ? "#DC2626" : undefined} />
        <Row label="Average visits per patient" value={avgVisitsPerPatient} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-2xl p-3.5 shadow-sm">
          <div className="flex items-center gap-1.5 mb-1" style={{ color: "#148A7A" }}>
            <Activity size={13} /><span className="text-[11px] font-medium uppercase">Return rate</span>
          </div>
          <p className="text-xl font-bold" style={{ color: "#0A5C54" }}>{returnRate}%</p>
          <p className="text-[10px] mt-1" style={{ color: "#0A5C5499" }}>Of patients who've had a visit, % who came back at least once</p>
        </div>
        <div className="bg-white rounded-2xl p-3.5 shadow-sm">
          <div className="flex items-center gap-1.5 mb-1" style={{ color: "#DC2626" }}>
            <UserX size={13} /><span className="text-[11px] font-medium uppercase">Lost rate</span>
          </div>
          <p className="text-xl font-bold" style={{ color: "#0A5C54" }}>{lostRate}%</p>
          <p className="text-[10px] mt-1" style={{ color: "#0A5C5499" }}>Of all patients ever, % marked lost</p>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, icon, color }) {
  return (
    <div className="flex items-center justify-between text-xs py-1.5 border-b last:border-0" style={{ borderColor: "#14B8A61A" }}>
      <span className="flex items-center gap-1.5" style={{ color: "#0A5C5499" }}>{icon}{label}</span>
      <span className="font-semibold" style={{ color: color || "#0A5C54" }}>{value}</span>
    </div>
  );
}
