import React, { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Bookmark, ExternalLink, Filter, RefreshCw, Search, CheckCircle2, Sparkles } from "lucide-react";

const TEAL = "#0A5C54";
const TEAL2 = "#148A7A";
const MUTED = "#0A5C5499";
const FILTERS = ["All", "Research", "Regulation", "Education", "International"];

export default function IntelligenceView({ onBack }) {
  const [items, setItems] = useState([]);
  const [read, setRead] = useState(() => JSON.parse(localStorage.getItem("homeocure-intel-read") || "[]"));
  const [saved, setSaved] = useState(() => JSON.parse(localStorage.getItem("homeocure-intel-saved") || "[]"));
  const [filter, setFilter] = useState("All");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true); setError("");
    try {
      const res = await fetch("/api/intelligence", { headers: { Accept: "application/json" } });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setItems(Array.isArray(data.items) ? data.items : []);
    } catch { setError("Live feed could not be refreshed. Open the source pages directly below."); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  function markRead(id) {
    const next = [...new Set([...read, id])]; setRead(next);
    localStorage.setItem("homeocure-intel-read", JSON.stringify(next));
  }
  function toggleSaved(id) {
    const next = saved.includes(id) ? saved.filter(x => x !== id) : [...saved, id];
    setSaved(next); localStorage.setItem("homeocure-intel-saved", JSON.stringify(next));
  }

  const visible = useMemo(() => items.filter(item => {
    if (read.includes(item.id) || (filter !== "All" && item.category !== filter)) return false;
    const q = query.trim().toLowerCase();
    return !q || [item.title, item.source, item.summary, item.action].join(" ").toLowerCase().includes(q);
  }), [items, read, filter, query]);
  const archived = items.filter(i => read.includes(i.id));
  const savedItems = items.filter(i => saved.includes(i.id));

  return <div className="space-y-4 pb-4">
    <div className="flex items-center gap-3 px-1">
      <button onClick={onBack} className="w-9 h-9 rounded-full bg-white shadow-sm flex items-center justify-center" style={{color:TEAL}}><ArrowLeft size={17}/></button>
      <div className="flex-1"><p className="text-[10px] font-bold uppercase tracking-wide" style={{color:TEAL2}}>HomeoCure</p><h1 className="text-xl font-bold font-serif" style={{color:TEAL}}>Intelligence</h1></div>
      <button onClick={load} disabled={loading} className="w-9 h-9 rounded-full bg-white shadow-sm flex items-center justify-center" style={{color:TEAL2}}><RefreshCw size={16} className={loading?"animate-spin":""}/></button>
    </div>

    <div className="rounded-3xl p-4 text-white shadow-sm" style={{background:"linear-gradient(135deg,#0A5C54,#148A7A)"}}>
      <div className="flex gap-2 items-center"><Sparkles size={17}/><p className="text-sm font-bold">Stay informed. Act deliberately.</p></div>
      <p className="text-[11px] mt-2 opacity-80">Official-source updates, simplified into what happened, why it matters, and what you may want to review next.</p>
    </div>

    <div className="bg-white rounded-2xl p-3 shadow-sm flex items-center gap-2"><Search size={15} color={MUTED}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search intelligence…" className="flex-1 outline-none text-xs"/></div>
    <div className="flex gap-2 overflow-x-auto pb-1"><Filter size={14} color={MUTED} className="mt-2 shrink-0"/>{FILTERS.map(f=><button key={f} onClick={()=>setFilter(f)} className="px-3 py-1.5 rounded-full text-[10px] font-semibold whitespace-nowrap" style={{background:filter===f?TEAL:"#fff",color:filter===f?"#fff":TEAL}}>{f}</button>)}</div>
    {error && <div className="rounded-2xl p-3 bg-white text-[10px]" style={{color:"#B45309"}}>{error}</div>}
    <div className="flex items-center justify-between px-1"><p className="text-xs font-bold" style={{color:TEAL}}>New updates <span style={{color:MUTED}}>({visible.length})</span></p><p className="text-[10px]" style={{color:MUTED}}>Read items move to archive</p></div>

    {visible.map(item=><article key={item.id} className="bg-white rounded-3xl p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2 mb-2"><span className="px-2 py-1 rounded-full text-[9px] font-bold" style={{background:"#14B8A61A",color:TEAL2}}>{item.category}</span><span className="text-[9px]" style={{color:MUTED}}>{item.date} · {item.source}</span></div>
      <h2 className="text-sm font-bold leading-snug" style={{color:TEAL}}>{item.title}</h2>
      <p className="text-[11px] leading-relaxed mt-2" style={{color:"#0A5C54CC"}}>{item.summary}</p>
      <div className="rounded-2xl p-3 mt-3" style={{background:"#F4FAF8"}}><p className="text-[9px] font-bold uppercase" style={{color:TEAL2}}>What it means</p><p className="text-[10px] mt-1 leading-relaxed" style={{color:MUTED}}>{item.meaning}</p></div>
      <div className="rounded-2xl p-3 mt-2" style={{background:"#FFFBEB"}}><p className="text-[9px] font-bold uppercase" style={{color:"#B45309"}}>Suggested action</p><p className="text-[10px] mt-1 leading-relaxed" style={{color:"#92400E"}}>{item.action}</p></div>
      <div className="flex items-center gap-2 mt-3"><a href={item.url} target="_blank" rel="noreferrer" className="flex-1 rounded-xl py-2 text-center text-[10px] font-bold text-white" style={{background:TEAL}}>Read source <ExternalLink size={11} className="inline ml-1"/></a><button onClick={()=>toggleSaved(item.id)} className="w-9 h-9 rounded-xl bg-white border flex items-center justify-center" style={{borderColor:"#14B8A655",color:saved.includes(item.id)?TEAL2:MUTED}}><Bookmark size={14} fill={saved.includes(item.id)?"currentColor":"none"}/></button><button onClick={()=>markRead(item.id)} className="w-9 h-9 rounded-xl bg-white border flex items-center justify-center" style={{borderColor:"#14B8A655",color:TEAL2}}><CheckCircle2 size={14}/></button></div>
    </article>)}
    {savedItems.length>0 && <div className="bg-white rounded-3xl p-4 shadow-sm"><p className="text-xs font-bold" style={{color:TEAL}}>Saved ({savedItems.length})</p><div className="mt-2 space-y-2">{savedItems.map(i=><a key={i.id} href={i.url} target="_blank" rel="noreferrer" className="block text-[11px] font-semibold" style={{color:TEAL2}}>{i.title}</a>)}</div></div>}
    {archived.length>0 && <div className="bg-white rounded-3xl p-4 shadow-sm"><p className="text-xs font-bold" style={{color:TEAL}}>Read archive ({archived.length})</p><p className="text-[10px] mt-1" style={{color:MUTED}}>Read items stay out of the active feed on this device.</p></div>}
  </div>;
}
