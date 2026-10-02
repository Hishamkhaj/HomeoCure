import React, { useMemo, useState } from "react";
import {
  Activity, AlertCircle, ArrowLeft, CalendarClock, CheckCircle2, ChevronRight,
  ChevronLeft, FileText, Phone, RotateCcw, Search, UserCheck, UserPlus, UserRound,
  UserX, Users, XCircle, BarChart3, Pill
} from "lucide-react";

const inputClass = "w-full border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-teal-500 bg-white";

function toMs(value) {
  if (value == null) return 0;
  if (typeof value === "number") return value < 100000000000 ? value * 1000 : value;
  const n = new Date(value).getTime();
  return Number.isFinite(n) ? n : 0;
}

function latestVisit(patient) {
  const visits = patient?.visits || [];
  if (!visits.length) return null;
  return [...visits].sort((a, b) => toMs(b.ts || b.date) - toMs(a.ts || a.date))[0];
}

function firstVisit(patient) {
  const visits = patient?.visits || [];
  if (!visits.length) return null;
  return [...visits].sort((a, b) => toMs(a.ts || a.date) - toMs(b.ts || b.date))[0];
}

function visitTime(visit) {
  return toMs(visit?.ts || visit?.date);
}

function getComplaint(patient) {
  const v = latestVisit(patient);
  return v?.category || v?.complaint || "Uncategorized";
}

function getDueInfo(patient, nowMs) {
  if (!patient || patient.status !== "open") return { overdue: false, days: 0 };
  const v = latestVisit(patient);
  if (!v) return { overdue: false, days: 0 };
  const duration = Number(v.duration_days);
  const ts = visitTime(v);
  if (!ts || !Number.isFinite(duration) || duration <= 0) return { overdue: false, days: 0 };
  
  const dueMs = ts + duration * 24 * 60 * 60 * 1000;
  const diffDays = Math.floor((nowMs - dueMs) / (24 * 60 * 60 * 1000));
  
  if (diffDays > 0) return { overdue: true, days: diffDays }; // Overdue
  return { overdue: false, days: diffDays };
}

function formatMonthYear(dateObj) {
  return dateObj.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
                                                                }
