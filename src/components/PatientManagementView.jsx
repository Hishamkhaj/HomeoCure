import React, { useMemo, useState } from "react";
import { Search, Users, UserPlus, UserCheck, UserX, Clock3, AlertTriangle, CheckCircle2, ChevronRight, CalendarDays, RefreshCw, X, ArrowLeft } from "lucide-react";

const TEAL = "#0A5C54";
const TEAL2 = "#148A7A";
const LOST_GRACE_DAYS = 15;

const latestVisit = (p) => [...(p.visits || [])].filter(v => Number.isFinite(Number(v.ts))).sort((a,b)=>Number(b.ts)-Number(a.ts))[0] || null;
const daysBetween = (a,b=Date.now()) => a ? Math.max(0, Math.floor((b-a)/86400000)) : 0;
const fmtDate = ts => ts ? new Date(Number(ts)).toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"}) : "—";
const shortDate = ts => ts ? new Date(Number(ts)).toLocaleDateString("en-IN",{day:"2-digit",month:"short"}) : "—";

function meta(p, now) {
  const last=latestVisit(p), lastTs=last?.ts?Number(last.ts):null, duration=last?.duration_days?Number(last.duration_days):null;
  const dueTs=lastTs&&duration ? lastTs+duration*86400000 : null;
  const overdueDays=dueTs&&now>dueTs ? daysBetween(dueTs,now):0;
  const lost=p.status==="open" && overdueDays>LOST_GRACE_DAYS;
  const overdue=p.status==="open" && !!dueTs && now>=dueTs;
  const dueSoon=p.status==="open" && !!dueTs && dueTs>=now && dueTs<=now+3*86400000;
  let lifecycle=p.status==="closed"?"closed":lost?"lost":overdue?"overdue":dueSoon?"due":!duration?"no_followup":"running";
  return {last,lastTs,dueTs,duration,overdueDays,lost,overdue,dueSoon,visitCount:(p.visits||[]).length,lifecycle};
}
const label=m=>({running:"Running",due:"Due soon",overdue:"Overdue",lost:"Lost",closed:"Closed",no_followup:"No follow-up"}[m.lifecycle]||"Running");
const style=m=>({running:["#ECFDF5","#047857"],due:["#FFF7ED","#C2410C"],overdue:["#FEF2F2","#DC2626"],lost:["#F3F4F6","#4B5563"],closed:["#EFF6FF","#2563EB"],no_followup:["#FFFBEB","#A16207"]}[m.lifecycle]||["#ECFDF5","#047857"]);

function Row({patient,m,onSelect}){
  const [bg,color]=style(m);
  return <button onClick={()=>onSelect(patient)} className="w-full text-left bg-white rounded-2xl p-3.5 border border-teal-100 shadow-sm flex items-center gap-3 active:scale-[.995] transition">
    <div className="w-10 h-10 rounded-full shrink-0 flex items-center justify-center font-bold text-sm" style={{background:"#EAF6F2",color:TEAL}}>{(patient.name||"?").trim().charAt(0).toUpperCase()}</div>
    <div className="min-w-0 flex-1">
      <div className="flex items-center gap-2"><p className="font-semibold text-sm truncate" style={{color:TEAL}}>{patient.name||"Unnamed patient"}</p><span className="text-[9px] px-1.5 py-0.5 rounded-full shrink-0" style={{background:bg,color}}>{label(m)}</span></div>
      <p className="text-[11px] text-slate-500 truncate mt-0.5">{m.last?.complaint||"No complaint recorded"}</p>
      <div className="flex items-center gap-3 mt-1.5 text-[10px] text-slate-400"><span className="flex items-center gap-1"><CalendarDays size={11}/>Last {shortDate(m.lastTs)}</span><span>{m.visitCount} visit{m.visitCount===1?"":"s"}</span>{m.overdue&&<span className="text-red-500 font-medium">{m.overdueDays}d overdue</span>}</div>
    </div><ChevronRight size={17} color="#94A3B8" className="shrink-0"/>
  </button>;
}
function Stat({icon:Icon,label,value,sub,tone="teal",onClick}){
  const t={teal:["#F0FDFA",TEAL2,TEAL],green:["#ECFDF5","#059669","#047857"],orange:["#FFF7ED","#EA580C","#C2410C"],red:["#FEF2F2","#DC2626","#B91C1C"],blue:["#EFF6FF","#2563EB","#1D4ED8"],gray:["#F8FAFC","#64748B","#475569"]}[tone];
  return <button onClick={onClick} className="text-left bg-white rounded-2xl p-3.5 border border-teal-100 shadow-sm w-full"><div className="flex justify-between"><div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{background:t[0]}}><Icon size={16} color={t[1]}/></div><ChevronRight size={15} color="#94A3B8"/></div><p className="text-[11px] text-slate-500 mt-3">{label}</p><p className="text-2xl font-bold" style={{color:t[2]}}>{value}</p>{sub&&<p className="text-[10px] text-slate-400">{sub}</p>}</button>;
}
function Box({children,className=""}){return <div className={`bg-white rounded-2xl border border-teal-100 shadow-sm ${className}`}>{children}</div>}

