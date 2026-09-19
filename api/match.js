export const PAIR = (v, suffix = "") => {
  const h = v?.home == null ? "-" : v.home;
  const a = v?.away == null ? "-" : v.away;
  return h + suffix + " - " + a + suffix;
};
export function normalizeStats(raw) {
  const map = {};
  for (const period of raw?.statistics || []) if (period.period === "ALL")
    for (const group of period.groups || [])
      for (const item of group.statisticsItems || [])
        map[item.name] = { home: item.home, away: item.away };
  const pick = names => names.map(n => map[n]).find(Boolean);
  const num = v => { const n = Number(String(v ?? "").replace("%","").replace(",",".")); return Number.isFinite(n) ? n : null; };
  const dec = v => { const n=num(v); return n===null?null:Math.round(n*100)/100; };
  const pct = v => { const n=num(v); return n===null?null:Math.round(n*10)/10; };
  const pair = (s, fn) => ({home:s?.home==null?null:fn(s.home),away:s?.away==null?null:fn(s.away)});
  const shots=pick(["Total shots","Total Shots"]), target=pick(["Shots on target","Shots on goal","Shots On Target"]);
  const xg=pick(["Expected goals","xG"]), xgot=pick(["Expected goals on target","Expected goals on Target","xGOT"]);
  const possession=pick(["Ball possession","Possession"]), accuracy=pick(["Accurate passes percentage","Accurate passes %","Passes accuracy"]);
  const accurate=pick(["Accurate passes"]), total=pick(["Total passes"]);
  let pass=accuracy;
  if(!pass&&accurate&&total) pass={home:num(total.home)?num(accurate.home)/num(total.home)*100:null,away:num(total.away)?num(accurate.away)/num(total.away)*100:null};
  const big=pick(["Big chances","Big Chances"]);
  return {shots:pair(shots,num),onTarget:pair(target,num),xg:pair(xg,dec),xgot:pair(xgot,dec),possession:pair(possession,pct),passAccuracy:pair(pass,pct),bigChances:pair(big,num)};
}


const TEAM_ID = Number(process.env.SOFASCORE_TEAM_ID || 2702);
const API = "https://www.sofascore.com/api/v1";
async function getJSON(url){const r=await fetch(url,{headers:{"User-Agent":"ASRomaData/1.0",Accept:"application/json"}});if(!r.ok)throw new Error("SofaScore HTTP "+r.status);return r.json();}
export async function getLatestMatch(){
  let event=null;
  for(let page=0;page<3&&!event;page++){const d=await getJSON(API+"/team/"+TEAM_ID+"/events/last/"+page);event=(d.events||[]).find(e=>e.status?.type==="finished");}
  if(!event)throw new Error("Nessuna partita finita trovata.");
  const raw=await getJSON(API+"/event/"+event.id+"/statistics");
  return {id:event.id,homeTeam:event.homeTeam?.name||"Home",awayTeam:event.awayTeam?.name||"Away",homeScore:event.homeScore?.display??event.homeScore?.current??0,awayScore:event.awayScore?.display??event.awayScore?.current??0,startTimestamp:event.startTimestamp,stats:normalizeStats(raw)};
}
export default async function handler(req,res){try{res.setHeader("Cache-Control","no-store");return res.status(200).json(await getLatestMatch());}catch(e){return res.status(502).json({error:e.message||"Errore SofaScore"});}}