export default function PatientsAnalyticsView({ patients = [], onSelect }) {
  const [activeTab, setActiveTab] = useState("monthly"); // 'monthly', 'categories', 'action'
  const [search, setSearch] = useState("");
  
  const now = new Date();
  const [currentViewDate, setCurrentViewDate] = useState(new Date(now.getFullYear(), now.getMonth(), 1));
  const nowMs = now.getTime();

  // --- LIFETIME STATS ---
  const lifetime = useMemo(() => {
    let total = patients.length;
    let open = 0; let closed = 0; let lost = 0;
    patients.forEach(p => {
      if (p.status === "closed") closed++;
      else if (p.status === "lost") lost++;
      else open++;
    });
    const returnRate = total > 0 ? Math.round((patients.filter(p => (p.visits?.length || 0) > 1).length / total) * 100) : 0;
    const lostRate = total > 0 ? Math.round((lost / total) * 100) : 0;
    
    return { total, open, closed, lost, returnRate, lostRate };
  }, [patients]);

  // --- MONTHLY STATS LOGIC ---
  const monthly = useMemo(() => {
    const monthStart = currentViewDate.getTime();
    const nextMonth = new Date(currentViewDate.getFullYear(), currentViewDate.getMonth() + 1, 1);
    const monthEnd = nextMonth.getTime();

    let newPatientsThisMonth = 0;
    let followupsThisMonth = 0;
    let totalRevenue = 0;

    patients.forEach(p => {
      const visits = p.visits || [];
      if (!visits.length) return;
      
      const fVisitMs = visitTime(firstVisit(p));
      
      // Check every visit of this patient
      visits.forEach(v => {
        const vMs = visitTime(v);
        if (vMs >= monthStart && vMs < monthEnd) {
          totalRevenue += (Number(v.paid_amount) || Number(v.cost) || 0);
          
          // Is this visit their first visit ever?
          if (vMs === fVisitMs) {
            newPatientsThisMonth++;
          } else {
            // It's a follow-up visit (could be originally from Aug, visiting in Sept)
            followupsThisMonth++;
          }
        }
      });
    });

    return { 
      totalVisits: newPatientsThisMonth + followupsThisMonth, 
      newPatients: newPatientsThisMonth, 
      followups: followupsThisMonth, 
      revenue: totalRevenue 
    };
  }, [patients, currentViewDate]);

  // --- CATEGORY STATS LOGIC ---
  const categoryStats = useMemo(() => {
    const map = {};
    patients.forEach(p => {
      if (!p.visits?.length) return;
      const cat = getComplaint(p) || "Other";
      if (!map[cat]) map[cat] = { name: cat, total: 0, open: 0, closed: 0, lost: 0 };
      
      map[cat].total++;
      if (p.status === "closed") map[cat].closed++;
      else if (p.status === "lost") map[cat].lost++;
      else map[cat].open++;
    });
    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [patients]);

  // --- ACTION DESK (OVERDUE) LOGIC ---
  const actionList = useMemo(() => {
    return patients
      .filter(p => p.status === "open")
      .map(p => ({ patient: p, dueInfo: getDueInfo(p, nowMs) }))
      .filter(item => item.dueInfo.overdue)
      .sort((a, b) => b.dueInfo.days - a.dueInfo.days); // Most overdue first
  }, [patients, nowMs]);

  // Handlers for month change
  const prevMonth = () => setCurrentViewDate(new Date(currentViewDate.getFullYear(), currentViewDate.getMonth() - 1, 1));
  const nextMonth = () => setCurrentViewDate(new Date(currentViewDate.getFullYear(), currentViewDate.getMonth() + 1, 1));
        return (
    <div className="pb-8">
      {/* GLOBAL TABS */}
      <div className="flex bg-white p-1.5 rounded-2xl shadow-sm mb-5 border" style={{ borderColor: "#14B8A622" }}>
        <TabButton active={activeTab === "monthly"} onClick={() => setActiveTab("monthly")} icon={<BarChart3 size={15} />} label="Overview" />
        <TabButton active={activeTab === "categories"} onClick={() => setActiveTab("categories")} icon={<Pill size={15} />} label="Diseases" />
        <TabButton active={activeTab === "action"} onClick={() => setActiveTab("action")} icon={<AlertCircle size={15} />} label="Overdue" badge={actionList.length} />
      </div>

      {/* ---------------- TAB 1: OVERVIEW & MONTHLY ---------------- */}
      {activeTab === "monthly" && (
        <div className="space-y-4">
          
          {/* Lifetime Mini-Cards */}
          <div className="grid grid-cols-4 gap-2">
            <MiniStat label="Total" value={lifetime.total} color="#0A5C54" />
            <MiniStat label="Active" value={lifetime.open} color="#B45309" />
            <MiniStat label="Cured" value={lifetime.closed} color="#15803D" />
            <MiniStat label="Lost" value={lifetime.lost} color="#DC2626" />
          </div>

          <div className="grid grid-cols-2 gap-2 mb-2">
             <div className="bg-white p-3 rounded-xl shadow-sm border text-center" style={{ borderColor: "#14B8A61A" }}>
                <p className="text-[10px] font-semibold uppercase text-gray-500 mb-1">Return Rate</p>
                <p className="text-lg font-bold" style={{ color: "#148A7A" }}>{lifetime.returnRate}%</p>
             </div>
             <div className="bg-white p-3 rounded-xl shadow-sm border text-center" style={{ borderColor: "#14B8A61A" }}>
                <p className="text-[10px] font-semibold uppercase text-gray-500 mb-1">Lost Rate</p>
                <p className="text-lg font-bold" style={{ color: "#DC2626" }}>{lifetime.lostRate}%</p>
             </div>
          </div>

          {/* Monthly Dedicated Card */}
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden border" style={{ borderColor: "#14B8A622" }}>
            <div className="flex items-center justify-between p-3.5 border-b" style={{ borderColor: "#14B8A61A", background: "#F4FAF9" }}>
              <button onClick={prevMonth} className="p-1.5 rounded-lg bg-white shadow-sm text-teal-700"><ChevronLeft size={16} /></button>
              <p className="font-bold text-sm" style={{ color: "#0A5C54" }}>{formatMonthYear(currentViewDate)}</p>
              <button onClick={nextMonth} disabled={currentViewDate.getTime() >= new Date(now.getFullYear(), now.getMonth(), 1).getTime()} className="p-1.5 rounded-lg bg-white shadow-sm text-teal-700 disabled:opacity-30"><ChevronRight size={16} /></button>
            </div>
            
            <div className="p-5">
              <div className="text-center mb-6">
                <p className="text-3xl font-black" style={{ color: "#0A5C54" }}>{monthly.totalVisits}</p>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Total Visits this month</p>
              </div>
              
              <div className="grid grid-cols-2 gap-y-4 gap-x-4">
                <div>
                  <p className="text-xs text-gray-500 mb-1">New Patients (Fresh)</p>
                  <p className="text-lg font-bold" style={{ color: "#148A7A" }}>{monthly.newPatients}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Follow-ups (Old Patients)</p>
                  <p className="text-lg font-bold" style={{ color: "#B45309" }}>{monthly.followups}</p>
                </div>
                <div className="col-span-2 pt-3 border-t" style={{ borderColor: "#14B8A61A" }}>
                  <p className="text-xs text-gray-500 mb-1">Estimated Revenue this month</p>
                  <p className="text-xl font-bold" style={{ color: "#15803D" }}>₹{monthly.revenue}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ---------------- TAB 2: DISEASE CATEGORIES ---------------- */}
      {activeTab === "categories" && (
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase text-gray-500 px-1 mb-1">Patient count by disease</p>
          {categoryStats.map((cat, i) => (
            <div key={i} className="bg-white rounded-2xl p-4 shadow-sm border" style={{ borderColor: "#14B8A61A" }}>
              <div className="flex items-center justify-between mb-3">
                <p className="font-bold text-sm" style={{ color: "#0A5C54" }}>{cat.name}</p>
                <span className="text-xs font-black px-2 py-1 rounded bg-teal-50" style={{ color: "#148A7A" }}>{cat.total} cases</span>
              </div>
              
              {/* Visual Bar */}
              <div className="flex h-2 w-full rounded-full overflow-hidden mb-3 bg-gray-100">
                {cat.total > 0 && (
                  <>
                    <div style={{ width: `${(cat.closed/cat.total)*100}%`, background: "#15803D" }}></div>
                    <div style={{ width: `${(cat.open/cat.total)*100}%`, background: "#F59E0B" }}></div>
                    <div style={{ width: `${(cat.lost/cat.total)*100}%`, background: "#DC2626" }}></div>
                  </>
                )}
              </div>
              
              <div className="flex justify-between text-[10px] font-semibold text-gray-500">
                <span style={{ color: "#15803D" }}>{cat.closed} Cured</span>
                <span style={{ color: "#B45309" }}>{cat.open} Active</span>
                <span style={{ color: "#DC2626" }}>{cat.lost} Lost</span>
              </div>
            </div>
          ))}
          {categoryStats.length === 0 && <p className="text-center text-sm py-10 text-gray-400">No categories recorded yet.</p>}
        </div>
      )}
              {/* ---------------- TAB 3: ACTION DESK (OVERDUE) ---------------- */}
      {activeTab === "action" && (
        <div className="space-y-3">
          <div className="bg-red-50 border border-red-100 rounded-xl p-3 flex items-start gap-2 mb-2">
             <AlertCircle size={16} className="text-red-600 shrink-0 mt-0.5" />
             <p className="text-xs text-red-800">
               These patients' medicine has finished, but they haven't returned. Call them for a follow-up or mark them as "Lost".
             </p>
          </div>
          
          {actionList.map(({ patient, dueInfo }) => (
            <button key={patient.id} onClick={() => onSelect?.(patient)} className="w-full text-left bg-white rounded-xl p-3.5 shadow-sm border flex items-center justify-between" style={{ borderColor: "#14B8A61A" }}>
              <div className="min-w-0">
                <p className="text-sm font-bold truncate" style={{ color: "#0A5C54" }}>{patient.name}</p>
                <p className="text-[10px] text-gray-500 truncate mb-1.5">{getComplaint(patient)}</p>
                <div className="flex items-center gap-2">
                  <span className="text-[9px] font-black px-1.5 py-0.5 rounded text-red-700 bg-red-100 uppercase tracking-wide">
                    {dueInfo.days} days overdue
                  </span>
                  {patient.contact && (
                    <span className="text-[10px] flex items-center gap-0.5 font-medium text-teal-700">
                      <Phone size={10} /> {patient.contact}
                    </span>
                  )}
                </div>
              </div>
              <ChevronRight size={16} className="text-gray-400 shrink-0" />
            </button>
          ))}
          
          {actionList.length === 0 && (
            <div className="bg-white rounded-2xl p-6 text-center shadow-sm border" style={{ borderColor: "#14B8A61A" }}>
              <CheckCircle2 size={24} className="mx-auto mb-2 text-green-600" />
              <p className="text-xs font-semibold text-gray-600">All clear! No overdue patients.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// --- HELPER UI COMPONENTS ---
function TabButton({ active, onClick, icon, label, badge }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 flex flex-col items-center justify-center py-2.5 rounded-xl transition relative`}
      style={{
        background: active ? "#148A7A" : "transparent",
        color: active ? "white" : "#0A5C5499",
      }}
    >
      <div className="flex items-center gap-1.5">
        {icon}
        <span className="text-[11px] font-bold">{label}</span>
      </div>
      {badge > 0 && (
        <span className="absolute top-1 right-2 w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-black" style={{ background: active ? "#DC2626" : "#FEE2E2", color: active ? "white" : "#DC2626" }}>
          {badge}
        </span>
      )}
    </button>
  );
}

function MiniStat({ label, value, color }) {
  return (
    <div className="bg-white p-2 rounded-xl shadow-sm border text-center flex flex-col justify-center" style={{ borderColor: "#14B8A61A" }}>
      <p className="text-xl font-black" style={{ color }}>{value}</p>
      <p className="text-[9px] font-semibold uppercase text-gray-500 mt-0.5">{label}</p>
    </div>
  );
}
