import React,{useEffect,useMemo,useState} from "react";
import {Activity,RefreshCw} from "lucide-react";
import {supabase} from "../supabaseClient";
import {buildPredictionAccuracy} from "../utils/predictionAccuracy";
const TEAL="#0A5C54",TEAL2="#148A7A",MUTED="#0A5C5499";
const fmt=n=>n==null?"Not enough data":`${Math.round(n)}%`;
function Card({label,data}){return <div className="rounded-2xl p-3" style={{background:"#F4FAF8"}}><p className="text-[9px]" style={{color:MUTED}}>{label}</p><p className="text-sm font-bold mt-1" style={{color:TEAL}}>{fmt(data?.accuracy)}</p><p className="text-[8px] mt-1" style={{color:MUTED}}>{data?.samples?`Based on ${data.samples} historical comparisons`:"Historical comparisons are building"}</p></div>}
export default function AccuracyPanel({patients=[]}){
 const [sales,setSales]=useState([]),[loading,setLoading]=useState(true),[refresh,setRefresh]=useState(0);
 useEffect(()=>{let alive=true;(async()=>{setLoading(true);const {data}=await supabase.from("pharmacy_sales").select("qty,sold_at,patient_id").not("qty","is",null).order("sold_at",{ascending:true});if(alive){setSales(data||[]);setLoading(false)}})().catch(()=>alive&&setLoading(false));return()=>{alive=false}},[refresh]);
 const accuracy=useMemo(()=>buildPredictionAccuracy(patients,sales),[patients,sales]);
 return <section className="bg-white rounded-3xl p-4 shadow-sm"><div className="flex items-start justify-between gap-3 mb-3"><div className="flex items-start gap-2.5"><div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{background:"#14B8A61A",color:TEAL2}}><Activity size={16}/></div><div><p className="text-sm font-bold" style={{color:TEAL}}>HomeoCure Accuracy</p><p className="text-[10px] mt-0.5" style={{color:MUTED}}>Historical backtest: prediction → actual</p></div></div><button type="button" onClick={()=>setRefresh(v=>v+1)} className="w-8 h-8 rounded-xl flex items-center justify-center" style={{background:"#F4FAF8",color:TEAL2}}><RefreshCw size={14} className={loading?"animate-spin":""}/></button></div><div className="grid grid-cols-2 gap-2.5"><Card label="Patient forecast" data={accuracy.patient}/><Card label="Income forecast" data={accuracy.income}/><Card label="Medicine demand" data={accuracy.medicine}/><Card label="Overall intelligence" data={accuracy.overall}/></div><p className="text-[9px] mt-3 leading-relaxed" style={{color:MUTED}}>Numbers are shown only from historical prediction-versus-outcome comparisons. The backtest never uses future-day data to make an earlier prediction.</p></section>;
}
