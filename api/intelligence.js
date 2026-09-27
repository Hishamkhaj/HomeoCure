const SOURCES = [
  { source: "NCH", url: "https://nch.org.in/news", category: "Regulation" },
  { source: "NIH", url: "https://nih.ayush.gov.in/notice-board", category: "Education" },
  { source: "CCRH", url: "https://www.ccrhindia.ayush.gov.in/NewsandUpdates", category: "Research" },
  { source: "WHO", url: "https://www.who.int/initiatives/who-global-traditional-medicine-centre/", category: "International" },
];
const FALLBACK = [
  {id:"nch-current",source:"NCH",date:"2026",category:"Regulation",title:"NCH notices and regulations continue to update",summary:"NCH is publishing current notices and regulatory material covering education, professional conduct, medical research and related matters.",meaning:"Clinic and professional workflows should be checked against the current official regulatory position rather than older guidance.",action:"Open the current NCH notice before changing a compliance or professional process.",url:"https://nch.org.in/news"},
  {id:"nih-bhms",source:"NIH",date:"2026",category:"Education",title:"NIH notice board: BHMS and education updates",summary:"The National Institute of Homoeopathy publishes current notices, prospectus and education-related updates on its official notice board.",meaning:"These notices can affect admission, counselling, academic schedules and student planning.",action:"Open the official notice board and check the latest document/date before acting.",url:"https://nih.ayush.gov.in/notice-board"},
  {id:"ccrh-news",source:"CCRH",date:"2026",category:"Research",title:"CCRH research and homoeopathy updates",summary:"CCRH publishes research, studentship, publication and programme-related updates through its official channels.",meaning:"This is a useful source for following the current homoeopathy research ecosystem without treating headlines as clinical proof.",action:"Open the underlying notice or paper and review the methods and limitations before drawing conclusions.",url:"https://www.ccrhindia.ayush.gov.in/NewsandUpdates"},
  {id:"who-tm",source:"WHO",date:"2026",category:"International",title:"WHO Global Traditional Medicine Centre updates",summary:"WHO continues work on evidence, research, quality, safety and international cooperation in traditional, complementary and integrative medicine.",meaning:"International TCIM developments provide policy and evidence context but do not establish efficacy for an individual therapy.",action:"Use the update as context and review the underlying evidence before making clinical or stocking decisions.",url:"https://www.who.int/initiatives/who-global-traditional-medicine-centre/"}
];
export default async function handler(req,res){
  const live=[];
  await Promise.all(SOURCES.map(async s=>{
    try{
      const r=await fetch(s.url,{headers:{"User-Agent":"HomeoCure-Intelligence/1.0","Accept":"text/html"}});
      if(!r.ok)return;
      const html=await r.text();
      const text=html.replace(/<script[\s\S]*?<\/script>/gi," ").replace(/<style[\s\S]*?<\/style>/gi," ").replace(/<[^>]+>/g," ").replace(/&nbsp;/gi," ").replace(/&amp;/gi,"&").replace(/\s+/g," ").trim();
      const title=text.match(/(?:Notice Board|News and Updates)[\s\S]{0,450}?([A-Z][^.!?]{25,150}[.!?])/i)?.[1];
      if(title) live.push({id:`${s.source.toLowerCase()}-live`,source:s.source,date:new Date().toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"}),category:s.category,title:title.trim(),summary:"Fresh information detected from the official source page. Open the source for the complete notice or article.",meaning:"This is source-level information. The dashboard does not infer clinical efficacy from a headline.",action:"Open the original source and review the complete document before acting.",url:s.url});
    }catch{}
  }));
  const byId=new Map([...live,...FALLBACK].map(x=>[x.id,x]));
  res.setHeader("Cache-Control","s-maxage=900, stale-while-revalidate=3600");
  return res.status(200).json({updated_at:new Date().toISOString(),items:[...byId.values()].slice(0,12),sources:SOURCES,live:live.length>0});
}
