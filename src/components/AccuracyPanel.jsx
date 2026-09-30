import React, { useEffect, useMemo, useState } from "react";
import { Activity, RefreshCw } from "lucide-react";
import { supabase } from "../supabaseClient";

const DAY = 86400000;
const TEAL = "#0A5C54";
const TEAL2 = "#148A7A";
const MUTED = "#0A5C5499";

const dateKey = (d = new Date()) => {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,"0")}-${String(x.getDate()).padStart(2,"0")}`;
};
const visitsOf = p => [...(p?.visits || [])].filter(v => Number(v.ts)).sort((a,b) => a.ts-b.ts);
const accuracy = (p,a) => Math.max(0, Math.min(100, 100 - Math.abs((Number(p)||0)-(Number(a)||0))/Math.max(Math.abs(Number(a)||0),1)*100));

function backtest(patients, sales, now) {
  const daily = new Map();
  patients.forEach(p => visitsOf(p).forEach(v => {
    const k=dateKey(new Date(v.ts));
    if(!daily.has(k)) daily.set(k,{patients:new Set(),income:0});
    const r=daily.get(k);
    r.patients.add(p.id);
    r.income += Math.max(0,Number(v.paid_amount)||0);
  }));

  const targets=[];
  for(let i=30;i>=1;i--) targets.push(new Date(now.getTime()-i*DAY));

  const patientRows=[], incomeRows=[];
  targets.forEach(d=>{
    const hist=[];
    for(let j=1;j<=56 && hist.length<8;j++){
      const h=new Date(d.getTime()-j*DAY);
      if(h.getDay()!==d.getDay()) continue;
      const r=daily.get(dateKey(h));
      if(r) hist.push(r);
    }
    if(!hist.length) return;
    const actual=daily.get(dateKey(d))||{patients:new Set(),income:0};
    patientRows.push({
      p:Math.round(hist.reduce((s,r)=>s+r.patients.size,0)/hist.length),
      a:actual.patients.size
    });
    incomeRows.push({
      p:Math.round(hist.reduce((s,r)=>s+r.income,0)/hist.length),
      a:actual.income
    });
  });

  const byDay=new Map();
  (sales||[]).forEach(s=>{
    const k=dateKey(new Date(s.sold_at)), q=Number(s.qty)||0;
    if(q>0) byDay.set(k,(byDay.get(k)||0)+q);
  });
  const medicineRows=[];
  targets.forEach(d=>{
    let total=0,days=0;
    for(let j=1;j<=7;j++){
      const k=dateKey(new Date(d.getTime()-j*DAY));
      if(byDay.has(k)){total+=byDay.get(k);days++;}
    }
    if(days) medicineRows.push({p:Math.max(1,Math.round(total/days)),a:byDay.get(dateKey(d))||0});
  });

  const avg=rows=>rows.length?rows.reduce((s,r)=>s+accuracy(r.p,r.a),0)/rows.length:null;
  const pa=avg(patientRows), ia=avg(incomeRows), ma=avg(medicineRows);
  const vals=[pa,ia,ma].filter(v=>v!=null);
  return {
    patient:{accuracy:pa,samples:patientRows.length},
    income:{accuracy:ia,samples:incomeRows.length},
    medicine:{accuracy:ma,samples:medicineRows.length},
    overall:{accuracy:vals.length?vals.reduce((s,v)=>s+v,0)/vals.length:null,samples:patientRows.length+incomeRows.length+medicineRows.length}
  };
}

function Section({children,action}) {
  return <section className="bg-white rounded-3xl p-4 shadow-sm">
    <div className="flex items-start justify-between gap-3 mb-3">
      <div className="flex items-start gap-2.5">
        <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{background:"#14B8A61A",color:TEAL2}}><Activity size={16}/></div>
        <div><p className="text-sm font-bold" style={{color:TEAL}}>HomeoCure Accuracy</p><p className="text-[10px] mt-0.5" style={{color:MUTED}}>Historical backtest: prediction → actual outcome</p></div>
      </div>
      {action}
    </div>
    {children}
  </section>;
}

export default function AccuracyPanel({patients=[],now=new Date()}) {
  const [sales,setSales]=useState([]);
  const [loading,setLoading]=useState(true);
  const [refresh,setRefresh]=useState(0);

  useEffect(()=>{
    let alive=true;
    (async()=>{
      setLoading(true);
      const start=dateKey(new Date(now.getTime()-31*DAY));
      const {data}=await supabase.from("pharmacy_sales").select("qty,sold_at,patient_id").not("qty","is",null).gte("sold_at",start);
      if(alive){setSales(data||[]);setLoading(false);}
    })().catch(()=>alive&&setLoading(false));
    return()=>{alive=false;};
  },[now,refresh]);

  const stats=useMemo(()=>backtest(patients,sales,now),[patients,sales,now]);
  const fmt=v=>v==null?"Not enough data":`${Math.round(v)}%`;
  const cards=[["Patient forecast",stats.patient],["Income forecast",stats.income],["Medicine orders",stats.medicine]];

  return <Section action={<button type="button" onClick={()=>setRefresh(x=>x+1)} className="text-[10px] font-bold flex items-center gap-1" style={{color:TEAL2}}><RefreshCw size={12}/>Refresh</button>}>
    <div className="grid grid-cols-2 gap-2.5">
      {cards.map(([label,s])=><div key={label} className="rounded-2xl p-3" style={{background:"#F4FAF8"}}><p className="text-[9px]" style={{color:MUTED}}>{label}</p><p className="text-sm font-bold mt-1" style={{color:TEAL}}>{loading?"…":fmt(s.accuracy)}</p><p className="text-[8px] mt-1" style={{color:MUTED}}>{s.samples} backtested days</p></div>)}
      <div className="rounded-2xl p-3" style={{background:"#F4FAF8"}}><p className="text-[9px]" style={{color:MUTED}}>Overall intelligence</p><p className="text-sm font-bold mt-1" style={{color:TEAL}}>{loading?"…":fmt(stats.overall.accuracy)}</p><p className="text-[8px] mt-1" style={{color:MUTED}}>{stats.overall.samples} comparisons</p></div>
    </div>
    <p className="text-[9px] mt-3" style={{color:MUTED}}>This reconstructs comparable forecasts from your existing clinic history. It is a backtest, not a claim that these predictions were actually shown on those past dates.</p>
  </Section>;
}
