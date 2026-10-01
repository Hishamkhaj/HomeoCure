import React, { useEffect, useMemo, useState } from "react";
import { Activity, ArrowRight, Banknote, Building2, CalendarDays, ChevronRight, CloudSun, CreditCard, IndianRupee, Package, RefreshCw, Sparkles, Smartphone, Users, WalletCards, ClipboardList } from "lucide-react";
import { supabase } from "../supabaseClient";
import AccuracyPanel from "./AccuracyPanel";

const DAY=86400000, TEAL="#0A5C54", TEAL2="#148A7A", MUTED="#0A5C5499", RED="#DC2626", AMBER="#B45309", GREEN="#15803D";
const dateKey=(d=new Date())=>{const x=new Date(d);return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,"0")}-${String(x.getDate()).padStart(2,"0")}`};
const money=n=>`₹${Math.round(Number(n)||0).toLocaleString("en-IN")}`;
const visitsOf=p=>[...(p?.visits||[])].filter(v=>Number(v.ts)).sort((a,b)=>a.ts-b.ts);
const lastVisit=p=>visitsOf(p).at(-1)||null;
const dueTs=p=>{const v=lastVisit(p);return v?.duration_days?v.ts+Number(v.duration_days)*DAY:null};
const initial=n=>(n||"?").trim().slice(0,1).toUpperCase();

function Section({icon,title,subtitle,action,children}){return <section className="bg-white rounded-3xl p-4 shadow-sm"><div className="flex items-start justify-between gap-3 mb-3"><div className="flex items-start gap-2.5 min-w-0"><div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{background:"#14B8A61A",color:TEAL2}}>{icon}</div><div className="min-w-0"><p className="text-sm font-bold" style={{color:TEAL}}>{title}</p>{subtitle&&<p className="text-[10px] mt-0.5 truncate" style={{color:MUTED}}>{subtitle}</p>}</div></div>{action}</div>{children}</section>}
function Metric({icon,label,value,sub,onClick}){const body=<><div className="flex items-center gap-1.5" style={{color:TEAL2}}>{icon}<span className="text-[9px] font-bold uppercase tracking-wide">{label}</span></div><p className="text-xl font-bold mt-1" style={{color:TEAL}}>{value}</p>{sub&&<p className="text-[9px] mt-0.5" style={{color:MUTED}}>{sub}</p>}</>;return onClick?<button type="button" onClick={onClick} className="bg-white rounded-2xl p-3 shadow-sm text-left w-full">{body}</button>:<div className="bg-white rounded-2xl p-3 shadow-sm">{body}</div>}
function PersonRow({patient,label,onSelect,tone=TEAL2}){return <button type="button" onClick={()=>onSelect?.(patient)} className="w-full flex items-center gap-2.5 p-2.5 rounded-2xl text-left" style={{background:"#F4FAF8"}}><div className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0" style={{background:"#14B8A61A",color:TEAL2}}>{initial(patient?.name)}</div><div className="min-w-0 flex-1"><p className="text-xs font-semibold truncate" style={{color:TEAL}}>{patient?.name||"Unnamed patient"}</p><p className="text-[9px] mt-0.5 truncate" style={{color:MUTED}}>{label}</p></div><ChevronRight size={14} color={tone}/></button>}
export default function TodayView({patients=[],onSelect,onSelectPatient,onNavigate}){
 const selectPatient=onSelectPatient||onSelect;
 const [now,setNow]=useState(()=>new Date()),[weather,setWeather]=useState(null),[inventory,setInventory]=useState({orders:[],refills:[]}),[mrPending,setMrPending]=useState({amount:0,count:0}),[intel,setIntel]=useState([]),[intelError,setIntelError]=useState(false),[pharmacySales,setPharmacySales]=useState(0),[showTodayPatients,setShowTodayPatients]=useState(false);
 useEffect(()=>{const t=setInterval(()=>setNow(new Date()),60000);return()=>clearInterval(t)},[]);
 const today=dateKey(now),yesterday=dateKey(new Date(now.getTime()-DAY)),tomorrow=dateKey(new Date(now.getTime()+DAY));
 const visitsToday=useMemo(()=>patients.flatMap(p=>visitsOf(p).filter(v=>dateKey(new Date(v.ts))===today).map(visit=>({patient:p,visit}))),[patients,today]);
 const todayPatients=useMemo(()=>{const seen=new Set();return visitsToday.filter(({patient})=>{if(seen.has(patient.id))return false;seen.add(patient.id);return true})},[visitsToday]);
 const outlook=useMemo(()=>{const g={today:[],yesterday:[],tomorrow:[]};patients.filter(p=>p.status==="open").forEach(p=>{const d=dueTs(p);if(!d)return;const k=dateKey(new Date(d));if(k===today)g.today.push(p);else if(k===yesterday)g.yesterday.push(p);else if(k===tomorrow)g.tomorrow.push(p)});return g},[patients,today,yesterday,tomorrow]);
 const pendingPayments=useMemo(()=>patients.map(patient=>({patient,amount:(patient.visits||[]).reduce((s,v)=>s+Math.max(0,(Number(v.cost)||0)-(Number(v.paid_amount)||0)),0)})).filter(x=>x.amount>0).sort((a,b)=>b.amount-a.amount),[patients]);
 const collection=useMemo(()=>{const mode={cash:0,upi:0,card:0,other:0};let patient=0;visitsToday.forEach(({visit})=>{let events=Array.isArray(visit.payment_log)&&visit.payment_log.length?visit.payment_log.filter(x=>x.date===today).map(x=>({amount:Number(x.amount)||0,mode:String(x.mode||visit.payment_mode||"cash").toLowerCase()})):[{amount:Number(visit.paid_amount)||0,mode:String(visit.payment_mode||"cash").toLowerCase()}];events.forEach(e=>{if(e.amount<=0)return;patient+=e.amount;if(e.mode.includes("upi"))mode.upi+=e.amount;else if(e.mode.includes("card"))mode.card+=e.amount;else if(e.mode.includes("cash"))mode.cash+=e.amount;else mode.other+=e.amount})});return {patient,mode}},[visitsToday,today]);

 useEffect(()=>{let alive=true;(async()=>{const [{data:products},{data:categories},{data:mrOrders},{data:sales}]=await Promise.all([
   supabase.from("pharmacy_products").select("id,name,price,stock,low_stock_threshold,tracking_type,remaining_ml,low_volume_threshold_ml,category_id"),
   supabase.from("pharmacy_categories").select("id,name,show_in_refills"),
   supabase.from("mr_orders").select("id,bill_amount,paid_amount"),
   supabase.from("pharmacy_sales").select("product_id,product_name,qty,ml_dispensed,sold_at,patient_id,payment_mode").eq("sold_at",today).is("patient_id",null).not("qty","is",null)
 ]);if(!alive)return;const cats=new Map((categories||[]).map(c=>[c.id,c]));setInventory({orders:(products||[]).filter(p=>p.tracking_type!=="volume"&&Number(p.stock||0)<=Number(p.low_stock_threshold??2)).map(p=>({...p,category:cats.get(p.category_id)?.name||""})),refills:(products||[]).filter(p=>p.tracking_type==="volume"&&cats.get(p.category_id)?.show_in_refills===true&&Number(p.remaining_ml||0)<=Number(p.low_volume_threshold_ml??50)).map(p=>({...p,category:cats.get(p.category_id)?.name||""}))});const pm=new Map((products||[]).map(p=>[p.id,p]));setPharmacySales((sales||[]).reduce((sum,s)=>sum+(Number(s.qty)||0)*(Number(pm.get(s.product_id)?.price)||0),0));const mr=(mrOrders||[]).reduce((s,r)=>s+Math.max(0,(Number(r.bill_amount)||0)-(Number(r.paid_amount)||0)),0);setMrPending({amount:mr,count:(mrOrders||[]).filter(r=>(Number(r.bill_amount)||0)-(Number(r.paid_amount)||0)>0).length})})().catch(()=>{});return()=>{alive=false}},[today]);
 useEffect(()=>{let alive=true;fetch("/api/weather?city=Gonda&country=India").then(r=>r.ok?r.json():Promise.reject()).then(d=>alive&&setWeather(d)).catch(()=>{});return()=>{alive=false}},[today]);
 useEffect(()=>{let alive=true;fetch("/api/intelligence").then(r=>r.ok?r.json():Promise.reject()).then(d=>{if(alive){setIntel((d.items||[]).slice(0,2));setIntelError(false)}}).catch(()=>alive&&setIntelError(true));return()=>{alive=false}},[today]);
 const pendingTotal=pendingPayments.reduce((s,x)=>s+x.amount,0),totalCollected=collection.patient+pharmacySales;
 const historicalWeekday=useMemo(()=>{
   const targetDay=now.getDay(), byDate=new Map();
   patients.forEach(p=>visitsOf(p).forEach(v=>{
     const d=new Date(v.ts), k=dateKey(d);
     if(k===today || d.getDay()!==targetDay) return;
     const row=byDate.get(k)||{patients:new Set(),income:0};
     row.patients.add(p.id);
     row.income+=Math.max(0,Number(v.paid_amount)||0);
     byDate.set(k,row);
   }));
   const days=[...byDate.entries()].sort((a,b)=>b[0].localeCompare(a[0])).slice(0,8);
   return {
     days,
     avgPatients:days.length?days.reduce((s,x)=>s+x[1].patients.size,0)/days.length:0,
     avgPerPatient:days.length?days.reduce((s,x)=>s+x[1].income,0)/Math.max(1,days.reduce((s,x)=>s+x[1].patients.size,0)):0
   };
 },[patients,today,now]);

 const expectedIncomeModel=useMemo(()=>{
   const seen=new Set(todayPatients.map(x=>x.patient.id));
   const candidates=[...new Map(
     [...outlook.today,...outlook.yesterday]
       .filter(p=>!seen.has(p.id))
       .map(p=>[p.id,p])
   ).values()];
   const weightedPatients=candidates.reduce((s,p)=>s+(outlook.today.includes(p)?0.65:0.35),0);
   const expectedPatients=Math.max(
     todayPatients.length,
     Math.round(historicalWeekday.avgPatients*0.45+(todayPatients.length+weightedPatients)*0.55)
   );
   const patientIncome=Math.max(
     collection.patient,
     Math.round(expectedPatients*Math.max(historicalWeekday.avgPerPatient,0))
   );
   return {patients:expectedPatients,income:Math.round(patientIncome+pharmacySales),historyDays:historicalWeekday.days.length};
 },[todayPatients,outlook,historicalWeekday,collection.patient,pharmacySales]);

 const expectedBase=Math.max(visitsToday.length,expectedIncomeModel.patients,outlook.today.length+outlook.yesterday.length),expectedRange=[expectedBase,Math.max(expectedBase,expectedIncomeModel.patients+Math.round(outlook.tomorrow.length*.25))];

 const priorities=[];if(outlook.yesterday.length)priorities.push({label:`${outlook.yesterday.length} missed yesterday`,detail:"Follow up before the gap gets longer",go:"followup"});if(inventory.orders.length)priorities.push({label:`${inventory.orders.length} medicine${inventory.orders.length>1?"s":""} to order`,detail:inventory.orders.slice(0,2).map(x=>x.name).join(", "),go:"reports"});if(inventory.refills.length)priorities.push({label:`${inventory.refills.length} refill${inventory.refills.length>1?"s":""} due`,detail:inventory.refills.slice(0,2).map(x=>x.name).join(", "),go:"reports"});if(pendingPayments.length)priorities.push({label:`${pendingPayments.length} patient payment${pendingPayments.length>1?"s":""} pending`,detail:`${money(pendingTotal)} outstanding`,go:"reports"});if(mrPending.amount)priorities.push({label:"MR payment pending",detail:money(mrPending.amount),go:"mr"});if(!priorities.length)priorities.push({label:"No urgent operational task",detail:"Your dashboard is clear right now",go:null});
 const clinicOpen=(()=>{const m=now.getHours()*60+now.getMinutes();return(m>=600&&m<840)||(m>=1020&&m<1260)})();
  return (
 <div className="space-y-4 pb-4">
  <div className="px-1 flex items-end justify-between"><div><p className="text-[10px] font-bold uppercase tracking-wide" style={{color:TEAL2}}>Today at {now.toLocaleTimeString("en-IN",{hour:"numeric",minute:"2-digit"})}</p><h1 className="text-xl font-bold font-serif" style={{color:TEAL}}>{now.toLocaleDateString("en-IN",{weekday:"long",day:"numeric",month:"long"})}</h1></div><span className="text-[9px] font-bold px-2.5 py-1.5 rounded-full bg-white shadow-sm" style={{color:clinicOpen?GREEN:AMBER}}>● {clinicOpen?"Clinic open":"Clinic closed"}</span></div>
  <div className="grid grid-cols-2 gap-3"><Metric icon={<Users size={14}/>} label="Patients" value={todayPatients.length} sub="Seen today" onClick={()=>onNavigate?.("patients")}/><Metric icon={<Activity size={14}/>} label="Expected" value={expectedRange[0]===expectedRange[1]?expectedRange[0]:`${expectedRange[0]}–${expectedRange[1]}`} sub="Today outlook"/><Metric icon={<WalletCards size={14}/>} label="Collected" value={money(totalCollected)} sub="Patient + pharmacy"/><Metric icon={<CalendarDays size={14}/>} label="Follow-ups" value={outlook.today.length+outlook.yesterday.length} sub="Due + missed" onClick={()=>onNavigate?.("followup")}/></div>
  
  <Section icon={<IndianRupee size={16}/>} title="Expected Today's Income" subtitle={expectedIncomeModel.historyDays ? "Same-weekday history + today's due/missed patients" : "Based on today's due/missed patients"}>
    <div className="flex items-end justify-between gap-3">
      <div><p className="text-2xl font-bold" style={{color:TEAL}}>{money(expectedIncomeModel.income)}</p><p className="text-[9px] mt-1" style={{color:MUTED}}>Estimated end-of-day collection</p></div>
      <div className="text-right"><p className="text-[9px]" style={{color:MUTED}}>Expected patients</p><p className="text-sm font-bold" style={{color:TEAL}}>{expectedIncomeModel.patients}</p></div>
    </div>
    <p className="text-[9px] mt-3" style={{color:MUTED}}>Due today gets the strongest weight. Yesterday's missed patients get a smaller return probability. Tomorrow's due patients are not counted as today's income.</p>
  </Section>

  <Section icon={<Users size={16}/>} title="Today's Patients" subtitle={`${todayPatients.length} patient${todayPatients.length!==1?"s":""} seen today`} action={!showTodayPatients && todayPatients.length > 5 && <button type="button" onClick={()=>setShowTodayPatients(true)} className="text-[10px] font-bold" style={{color:TEAL2}}>View all →</button>}>
    {todayPatients.length ? (
      <div className="space-y-2">
        {todayPatients.slice(0, showTodayPatients ? todayPatients.length : 5).map(({patient,visit})=><PersonRow key={patient.id} patient={patient} label={visit?.complaint||"Consultation today"} onSelect={selectPatient}/>)}
        {todayPatients.length > 5 && !showTodayPatients && <button type="button" onClick={()=>setShowTodayPatients(true)} className="w-full text-center text-[10px] font-bold pt-1" style={{color:TEAL2}}>+{todayPatients.length-5} more patients ↓</button>}
        {showTodayPatients && <button type="button" onClick={()=>onNavigate?.("patients")} className="w-full text-center text-[10px] font-bold pt-1" style={{color:TEAL2}}>Open Patients Page →</button>}
      </div>
    ) : (
      <div className="rounded-2xl p-3" style={{background:"#F4FAF8"}}>
        <p className="text-xs font-semibold" style={{color:TEAL}}>No patient has been recorded today yet.</p>
        <p className="text-[9px] mt-1" style={{color:MUTED}}>Patient names will appear here automatically after a visit is saved.</p>
      </div>
    )}
  </Section>
  
  <Section icon={<CalendarDays size={16}/>} title="Today's Patient Outlook" subtitle="Priority: today → missed yesterday → tomorrow" action={<button type="button" onClick={()=>onNavigate?.("followup")} className="text-[10px] font-bold" style={{color:TEAL2}}>Follow-up</button>}><div className="space-y-2">{[["today","Due today",AMBER],["yesterday","Missed yesterday",RED],["tomorrow","Due tomorrow",TEAL2]].map(([key,label,tone])=><div key={key} className="rounded-2xl p-3" style={{background:"#F4FAF8"}}><div className="flex items-center justify-between mb-2"><p className="text-[10px] font-bold" style={{color:tone}}>{label}</p><span className="text-xs font-bold" style={{color:TEAL}}>{outlook[key].length}</span></div>{outlook[key].slice(0,3).map(p=><div key={p.id} className="mb-2 last:mb-0"><PersonRow patient={p} label={p.contact||"Open patient"} tone={tone} onSelect={selectPatient}/></div>)}{!outlook[key].length&&<p className="text-[9px]" style={{color:MUTED}}>None</p>}{outlook[key].length>3&&<p className="text-[9px] mt-2 text-right" style={{color:MUTED}}>+{outlook[key].length-3} more</p>}</div>)}</div></Section>
  
  <Section icon={<IndianRupee size={16}/>} title="Today's Collection" subtitle="Patient collections + standalone pharmacy sales"><div className="grid grid-cols-2 gap-2.5"><div className="rounded-2xl p-3" style={{background:"#F4FAF8"}}><p className="text-[9px]" style={{color:MUTED}}>Patient collection</p><p className="text-lg font-bold mt-1" style={{color:TEAL}}>{money(collection.patient)}</p></div><div className="rounded-2xl p-3" style={{background:"#F4FAF8"}}><p className="text-[9px]" style={{color:MUTED}}>Pharmacy sales</p><p className="text-lg font-bold mt-1" style={{color:TEAL}}>{money(pharmacySales)}</p></div></div><div className="mt-3 grid grid-cols-3 gap-2">{[["Cash",collection.mode.cash,<Banknote size={13}/>],["UPI",collection.mode.upi,<Smartphone size={13}/>],["Card",collection.mode.card,<CreditCard size={13}/>]].map(([label,value,icon])=><div key={label} className="rounded-xl p-2.5 flex items-center gap-1.5" style={{background:"#F8FAFC"}}>{icon}<div><p className="text-[9px]" style={{color:MUTED}}>{label}</p><p className="text-[10px] font-bold" style={{color:TEAL}}>{money(value)}</p></div></div>)}</div><p className="text-[9px] mt-2" style={{color:MUTED}}>Standalone pharmacy sales use the same patient_id/qty rule as Income.</p></Section>
  
  <Section icon={<ClipboardList size={16}/>} title="Today's Priorities" subtitle="Only actions that may need attention today"><div className="space-y-2">{priorities.slice(0,5).map((x,i)=><button type="button" key={`${x.label}-${i}`} onClick={()=>x.go&&onNavigate?.(x.go)} className="w-full flex items-center gap-3 p-3 rounded-2xl text-left" style={{background:"#F4FAF8"}}><div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold" style={{background:i===0?"#FEF3C7":"#14B8A61A",color:i===0?AMBER:TEAL2}}>{i+1}</div><div className="flex-1 min-w-0"><p className="text-xs font-semibold" style={{color:TEAL}}>{x.label}</p><p className="text-[9px] mt-0.5 truncate" style={{color:MUTED}}>{x.detail}</p></div>{x.go&&<ArrowRight size={14} color={TEAL2}/>}</button>)}</div></Section>
  
  <div className="grid grid-cols-2 gap-3"><Section icon={<Package size={15}/>} title="Medicine to Order" subtitle={`${inventory.orders.length} low-stock unit products`}><p className="text-lg font-bold" style={{color:TEAL}}>{inventory.orders.length}</p><p className="text-[9px] mt-1 truncate" style={{color:MUTED}}>{inventory.orders.slice(0,2).map(x=>x.name).join(", ")||"No low-stock units"}</p><button type="button" onClick={()=>onNavigate?.("reports")} className="text-[9px] font-bold mt-2" style={{color:TEAL2}}>View Orders →</button></Section><Section icon={<RefreshCw size={15}/>} title="Refills" subtitle={`${inventory.refills.length} volume products due`}><p className="text-lg font-bold" style={{color:TEAL}}>{inventory.refills.length}</p><p className="text-[9px] mt-1 truncate" style={{color:MUTED}}>{inventory.refills.slice(0,2).map(x=>x.name).join(", ")||"No refill due"}</p><button type="button" onClick={()=>onNavigate?.("reports")} className="text-[9px] font-bold mt-2" style={{color:TEAL2}}>View Refills →</button></Section></div>
  
  <div className="grid grid-cols-2 gap-3"><Section icon={<WalletCards size={15}/>} title="Patient Payments" subtitle={`${pendingPayments.length} patients pending`}><p className="text-lg font-bold" style={{color:TEAL}}>{money(pendingTotal)}</p><p className="text-[9px] mt-1 truncate" style={{color:MUTED}}>{pendingPayments[0]?`Highest: ${pendingPayments[0].patient.name} · ${money(pendingPayments[0].amount)}`:"No pending patient balance"}</p><button type="button" onClick={()=>onNavigate?.("reports")} className="text-[9px] font-bold mt-2" style={{color:TEAL2}}>View Pending →</button></Section><Section icon={<Building2 size={15}/>} title="MR Payments" subtitle={`${mrPending.count} pending orders`}><p className="text-lg font-bold" style={{color:TEAL}}>{money(mrPending.amount)}</p><p className="text-[9px] mt-1" style={{color:MUTED}}>Outstanding MR amount</p><button type="button" onClick={()=>onNavigate?.("mr")} className="text-[9px] font-bold mt-2" style={{color:TEAL2}}>View MR →</button></Section></div>
  
  <Section icon={<Sparkles size={16}/>} title="HomeoCure Intelligence" subtitle="Official-source updates for homoeopathy, AYUSH and related evidence" action={<button type="button" onClick={()=>onNavigate?.("intelligence")} className="text-[10px] font-bold" style={{color:TEAL2}}>Open →</button>}>
    {intel.length ? (
      <div className="space-y-2">
        {intel.map(i=><button type="button" key={i.id} onClick={()=>onNavigate?.("intelligence")} className="w-full text-left rounded-2xl p-3" style={{background:"#F4FAF8"}}><div className="flex justify-between gap-2"><span className="text-[9px] font-bold" style={{color:TEAL2}}>{i.category} · {i.source}</span><span className="text-[9px]" style={{color:MUTED}}>{i.date}</span></div><p className="text-xs font-semibold mt-1" style={{color:TEAL}}>{i.title}</p></button>)}
      </div>
    ) : (
      <div className="rounded-2xl p-3" style={{background:"#F4FAF8"}}>
        <p className="text-xs font-semibold" style={{color:TEAL}}>{intelError?"Feed needs refresh":"Checking official sources…"}</p>
        <p className="text-[9px] mt-1" style={{color:MUTED}}>Open Intelligence for the full feed and source links.</p>
      </div>
    )}
  </Section>

  <AccuracyPanel />

 </div>
 );
}
