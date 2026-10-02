import React, { useMemo, useState } from "react";
import {
  Activity, AlertCircle, ArrowLeft, CheckCircle2, ChevronRight,
  ChevronLeft, Phone, Search, UserRound, Users, XCircle, 
  BarChart3, Pill, Calendar as CalIcon, TrendingUp, TrendingDown, ChevronDown, ListFilter
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
  if (!patient?.visits || !patient.visits.length) return "Uncategorized";
  const visits = [...patient.visits].sort((a, b) => visitTime(b) - visitTime(a));
  
  for (let i = 0; i < visits.length; i++) {
    const text = (visits[i].category || visits[i].complaint || "").trim();
    const lower = text.toLowerCase();
    if (text && lower !== "same" && lower !== "same " && lower !== "same as before") {
      return text.charAt(0).toUpperCase() + text.slice(1);
    }
  }
  return "Uncategorized";
}

function getDueInfo(patient, nowMs) {
  if (!patient || patient.status !== "open") return { overdue: false, days: 0, dueMs: 0 };
  const v = latestVisit(patient);
  if (!v) return { overdue: false, days: 0, dueMs: 0 };
  const duration = Number(v.duration_days);
  const ts = visitTime(v);
  if (!ts || !Number.isFinite(duration) || duration <= 0) return { overdue: false, days: 0, dueMs: 0 };
  
  const dueMs = ts + duration * 24 * 60 * 60 * 1000;
  const diffDays = Math.floor((nowMs - dueMs) / (24 * 60 * 60 * 1000));
  
  if (diffDays > 0) return { overdue: true, days: diffDays, dueMs };
  return { overdue: false, days: diffDays, dueMs };
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function formatMonthYear(dateObj) {
  return dateObj.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
    }
export default function PatientsAnalyticsView({ patients = [], onSelect }) {
  const [activeTab, setActiveTab] = useState("monthly"); 
  const [expandedCategory, setExpandedCategory] = useState(null);
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [expandedList, setExpandedList] = useState(null);
  
  const now = new Date();
  const [currentViewDate, setCurrentViewDate] = useState(new Date(now.getFullYear(), now.getMonth(), 1));
  const [pickerYear, setPickerYear] = useState(now.getFullYear());
  const nowMs = now.getTime();

  const getUnique = (arr) => [...new Map(arr.map(item => [item.id, item])).values()];

  const lifetime = useMemo(() => {
    let open = []; let closed = []; let lost = [];
    patients.forEach(p => {
      if (p.status === "closed") closed.push(p);
      else if (p.status === "lost") lost.push(p);
      else open.push(p);
    });
    const total = patients.length;
    const returnRate = total > 0 ? Math.round((patients.filter(p => (p.visits?.length || 0) > 1).length / total) * 100) : 0;
    const lostRate = total > 0 ? Math.round((lost.length / total) * 100) : 0;
    
    return { all: patients, open, closed, lost, returnRate, lostRate, total };
  }, [patients]);

  const monthly = useMemo(() => {
    const monthStart = currentViewDate.getTime();
    const nextMonth = new Date(currentViewDate.getFullYear(), currentViewDate.getMonth() + 1, 1);
    const monthEnd = nextMonth.getTime();

    let newPatients = []; let sameMonthReturns = []; let oldReturns = [];
    let totalRevenue = 0;
    let closedThisMonth = []; let lostThisMonth = []; let overdueThisMonth = [];

    patients.forEach(p => {
      const visits = p.visits || [];
      if (!visits.length) return;
      
      const fVisitMs = visitTime(firstVisit(p));
      const lVisitMs = visitTime(latestVisit(p));

      visits.forEach(v => {
        const vMs = visitTime(v);
        if (vMs >= monthStart && vMs < monthEnd) {
          totalRevenue += (Number(v.paid_amount) || Number(v.cost) || 0);
          if (vMs === fVisitMs) newPatients.push(p);
          else {
            if (fVisitMs >= monthStart && fVisitMs < monthEnd) sameMonthReturns.push(p);
            else oldReturns.push(p);
          }
        }
      });

      if (lVisitMs >= monthStart && lVisitMs < monthEnd) {
        if (p.status === "closed") closedThisMonth.push(p);
        if (p.status === "lost") lostThisMonth.push(p);
      }

      const dueInfo = getDueInfo(p, nowMs);
      if (p.status === "open" && dueInfo.overdue && dueInfo.dueMs >= monthStart && dueInfo.dueMs < monthEnd) {
        overdueThisMonth.push(p);
      }
    });

    return { 
      totalVisitsCount: getUnique(newPatients).length + getUnique(sameMonthReturns).length + getUnique(oldReturns).length, 
      newPatients: getUnique(newPatients), sameMonthReturns: getUnique(sameMonthReturns), oldReturns: getUnique(oldReturns), 
      revenue: totalRevenue, closedThisMonth: getUnique(closedThisMonth), lostThisMonth: getUnique(lostThisMonth), overdueThisMonth: getUnique(overdueThisMonth)
    };
  }, [patients, currentViewDate, nowMs]);
    const { categoryStats, topCategory, bottomCategory } = useMemo(() => {
    const map = {};
    patients.forEach(p => {
      if (!p.visits?.length) return;
      const cat = getComplaint(p); 
      if (!map[cat]) map[cat] = { name: cat, total: 0, open: 0, closed: 0, lost: 0, patientList: [] };
      
      map[cat].total++;
      if (p.status === "closed") map[cat].closed++;
      else if (p.status === "lost") map[cat].lost++;
      else map[cat].open++;
      map[cat].patientList.push(p); 
    });
    
    const sorted = Object.values(map).sort((a, b) => b.total - a.total);
    return {
      categoryStats: sorted,
      topCategory: sorted.length > 0 ? sorted[0] : null,
      bottomCategory: sorted.length > 1 ? sorted[sorted.length - 1] : null
    };
  }, [patients]);

  const actionList = useMemo(() => {
    return patients
      .filter(p => p.status === "open")
      .map(p => ({ patient: p, dueInfo: getDueInfo(p, nowMs) }))
      .filter(item => item.dueInfo.overdue)
      .sort((a, b) => b.dueInfo.days - a.dueInfo.days); 
  }, [patients, nowMs]);

  const selectMonth = (monthIdx) => {
    setCurrentViewDate(new Date(pickerYear, monthIdx, 1));
    setShowMonthPicker(false);
    setExpandedList(null); 
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setExpandedList(null);
  };

  const toggleList = (title, data) => {
    if (expandedList?.title === title) setExpandedList(null);
    else setExpandedList({ title, data });
  };

  return (
    <div className="pb-8">
      {/* GLOBAL TABS */}
      <div className="flex bg-white p-1.5 rounded-2xl shadow-sm mb-5 border" style={{ borderColor: "#14B8A622" }}>
        <TabButton active={activeTab === "monthly"} onClick={() => handleTabChange("monthly")} icon={<BarChart3 size={15} />} label="Overview" />
        <TabButton active={activeTab === "categories"} onClick={() => handleTabChange("categories")} icon={<Pill size={15} />} label="Diseases" />
        <TabButton active={activeTab === "action"} onClick={() => handleTabChange("action")} icon={<AlertCircle size={15} />} label="Overdue" badge={actionList.length} />
      </div>

      {/* ---------------- TAB 1: OVERVIEW & MONTHLY ---------------- */}
      {activeTab === "monthly" && (
        <div className="space-y-4">
          <div className="grid grid-cols-4 gap-2">
            <MiniStat label="Lifetime" value={lifetime.total} color="#0A5C54" onClick={() => toggleList("All Patients (Lifetime)", lifetime.all)} isActive={expandedList?.title === "All Patients (Lifetime)"} />
            <MiniStat label="Active" value={lifetime.open.length} color="#B45309" onClick={() => toggleList("Active Patients", lifetime.open)} isActive={expandedList?.title === "Active Patients"} />
            <MiniStat label="Closed" value={lifetime.closed.length} color="#15803D" onClick={() => toggleList("Closed Cases", lifetime.closed)} isActive={expandedList?.title === "Closed Cases"} />
            <MiniStat label="Lost" value={lifetime.lost.length} color="#DC2626" onClick={() => toggleList("Lost Patients", lifetime.lost)} isActive={expandedList?.title === "Lost Patients"} />
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
                    {/* DEEP MONTHLY CARD */}
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden border relative" style={{ borderColor: "#14B8A622" }}>
            <div className="flex items-center justify-between p-3.5 border-b" style={{ borderColor: "#14B8A61A", background: "#F4FAF9" }}>
              <button onClick={() => setShowMonthPicker(true)} className="flex items-center gap-2 font-bold text-sm px-3 py-1.5 rounded-lg bg-white shadow-sm border" style={{ color: "#0A5C54", borderColor: "#14B8A622" }}>
                <CalIcon size={14} className="text-teal-600"/> 
                {MONTHS[currentViewDate.getMonth()]} {currentViewDate.getFullYear()}
                <ChevronDown size={14} className="text-gray-400"/>
              </button>
              <div className="text-right">
                <p className="text-[10px] font-semibold text-gray-500 uppercase">Est. Revenue</p>
                <p className="text-sm font-bold text-green-700">₹{monthly.revenue}</p>
              </div>
            </div>
            
            <div className="p-4">
              <div className="text-center mb-5 pb-5 border-b border-dashed" style={{ borderColor: "#14B8A633" }}>
                <p className="text-4xl font-black" style={{ color: "#0A5C54" }}>{monthly.totalVisitsCount}</p>
                <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wide mt-1">Total Visits In {MONTHS[currentViewDate.getMonth()]}</p>
              </div>
              
              <div className="grid grid-cols-2 gap-y-4 gap-x-2 mb-5">
                <StatDetail label="New (Fresh)" value={monthly.newPatients.length} color="#148A7A" onClick={() => toggleList("New Patients", monthly.newPatients)} isActive={expandedList?.title === "New Patients"} />
                <StatDetail label="Same-Month Return" value={monthly.sameMonthReturns.length} color="#B45309" help="Came 2nd time" onClick={() => toggleList("Same-Month Returns", monthly.sameMonthReturns)} isActive={expandedList?.title === "Same-Month Returns"} />
                <StatDetail label="Old Returns" value={monthly.oldReturns.length} color="#7C3AED" help="Previous months" onClick={() => toggleList("Old Returns", monthly.oldReturns)} isActive={expandedList?.title === "Old Returns"} />
                <StatDetail label="Overdue" value={monthly.overdueThisMonth.length} color="#DC2626" help="Missed dates" onClick={() => toggleList("Overdue This Month", monthly.overdueThisMonth)} isActive={expandedList?.title === "Overdue This Month"} />
              </div>

              <div className="flex gap-2 p-2 rounded-xl bg-gray-50 border border-gray-100 justify-around text-center">
                <button onClick={() => toggleList("Closed This Month", monthly.closedThisMonth)} className={`flex-1 p-2 rounded-lg outline-none ${expandedList?.title === "Closed This Month" ? 'bg-white shadow-sm' : ''}`}>
                  <p className="text-[10px] text-gray-500 font-semibold uppercase">Closed</p>
                  <p className="text-sm font-bold text-green-700">{monthly.closedThisMonth.length}</p>
                </button>
                <div className="w-px bg-gray-200 my-2"></div>
                <button onClick={() => toggleList("Lost This Month", monthly.lostThisMonth)} className={`flex-1 p-2 rounded-lg outline-none ${expandedList?.title === "Lost This Month" ? 'bg-white shadow-sm' : ''}`}>
                  <p className="text-[10px] text-gray-500 font-semibold uppercase">Lost</p>
                  <p className="text-sm font-bold text-red-600">{monthly.lostThisMonth.length}</p>
                </button>
              </div>
            </div>
            
            {/* INLINE LIST VIEWER - BUG FULLY FIXED USING <div> */}
            {expandedList && (
              <div className="bg-gray-50 border-t" style={{ borderColor: "#14B8A633" }}>
                <div className="p-3 bg-gray-100 flex items-center justify-between">
                  <div className="flex items-center gap-1.5"><ListFilter size={14} className="text-teal-600"/><p className="text-xs font-bold text-gray-800">{expandedList.title}</p></div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-white text-teal-700 shadow-sm">{expandedList.data.length} patients</span>
                </div>
                <div className="p-3 space-y-2 max-h-64 overflow-y-auto">
                  {expandedList.data.map(pt => (
                    <div 
                      key={pt.id} 
                      onClick={() => onSelect(pt)} 
                      className="w-full text-left flex items-center justify-between p-3 rounded-xl bg-white border border-gray-200 shadow-sm cursor-pointer active:bg-teal-50 transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-gray-800 truncate">{pt.name}</p>
                        <p className="text-[10px] text-gray-500 truncate mt-0.5">{getComplaint(pt)} {pt.contact && `· ${pt.contact}`}</p>
                      </div>
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase shrink-0" style={{ background: pt.status === "closed" ? "#DCFCE7" : pt.status === "lost" ? "#FEE2E2" : "#FEF3C7", color: pt.status === "closed" ? "#15803D" : pt.status === "lost" ? "#DC2626" : "#B45309" }}>{pt.status}</span>
                    </div>
                  ))}
                  {expandedList.data.length === 0 && <p className="text-[11px] text-center py-4 text-gray-400">No patients in this list.</p>}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
            {/* ---------------- TAB 2: DISEASE CATEGORIES ---------------- */}
      {activeTab === "categories" && (
        <div className="space-y-4">
          {topCategory && (
            <div className="grid grid-cols-2 gap-3 mb-2">
              <div className="bg-teal-50 border border-teal-100 rounded-xl p-3">
                <div className="flex items-center gap-1.5 text-teal-800 mb-1"><TrendingUp size={14}/> <span className="text-[10px] font-bold uppercase">Highest</span></div>
                <p className="font-bold text-sm text-teal-950 truncate">{topCategory.name}</p>
                <p className="text-xs text-teal-700">{topCategory.total} cases</p>
              </div>
              {bottomCategory && bottomCategory.name !== topCategory.name && (
                <div className="bg-orange-50 border border-orange-100 rounded-xl p-3">
                  <div className="flex items-center gap-1.5 text-orange-800 mb-1"><TrendingDown size={14}/> <span className="text-[10px] font-bold uppercase">Lowest</span></div>
                  <p className="font-bold text-sm text-orange-950 truncate">{bottomCategory.name}</p>
                  <p className="text-xs text-orange-700">{bottomCategory.total} cases</p>
                </div>
              )}
            </div>
          )}

          {categoryStats.map((cat, i) => (
            <div key={i} className="bg-white rounded-2xl p-4 shadow-sm border transition-all" style={{ borderColor: "#14B8A61A" }}>
              <button onClick={() => setExpandedCategory(expandedCategory === cat.name ? null : cat.name)} className="w-full flex items-center justify-between mb-3 text-left outline-none">
                <div className="flex-1 min-w-0 pr-3">
                  <p className="font-bold text-sm truncate" style={{ color: "#0A5C54" }}>{cat.name}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs font-black px-2 py-1 rounded bg-teal-50" style={{ color: "#148A7A" }}>{cat.total}</span>
                  <ChevronDown size={16} className={`text-gray-400 transition-transform ${expandedCategory === cat.name ? "rotate-180" : ""}`}/>
                </div>
              </button>
              <div className="flex h-2 w-full rounded-full overflow-hidden mb-2 bg-gray-100">
                {cat.total > 0 && (
                  <>
                    <div style={{ width: `${(cat.closed/cat.total)*100}%`, background: "#15803D" }}></div>
                    <div style={{ width: `${(cat.open/cat.total)*100}%`, background: "#F59E0B" }}></div>
                    <div style={{ width: `${(cat.lost/cat.total)*100}%`, background: "#DC2626" }}></div>
                  </>
                )}
              </div>
              <div className="flex justify-between text-[10px] font-semibold text-gray-500 mb-2">
                <span style={{ color: "#15803D" }}>{cat.closed} Cured</span>
                <span style={{ color: "#B45309" }}>{cat.open} Active</span>
                <span style={{ color: "#DC2626" }}>{cat.lost} Lost</span>
              </div>
              
              {/* Clickable Disease Patient List - BUG FULLY FIXED USING <div> */}
              {expandedCategory === cat.name && (
                <div className="mt-3 pt-3 border-t border-dashed space-y-2 max-h-48 overflow-y-auto" style={{ borderColor: "#14B8A633" }}>
                  {cat.patientList.map(pt => (
                    <div 
                      key={pt.id} 
                      onClick={() => onSelect(pt)} 
                      className="w-full text-left flex items-center justify-between p-3 rounded-xl bg-gray-50 border border-gray-100 cursor-pointer active:bg-teal-50 transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-gray-800 truncate">{pt.name}</p>
                        {pt.contact && <p className="text-[10px] text-gray-500 mt-0.5">{pt.contact}</p>}
                      </div>
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase shrink-0" style={{ background: pt.status === "closed" ? "#DCFCE7" : pt.status === "lost" ? "#FEE2E2" : "#FEF3C7", color: pt.status === "closed" ? "#15803D" : pt.status === "lost" ? "#DC2626" : "#B45309" }}>{pt.status}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ---------------- TAB 3: ACTION DESK (OVERDUE) BUG FULLY FIXED USING <div> ---------------- */}
      {activeTab === "action" && (
        <div className="space-y-3">
          <div className="bg-red-50 border border-red-100 rounded-xl p-3 flex items-start gap-2 mb-2">
             <AlertCircle size={16} className="text-red-600 shrink-0 mt-0.5" />
             <p className="text-xs text-red-800">Medicine finished, haven't returned. Call them or mark "Lost".</p>
          </div>
          {actionList.map(({ patient, dueInfo }) => (
            <div 
              key={patient.id} 
              onClick={() => onSelect(patient)} 
              className="w-full text-left bg-white rounded-xl p-4 shadow-sm border flex items-center justify-between cursor-pointer active:bg-teal-50 transition-colors" 
              style={{ borderColor: "#14B8A61A" }}
            >
              <div className="min-w-0">
                <p className="text-sm font-bold truncate" style={{ color: "#0A5C54" }}>{patient.name}</p>
                <p className="text-[11px] text-gray-500 truncate mb-1.5">{getComplaint(patient)}</p>
                <div className="flex items-center gap-2">
                  <span className="text-[9px] font-black px-1.5 py-0.5 rounded text-red-700 bg-red-100 uppercase tracking-wide">{dueInfo.days} days overdue</span>
                  {patient.contact && <span className="text-[10px] flex items-center gap-0.5 font-medium text-teal-700"><Phone size={10} /> {patient.contact}</span>}
                </div>
              </div>
              <ChevronRight size={16} className="text-gray-400 shrink-0" />
            </div>
          ))}
        </div>
      )}

      {/* MONTH PICKER MODAL */}
      {showMonthPicker && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowMonthPicker(false)}>
          <div className="bg-white rounded-3xl w-full max-w-xs p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <button onClick={() => setPickerYear(y => y - 1)} className="p-2 bg-gray-100 rounded-lg"><ChevronLeft size={18}/></button>
              <p className="font-bold text-lg text-teal-900">{pickerYear}</p>
              <button onClick={() => setPickerYear(y => y + 1)} className="p-2 bg-gray-100 rounded-lg"><ChevronRight size={18}/></button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {MONTHS.map((m, i) => (
                <button key={m} onClick={() => selectMonth(i)} className={`py-3 rounded-xl text-sm font-semibold transition ${pickerYear === currentViewDate.getFullYear() && i === currentViewDate.getMonth() ? "bg-teal-600 text-white shadow-md" : "bg-gray-50 text-gray-700 hover:bg-teal-50"}`}>{m}</button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// --- HELPER COMPONENTS ---
function TabButton({ active, onClick, icon, label, badge }) {
  return (
    <button onClick={onClick} className={`flex-1 flex flex-col items-center justify-center py-2.5 rounded-xl transition relative outline-none`} style={{ background: active ? "#148A7A" : "transparent", color: active ? "white" : "#0A5C5499" }}>
      <div className="flex items-center gap-1.5">{icon}<span className="text-[11px] font-bold">{label}</span></div>
      {badge > 0 && <span className="absolute top-1 right-2 w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-black" style={{ background: active ? "#DC2626" : "#FEE2E2", color: active ? "white" : "#DC2626" }}>{badge}</span>}
    </button>
  );
}

function MiniStat({ label, value, color, onClick, isActive }) {
  return (
    <button onClick={onClick} className={`bg-white p-2 rounded-xl shadow-sm border text-center flex flex-col justify-center transition outline-none ${isActive ? 'ring-2 ring-teal-500 bg-teal-50' : 'active:bg-gray-50'}`} style={{ borderColor: "#14B8A61A" }}>
      <p className="text-xl font-black" style={{ color }}>{value}</p>
      <p className="text-[9px] font-semibold uppercase text-gray-500 mt-0.5">{label}</p>
    </button>
  );
}

function StatDetail({ label, value, color, help, onClick, isActive }) {
  return (
    <button onClick={onClick} className={`text-left p-2 rounded-xl transition border outline-none ${isActive ? 'border-teal-400 bg-teal-50' : 'border-transparent active:bg-gray-50'}`}>
      <p className="text-[10px] text-gray-500 font-semibold uppercase">{label}</p>
      <p className="text-xl font-black" style={{ color }}>{value}</p>
      {help && <p className="text-[9px] text-gray-400 mt-0.5">{help}</p>}
    </button>
  );
}