export default function PatientManagementView({patients=[],onSelect,onAddNew}){
  const [section,setSection]=useState(null), [query,setQuery]=useState(""), now=Date.now();
  const all=useMemo(()=>patients.map(patient=>({patient,m:meta(patient,now)})),[patients,now]);
  const groups=useMemo(()=>({
    running:all.filter(x=>x.patient.status==="open"&&!x.m.lost),
    due:all.filter(x=>x.m.dueSoon),
    overdue:all.filter(x=>x.m.overdue&&!x.m.lost),
    lost:all.filter(x=>x.m.lost),
    returning:all.filter(x=>x.m.visitCount>1),
    new:all.filter(x=>x.m.visitCount===1),
    closed:all.filter(x=>x.patient.status==="closed"),
    no_followup:all.filter(x=>x.m.lifecycle==="no_followup")
  }),[all]);
  const attention=useMemo(()=>Array.from(new Map([...groups.due,...groups.overdue,...groups.no_followup].map(x=>[x.patient.id,x])).values()),[groups]);
  const filtered=useMemo(()=>{let a=section?groups[section]||[]:attention;const q=query.trim().toLowerCase();if(q)a=a.filter(x=>[x.patient.name,x.patient.contact,x.m.last?.complaint,x.m.last?.medicineNote].filter(Boolean).some(v=>String(v).toLowerCase().includes(q)));return [...a].sort((a,b)=>(a.m.dueTs||Infinity)-(b.m.dueTs||Infinity));},[section,groups,attention,query]);
  if(section){const names={running:"Running Patients",due:"Due Soon",overdue:"Overdue",lost:"Lost Patients",returning:"Returning Patients",new:"New Patients",closed:"Closed Cases",no_followup:"No Follow-up Set"};return <div><div className="flex items-center gap-2 mb-4"><button onClick={()=>setSection(null)} className="w-9 h-9 rounded-xl bg-white border border-teal-100 flex items-center justify-center"><ArrowLeft size={17} color={TEAL}/></button><div><h2 className="text-lg font-bold" style={{color:TEAL}}>{names[section]}</h2><p className="text-[11px] text-slate-500">{filtered.length} patient{filtered.length===1?"":"s"}</p></div></div><Box className="p-3 mb-3"><div className="flex items-center gap-2"><Search size={15} color={TEAL2}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search name, phone or complaint…" className="flex-1 outline-none text-sm"/>{query&&<button onClick={()=>setQuery("")}><X size={15} color="#94A3B8"/></button>}</div></Box><div className="space-y-2.5">{filtered.map(x=><Row key={x.patient.id} {...x} onSelect={onSelect}/>)}</div>{!filtered.length&&<Box className="p-8 text-center"><CheckCircle2 size={28} color={TEAL2} className="mx-auto mb-2"/><p className="text-sm font-semibold" style={{color:TEAL}}>Nothing here</p></Box>}</div>}
  return <div>
    <div className="flex items-start justify-between gap-3 mb-4"><div><h2 className="text-lg font-bold" style={{color:TEAL}}>Patient Management</h2><p className="text-xs text-slate-500 mt-1">Running cases, follow-ups, returns & patient lifecycle</p></div><button onClick={onAddNew} className="px-3 py-2.5 rounded-xl text-xs font-semibold text-white flex items-center gap-1.5" style={{background:`linear-gradient(135deg,${TEAL2},${TEAL})`}}><UserPlus size={14}/>New</button></div>
    <Box className="p-3.5 mb-4"><div className="flex items-center gap-2"><Search size={16} color={TEAL2}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search name, phone or complaint…" className="flex-1 outline-none text-sm"/>{query&&<button onClick={()=>setQuery("")}><X size={15} color="#94A3B8"/></button>}</div></Box>
    <div className="grid grid-cols-2 gap-2.5 mb-4"><Stat icon={Users} label="Running" value={groups.running.length} sub="active cases" tone="green" onClick={()=>setSection("running")}/><Stat icon={AlertTriangle} label="Needs attention" value={attention.length} sub={`${groups.overdue.length} overdue · ${groups.due.length} due`} tone={attention.length?"orange":"teal"} onClick={()=>setSection("overdue")}/><Stat icon={UserCheck} label="Returning" value={groups.returning.length} sub="2+ visits" tone="blue" onClick={()=>setSection("returning")}/><Stat icon={UserPlus} label="New" value={groups.new.length} sub="1 visit" onClick={()=>setSection("new")}/></div>
    <Box className="p-4 mb-4"><div className="flex justify-between mb-3"><div><p className="font-semibold text-sm" style={{color:TEAL}}>Needs Attention</p><p className="text-[10px] text-slate-500">Actual patient names, not just numbers.</p></div><button onClick={()=>setSection("overdue")} className="text-[10px] font-semibold" style={{color:TEAL2}}>View lists</button></div><div className="space-y-2">{attention.slice(0,6).map(x=><Row key={x.patient.id} {...x} onSelect={onSelect}/>)}</div>{!attention.length&&<div className="rounded-xl bg-emerald-50 p-3 text-center"><CheckCircle2 size={20} color="#059669" className="mx-auto mb-1"/><p className="text-xs font-semibold text-emerald-700">No immediate patient-management alerts</p></div>}</Box>
    <p className="text-sm font-semibold mb-1" style={{color:TEAL}}>Patient Lifecycle</p><p className="text-[10px] text-slate-500 mb-3">Open any group to see the full patient list.</p>
    <div className="space-y-2.5">{[["due",Clock3,"Due soon",groups.due.length,"orange"],["overdue",AlertTriangle,"Overdue",groups.overdue.length,"red"],["lost",UserX,"Lost",groups.lost.length,"gray"],["closed",CheckCircle2,"Closed",groups.closed.length,"blue"],["no_followup",RefreshCw,"No follow-up set",groups.no_followup.length,"orange"]].map(([k,I,l,v,t])=>{const tone={orange:["#FFF7ED","#EA580C"],red:["#FEF2F2","#DC2626"],gray:["#F8FAFC","#64748B"],blue:["#EFF6FF","#2563EB"]}[t];return <button key={k} onClick={()=>setSection(k)} className="w-full bg-white rounded-2xl p-3.5 border border-teal-100 shadow-sm flex items-center gap-3 text-left"><div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{background:tone[0]}}><I size={17} color={tone[1]}/></div><div className="flex-1"><p className="text-sm font-semibold" style={{color:TEAL}}>{l}</p><p className="text-[10px] text-slate-500">{k==="due"?"Expected today or within 3 days":k==="overdue"?"Due date has passed":k==="lost"?`Missed by more than ${LOST_GRACE_DAYS} days`:k==="closed"?"Stored case status is closed":"Open case without a follow-up duration"}</p></div><p className="text-lg font-bold" style={{color:TEAL}}>{v}</p><ChevronRight size={16} color="#94A3B8"/></button>})}</div>
    <Box className="p-4 mt-4"><p className="text-sm font-semibold" style={{color:TEAL}}>Quick views</p><div className="grid grid-cols-2 gap-2 mt-3">{[["running","Running patients"],["returning","Returning patients"],["new","New patients"],["lost","Lost patients"]].map(([k,l])=><button key={k} onClick={()=>setSection(k)} className="rounded-xl px-3 py-3 text-left bg-slate-50 border border-slate-100"><p className="text-xs font-semibold" style={{color:TEAL}}>{l}</p><p className="text-lg font-bold" style={{color:TEAL2}}>{groups[k].length}</p></button>)}</div></Box>
    <div className="mt-4 rounded-2xl p-3.5" style={{background:"#EAF6F2"}}><p className="text-[11px] font-semibold" style={{color:TEAL}}>Management rule</p><p className="text-[10px] mt-1 leading-relaxed" style={{color:`${TEAL}AA`}}>Lost is calculated here only: open case + missed treatment-duration due date + {LOST_GRACE_DAYS}-day grace period. It does not change the stored patient status.</p></div>
  </div>;
}
