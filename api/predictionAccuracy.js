// HomeoCure prediction accuracy utilities.
// Backtesting compares a prediction made using only data available before a target day
// with the actual outcome on that day. It intentionally does not use future data.

const DAY = 86400000;

export const dateKey = (d) => {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,"0")}-${String(x.getDate()).padStart(2,"0")}`;
};

const visitsOf = (p) => [...(p?.visits || [])].filter(v => Number(v?.ts)).sort((a,b)=>Number(a.ts)-Number(b.ts));
const clamp = (n,min=0,max=100) => Math.max(min, Math.min(max, Number(n)||0));
const accuracyFrom = (predicted, actual) => clamp(100-(Math.abs((Number(predicted)||0)-(Number(actual)||0))/Math.max(Math.abs(Number(actual)||0),1))*100);

function dailyStats(patients,key){
  const people=new Set(); let income=0;
  patients.forEach(p=>visitsOf(p).forEach(v=>{
    if(dateKey(v.ts)!==key)return;
    people.add(p.id); income+=Math.max(0,Number(v.paid_amount)||0);
  }));
  return {patients:people.size,income};
}
function lastVisitBefore(p,targetMs){
  let found=null;
  for(const v of visitsOf(p)){if(Number(v.ts)<targetMs)found=v;else break;}
  return found;
}
function forecastForDay(patients,targetKey){
  const targetMs=new Date(`${targetKey}T12:00:00`).getTime();
  const weekday=new Date(targetMs).getDay();
  const keys=new Set();
  patients.forEach(p=>visitsOf(p).forEach(v=>{
    const d=new Date(v.ts),k=dateKey(v.ts);
    if(k!==targetKey&&d.getTime()<targetMs&&d.getDay()===weekday)keys.add(k);
  }));
  const history=[...keys].sort((a,b)=>b.localeCompare(a)).slice(0,8).map(k=>({key:k,...dailyStats(patients,k)}));
  const avgPatients=history.length?history.reduce((s,x)=>s+x.patients,0)/history.length:0;
  const totalPeople=history.reduce((s,x)=>s+x.patients,0);
  const avgPerPatient=history.reduce((s,x)=>s+x.income,0)/Math.max(totalPeople,1);
  const yesterdayKey=dateKey(new Date(targetMs-DAY));
  let dueToday=0,missedYesterday=0;
  patients.forEach(p=>{
    const v=lastVisitBefore(p,targetMs); if(!v||!Number(v.duration_days))return;
    const dk=dateKey(Number(v.ts)+Number(v.duration_days)*DAY);
    if(dk===targetKey)dueToday++; else if(dk===yesterdayKey)missedYesterday++;
  });
  const weighted=dueToday*.65+missedYesterday*.35;
  const predictedPatients=Math.max(0,Math.round(avgPatients*.45+weighted*.55));
  return {predictedPatients,predictedIncome:Math.max(0,Math.round(predictedPatients*avgPerPatient)),historyDays:history.length};
}

export function buildPredictionAccuracy(patients=[],pharmacySales=[]){
  const allKeys=new Set();
  patients.forEach(p=>visitsOf(p).forEach(v=>allKeys.add(dateKey(v.ts))));
  const keys=[...allKeys].sort().slice(-61,-1);
  const patientResults=[],incomeResults=[];
  keys.forEach(key=>{
    const pred=forecastForDay(patients,key); if(pred.historyDays<2)return;
    const actual=dailyStats(patients,key);
    patientResults.push(accuracyFrom(pred.predictedPatients,actual.patients));
    incomeResults.push(accuracyFrom(pred.predictedIncome,actual.income));
  });

  const salesByDay=new Map();
  (pharmacySales||[]).forEach(s=>{
    if(!s?.sold_at||s?.qty==null)return;
    const k=dateKey(s.sold_at),q=Math.max(0,Number(s.qty)||0);
    salesByDay.set(k,(salesByDay.get(k)||0)+q);
  });
  const saleKeys=[...salesByDay.keys()].sort(), medicineResults=[];
  for(let i=1;i<saleKeys.length;i++){
    const previous=saleKeys.slice(Math.max(0,i-7),i);
    if(previous.length<3)continue;
    const avg=previous.reduce((s,k)=>s+(salesByDay.get(k)||0),0)/previous.length;
    medicineResults.push(accuracyFrom(avg,salesByDay.get(saleKeys[i])||0));
    if(medicineResults.length>=45)break;
  }
  const avg=arr=>arr.length?arr.reduce((s,x)=>s+x,0)/arr.length:null;
  const patient=avg(patientResults),income=avg(incomeResults),medicine=avg(medicineResults);
  const parts=[patient,income,medicine].filter(x=>x!=null);
  return {
    patient:{accuracy:patient,samples:patientResults.length},
    income:{accuracy:income,samples:incomeResults.length},
    medicine:{accuracy:medicine,samples:medicineResults.length},
    overall:{accuracy:avg(parts),samples:parts.length?Math.min(...[patientResults.length,incomeResults.length,medicineResults.length].filter(n=>n>0)):0}
  };
}
