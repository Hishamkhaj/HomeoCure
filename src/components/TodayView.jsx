import React, { useEffect, useMemo, useState } from "react";
import {
  Activity, AlertTriangle, ArrowRight, CalendarDays, CheckCircle2, ChevronRight,
  CloudRain, CloudSun, IndianRupee, Package, RefreshCw, Sparkles, Users, WalletCards,
  CreditCard, Banknote, Smartphone, ClipboardList, Building2
} from "lucide-react";
import { supabase } from "../supabaseClient";

const DAY = 86400000;
const TEAL = "#0A5C54";
const TEAL2 = "#148A7A";
const MUTED = "#0A5C5499";
const RED = "#DC2626";
const AMBER = "#B45309";
const GREEN = "#15803D";

const dateKey = (d = new Date()) => {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,"0")}-${String(x.getDate()).padStart(2,"0")}`;
};
const tsForDate = (s) => new Date(`${s}T12:00:00`).getTime();
const money = (n) => `₹${Math.round(Number(n)||0).toLocaleString("en-IN")}`;
const visitsOf = (p) => [...(p?.visits||[])].filter(v=>Number(v.ts)).sort((a,b)=>a.ts-b.ts);
const lastVisit = (p) => visitsOf(p).at(-1) || null;
const dueTs = (p) => { const v=lastVisit(p); return v?.duration_days ? v.ts+Number(v.duration_days)*DAY : null; };
const initial = (name) => (name||"?").trim().slice(0,1).toUpperCase();

function collectionForVisit(v) {
  if (Array.isArray(v?.payment_log) && v.payment_log.length) {
    return v.payment_log.reduce((s,p)=>s+Math.max(0,Number(p.amount)||0),0);
  }
  return Math.max(0,Number(v?.paid_amount)||0);
}

function Section({icon,title,subtitle,action,children}) {
  return <section className="bg-white rounded-3xl p-4 shadow-sm">
    <div className="flex items-start justify-between gap-3 mb-3">
      <div className="flex items-start gap-2.5">
        <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{background:"#14B8A61A",color:TEAL2}}>{icon}</div>
        <div><p className="text-sm font-bold" style={{color:TEAL}}>{title}</p>{subtitle&&<p className="text-[10px] mt-0.5" style={{color:MUTED}}>{subtitle}</p>}</div>
      </div>
      {action}
    </div>
    {children}
  </section>;
}

function SmallMetric({icon,label,value,sub,onClick}) {
  return <button type="button" onClick={onClick} className="bg-white rounded-2xl p-3 text-left shadow-sm w-full">
    <div className="flex items-center gap-1.5" style={{color:TEAL2}}>{icon}<span className="text-[9px] font-bold uppercase tracking-wide">{label}</span></div>
    <p className="text-xl font-bold mt-1" style={{color:TEAL}}>{value}</p>
    {sub&&<p className="text-[9px] mt-0.5" style={{color:MUTED}}>{sub}</p>}
  </button>;
}

function PersonRow({p,label,tone=TEAL2,onSelect}) {
  return <button type="button" onClick={()=>onSelect?.(p)} className="w-full flex items-center gap-2.5 p-2.5 rounded-2xl text-left" style={{background:"#F4FAF8"}}>
    <div className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0" style={{background:"#14B8A61A",color:TEAL2}}>{initial(p.name)}</div>
    <div className="min-w-0 flex-1"><p className="text-xs font-semibold truncate" style={{color:TEAL}}>{p.name||"Unnamed patient"}</p><p className="text-[9px] mt-0.5" style={{color:MUTED}}>{label}</p></div>
    <ChevronRight size={14} color={tone}/>
  </button>;
}

export default function TodayView({patients=[],onSelect,onSelectPatient,onNavigate}) {
  const selectPatient = onSelectPatient || onSelect;
  const [now,setNow]=useState(()=>new Date());
  const [weather,setWeather]=useState(null);
  const [weatherError,setWeatherError]=useState("");
  const [inventory,setInventory]=useState({orders:[],refills:[]});
  const [mrPending,setMrPending]=useState({amount:0,count:0});
  const [intel,setIntel]=useState({items:[],error:false});
  const [pharmacySales,setPharmacySales]=useState(0);

  useEffect(()=>{const t=setInterval(()=>setNow(new Date()),60000);return()=>clearInterval(t)},[]);

  const today=dateKey(now), yesterday=dateKey(new Date(now.getTime()-DAY)), tomorrow=dateKey(new Date(now.getTime()+DAY));

  const visitsToday=useMemo(()=>patients.flatMap(p=>visitsOf(p).filter(v=>dateKey(new Date(v.ts))===today).map(visit=>({patient:p,visit}))),[patients,today]);
  const outlook=useMemo(()=>{
    const groups={today:[],yesterday:[],tomorrow:[]};
    patients.filter(p=>p.status==="open").forEach(p=>{
      const d=dueTs(p); if(!d)return;
      const k=dateKey(new Date(d));
      if(k===today)groups.today.push(p); else if(k===yesterday)groups.yesterday.push(p); else if(k===tomorrow)groups.tomorrow.push(p);
    });
    return groups;
  },[patients,today,yesterday,tomorrow]);

  const pendingPayments=useMemo(()=>{
    const rows=[];
    patients.forEach(p=>{
      const due=(p.visits||[]).reduce((s,v)=>s+Math.max(0,(Number(v.cost)||0)-(Number(v.paid_amount)||0)),0);
      if(due>0)rows.push({patient:p,amount:due});
    });
    return rows.sort((a,b)=>b.amount-a.amount);
  },[patients]);

  const collection=useMemo(()=>{
    const mode={cash:0,upi:0,card:0,other:0};
    let patient=0;
    visitsToday.forEach(({visit})=>{
      if(Array.isArray(visit.payment_log)) visit.payment_log.filter(x=>x.date===today).forEach(x=>{const a=Math.max(0,Number(x.amount)||0);patient+=a;const m=String(x.mode||"other").toLowerCase();if(m.includes("upi"))mode.upi+=a;else if(m.includes("card"))mode.card+=a;else if(m.includes("cash"))mode.cash+=a;else mode.other+=a;});
      else { const a=collectionForVisit(visit); patient+=a; const m=String(visit.payment_mode||"other").toLowerCase(); if(m.includes("upi"))mode.upi+=a; else if(m.includes("card"))mode.card+=a; else if(m.includes("cash"))mode.cash+=a; else mode.other+=a; }
    });
    return {patient,mode};
  },[visitsToday,today]);

  useEffect(()=>{
    let dead=false;
    async function load(){
      const [{data:products},{data:categories},{data:mrOrders},{data:sales}]=await Promise.all([
        supabase.from("pharmacy_products").select("id,name,price,stock,low_stock_threshold,tracking_type,remaining_ml,low_volume_threshold_ml,category_id"),
        supabase.from("pharmacy_categories").select("id,name,show_in_refills"),
        supabase.from("mr_orders").select("id,bill_amount,paid_amount"),
        supabase.from("pharmacy_sales").select("product_id,qty,ml_dispensed,sold_at").eq("sold_at",today)
      ]);
      if(dead)return;
      const cats=new Map((categories||[]).map(c=>[c.id,c]));
      const orders=(products||[]).filter(p=>p.tracking_type!=="volume" && Number(p.stock||0)<=Number(p.low_stock_threshold??2)).map(p=>({...p,category:cats.get(p.category_id)?.name||""}));
      const refills=(products||[]).filter(p=>p.tracking_type==="volume" && cats.get(p.category_id)?.show_in_refills!==false && Number(p.remaining_ml||0)<=Number(p.low_volume_threshold_ml??50)).map(p=>({...p,category:cats.get(p.category_id)?.name||""}));
      setInventory({orders,refills});
      const productMap=new Map((products||[]).map(p=>[p.id,p]));
      const pharmacyAmount=(sales||[]).reduce((sum,s)=>sum+(s.ml_dispensed?0:(Number(s.qty)||0)*(Number(productMap.get(s.product_id)?.price)||0)),0);
      setPharmacySales(pharmacyAmount);
      const amount=(mrOrders||[]).reduce((s,r)=>s+Math.max(0,(Number(r.bill_amount)||0)-(Number(r.paid_amount)||0)),0);
      setMrPending({amount,count:(mrOrders||[]).filter(r=>(Number(r.bill_amount)||0)-(Number(r.paid_amount)||0)>0).length});
    }
    load().catch(()=>{}); return()=>{dead=true};
  },[today]);

  useEffect(()=>{
    let dead=false;
    fetch("/api/weather?city=Gonda&country=India",{headers:{Accept:"application/json"}}).then(r=>{if(!r.ok)throw new Error();return r.json()}).then(d=>{if(!dead)setWeather(d)}).catch(()=>{if(!dead)setWeatherError("Live weather unavailable")});
    return()=>{dead=true};
  },[today]);

  useEffect(()=>{
    let dead=false;
    fetch("/api/intelligence",{headers:{Accept:"application/json"}}).then(r=>{if(!r.ok)throw new Error();return r.json()}).then(d=>{if(!dead)setIntel({items:(d.items||[]).slice(0,2),error:false})}).catch(()=>{if(!dead)setIntel({items:[],error:true})});
    return()=>{dead=true};
  },[today]);

  const actualPatient=collection.patient;
  const totalCollected=actualPatient+pharmacySales;
  const expectedCount=outlook.today.length+outlook.yesterday.length;
  const outlookExpectedRange=[Math.max(visitsToday.length,expectedCount),Math.max(visitsToday.length,expectedCount)+Math.max(0,Math.round(outlook.tomorrow.length*0.5))];

  const priorities=[];
  if(inventory.orders.length)priorities.push({label:`${inventory.orders.length} medicine${inventory.orders.length>1?"s":""} to order`,detail:inventory.orders.slice(0,2).map(x=>x.name).join(", "),go:"reports"});
  if(inventory.refills.length)priorities.push({label:`${inventory.refills.length} refill${inventory.refills.length>1?"s":""} due`,detail:inventory.refills.slice(0,2).map(x=>x.name).join(", "),go:"reports"});
  if(pendingPayments.length)priorities.push({label:`${pendingPayments.length} patient payment${pendingPayments.length>1?"s":""} pending`,detail:`${money(pendingPayments.reduce((s,x)=>s+x.amount,0))} outstanding`,go:"reports"});
  if(mrPending.amount)priorities.push({label:`MR payment pending`,detail:money(mrPending.amount),go:"mr"});
  if(outlook.yesterday.length)priorities.push({label:`${outlook.yesterday.length} missed yesterday`,detail:"Follow up before they drift further",go:"followup"});
  if(!priorities.length)priorities.push({label:"No urgent operational task",detail:"Your dashboard is clear right now",go:null});

  const clinicOpen=(()=>{const m=now.getHours()*60+now.getMinutes();return (m>=600&&m<840)||(m>=1020&&m<1260)})();

  return <div className="space-y-4 pb-4">
    <div className="px-1 flex items-end justify-between"><div><p className="text-[10px] font-bold uppercase tracking-wide" style={{color:TEAL2}}>Today at {now.toLocaleTimeString("en-IN",{hour:"numeric",minute:"2-digit"})}</p><h1 className="text-xl font-bold font-serif" style={{color:TEAL}}>{now.toLocaleDateString("en-IN",{weekday:"long",day:"numeric",month:"long"})}</h1></div><span className="text-[9px] font-bold px-2.5 py-1.5 rounded-full bg-white shadow-sm" style={{color:clinicOpen?GREEN:AMBER}}>{clinicOpen?"● Clinic open":"● Clinic closed"}</span></div>

    <div className="grid grid-cols-2 gap-3">
      <SmallMetric icon={<Users size={14}/>} label="Patients" value={visitsToday.length} sub="Seen today"/>
      <SmallMetric icon={<Activity size={14}/>} label="Expected" value={outlookExpectedRange[0]===outlookExpectedRange[1]?outlookExpectedRange[0]:`${outlookExpectedRange[0]}–${outlookExpectedRange[1]}`} sub="Today outlook"/>
      <SmallMetric icon={<WalletCards size={14}/>} label="Collected" value={money(totalCollected)} sub="Recorded today"/>
      <SmallMetric icon={<CalendarDays size={14}/>} label="Follow-ups" value={outlook.today.length+outlook.yesterday.length} sub="Due + missed" onClick={()=>onNavigate?.("followup")}/>
    </div>

    <Section icon={<CalendarDays size={16}/>} title="Today's Patient Outlook" subtitle="Priority: today → missed yesterday → tomorrow" action={<button onClick={()=>onNavigate?.("followup")} className="text-[10px] font-bold" style={{color:TEAL2}}>Follow-up</button>}>
      <div className="space-y-2">
        {[['today','Due today',AMBER],['yesterday','Missed yesterday',RED],['tomorrow','Due tomorrow',TEAL2]].map(([key,label,tone])=><div key={key} className="rounded-2xl p-3" style={{background:"#F4FAF8"}}><div className="flex items-center justify-between mb-2"><p className="text-[10px] font-bold" style={{color:tone}}>{label}</p><span className="text-xs font-bold" style={{color:TEAL}}>{outlook[key].length}</span></div>{outlook[key].slice(0,3).map(p=><PersonRow key={p.id} p={p} label={p.contact||"Open patient"} tone={tone} onSelect={selectPatient}/>)}{!outlook[key].length&&<p className="text-[9px]" style={{color:MUTED}}>None</p>}{outlook[key].length>3&&<p className="text-[9px] mt-2 text-right" style={{color:MUTED}}>+{outlook[key].length-3} more</p>}</div>)}
      </div>
    </Section>

    <Section icon={<IndianRupee size={16}/>} title="Today's Collection" subtitle="Patient collections + standalone pharmacy sales">
      <div className="grid grid-cols-2 gap-2.5"><div className="rounded-2xl p-3" style={{background:"#F4FAF8"}}><p className="text-[9px]" style={{color:MUTED}}>Patient collection</p><p className="text-lg font-bold mt-1" style={{color:TEAL}}>{money(actualPatient)}</p></div><div className="rounded-2xl p-3" style={{background:"#F4FAF8"}}><p className="text-[9px]" style={{color:MUTED}}>Pharmacy sales</p><p className="text-lg font-bold mt-1" style={{color:TEAL}}>{money(pharmacySales)}</p></div></div>
      <div className="mt-3 grid grid-cols-3 gap-2"><div className="rounded-xl p-2.5 flex items-center gap-1.5" style={{background:"#F8FAFC"}}><Banknote size={13}/><div><p className="text-[9px]" style={{color:MUTED}}>Cash</p><p className="text-[10px] font-bold" style={{color:TEAL}}>{money(collection.mode.cash)}</p></div></div><div className="rounded-xl p-2.5 flex items-center gap-1.5" style={{background:"#F8FAFC"}}><Smartphone size={13}/><div><p className="text-[9px]" style={{color:MUTED}}>UPI</p><p className="text-[10px] font-bold" style={{color:TEAL}}>{money(collection.mode.upi)}</p></div></div><div className="rounded-xl p-2.5 flex items-center gap-1.5" style={{background:"#F8FAFC"}}><CreditCard size={13}/><div><p className="text-[9px]" style={{color:MUTED}}>Card</p><p className="text-[10px] font-bold" style={{color:TEAL}}>{money(collection.mode.card)}</p></div></div></div>
      <p className="text-[9px] mt-2" style={{color:MUTED}}>Pharmacy sales are kept separate because the current pharmacy_sales record does not contain a payment-mode/receipt field.</p>
    </Section>

    <Section icon={<ClipboardList size={16}/>} title="Today's Priorities" subtitle="Only things that can require action today">
      <div className="space-y-2">{priorities.slice(0,5).map((x,i)=><button key={i} type="button" onClick={()=>x.go&&onNavigate?.(x.go)} className="w-full flex items-center gap-3 p-3 rounded-2xl text-left" style={{background:"#F4FAF8"}}><div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold" style={{background:i===0?"#FEF3C7":"#14B8A61A",color:i===0?AMBER:TEAL2}}>{i+1}</div><div className="flex-1 min-w-0"><p className="text-xs font-semibold" style={{color:TEAL}}>{x.label}</p><p className="text-[9px] mt-0.5 truncate" style={{color:MUTED}}>{x.detail}</p></div>{x.go&&<ArrowRight size={14} color={TEAL2}/>}</button>)}</div>
    </Section>

    <div className="grid grid-cols-2 gap-3">
      <Section icon={<Package size={15}/>} title="Medicine to Order" subtitle={`${inventory.orders.length} low-stock unit products`}><p className="text-lg font-bold" style={{color:TEAL}}>{inventory.orders.length}</p><p className="text-[9px] mt-1 truncate" style={{color:MUTED}}>{inventory.orders.slice(0,2).map(x=>x.name).join(", ")||"No low-stock units"}</p><button onClick={()=>onNavigate?.("reports")} className="text-[9px] font-bold mt-2" style={{color:TEAL2}}>View Orders →</button></Section>
      <Section icon={<RefreshCw size={15}/>} title="Refills" subtitle={`${inventory.refills.length} volume products due`}><p className="text-lg font-bold" style={{color:TEAL}}>{inventory.refills.length}</p><p className="text-[9px] mt-1 truncate" style={{color:MUTED}}>{inventory.refills.slice(0,2).map(x=>x.name).join(", ")||"No refill due"}</p><button onClick={()=>onNavigate?.("reports")} className="text-[9px] font-bold mt-2" style={{color:TEAL2}}>View Refills →</button></Section>
    </div>

    <div className="grid grid-cols-2 gap-3">
      <Section icon={<WalletCards size={15}/>} title="Patient Payments" subtitle={`${pendingPayments.length} patients pending`}><p className="text-lg font-bold" style={{color:TEAL}}>{money(pendingPayments.reduce((s,x)=>s+x.amount,0))}</p><p className="text-[9px] mt-1" style={{color:MUTED}}>{pendingPayments[0]?`Highest: ${pendingPayments[0].patient.name} · ${money(pendingPayments[0].amount)}`:"No pending patient balance"}</p><button onClick={()=>onNavigate?.("reports")} className="text-[9px] font-bold mt-2" style={{color:TEAL2}}>View Pending →</button></Section>
      <Section icon={<Building2 size={15}/>} title="MR Payments" subtitle={`${mrPending.count} pending orders`}><p className="text-lg font-bold" style={{color:TEAL}}>{money(mrPending.amount)}</p><p className="text-[9px] mt-1" style={{color:MUTED}}>Outstanding MR amount</p><button onClick={()=>onNavigate?.("mr")} className="text-[9px] font-bold mt-2" style={{color:TEAL2}}>View MR →</button></Section>
    </div>

    <Section icon={<Sparkles size={16}/>} title="HomeoCure Intelligence" subtitle="Official-source updates for homoeopathy, AYUSH and related evidence" action={<button onClick={()=>onNavigate?.("intelligence")} className="text-[10px] font-bold" style={{color:TEAL2}}>Open →</button>}>
      {intel.items.length ? <div className="space-y-2">{intel.items.map(i=><button key={i.id} onClick={()=>onNavigate?.("intelligence")} className="w-full text-left rounded-2xl p-3" style={{background:"#F4FAF8"}}><div className="flex justify-between gap-2"><span className="text-[9px] font-bold" style={{color:TEAL2}}>{i.category} · {i.source}</span><span className="text-[9px]" style={{color:MUTED}}>{i.date}</span></div><p className="text-xs font-semibold mt-1" style={{color:TEAL}}>{i.title}</p></button>)}</div> : <div className="rounded-2xl p-3" style={{background:"#F4FAF8"}}><p className="text-xs font-semibold" style={{color:TEAL}}>{intel.error?"Feed needs refresh":"Checking official sources…"}</p><p className="text-[9px] mt-1" style={{color:MUTED}}>Open Intelligence for the full feed and source links.</p></div>}
    </Section>

    <Section icon={<Activity size={16}/>} title="HomeoCure Accuracy" subtitle="Prediction → actual outcome. No fake accuracy numbers."><div className="grid grid-cols-2 gap-2.5"><div className="rounded-2xl p-3" style={{background:"#F4FAF8"}}><p className="text-[9px]" style={{color:MUTED}}>Patient forecast</p><p className="text-sm font-bold mt-1" style={{color:TEAL}}>Not enough data yet</p></div><div className="rounded-2xl p-3" style={{background:"#F4FAF8"}}><p className="text-[9px]" style={{color:MUTED}}>Income forecast</p><p className="text-sm font-bold mt-1" style={{color:TEAL}}>Not enough data yet</p></div><div className="rounded-2xl p-3" style={{background:"#F4FAF8"}}><p className="text-[9px]" style={{color:MUTED}}>Medicine orders</p><p className="text-sm font-bold mt-1" style={{color:TEAL}}>Not enough data yet</p></div><div className="rounded-2xl p-3" style={{background:"#F4FAF8"}}><p className="text-[9px]" style={{color:MUTED}}>Overall intelligence</p><p className="text-sm font-bold mt-1" style={{color:TEAL}}>Building baseline</p></div></div><p className="text-[9px] mt-3" style={{color:MUTED}}>Accuracy will appear only after enough predictions have been stored and compared with real outcomes.</p></Section>

    {weather&&<div className="rounded-2xl bg-white p-3 shadow-sm flex items-center gap-2"><CloudSun size={17} color={TEAL2}/><p className="text-[10px]" style={{color:TEAL}}><b>Gonda:</b> {weather.temperature}° · {weather.condition}{weather.rain_probability!=null?` · ${weather.rain_probability}% rain risk`:""}</p></div>}
    {!weather&&weatherError&&<div className="text-center text-[9px]" style={{color:MUTED}}>Weather context unavailable right now.</div>}
    <p className="text-[9px] text-center px-2" style={{color:"#0A5C5466"}}>Today is an operational overview. Forecasts are estimates from recorded clinic data, not guarantees.</p>
  </div>;
}
