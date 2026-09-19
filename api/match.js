const TEAM_ID = Number(process.env.SOFASCORE_TEAM_ID || 2702);
const API = "https://www.sofascore.com/api/v1";

async function getJSON(url) {
  const r = await fetch(url, { headers: { "User-Agent": "ASRomaData/1.0", Accept: "application/json" } });
  if (!r.ok) throw new Error("SofaScore HTTP " + r.status);
  return r.json();
}

function firstStat(stats, names) {
  for (const name of names) if (stats[name]) return stats[name];
  return null;
}
function num(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(String(v).replace("%", "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}
function pct(v) { const n = num(v); return n === null ? null : Math.round(n * 10) / 10; }
function dec(v) { const n = num(v); return n === null ? null : Math.round(n * 100) / 100; }
function pair(stat, fn) {
  fn = fn || (v => v);
  return { home: stat?.home == null ? null : fn(stat.home), away: stat?.away == null ? null : fn(stat.away) };
}

export function normalizeStats(raw) {
  const map = {};
  for (const period of raw?.statistics || []) {
    if (period.period !== "ALL") continue;
    for (const group of period.groups || []) {
      for (const item of group.statisticsItems || []) map[item.name] = { home: item.home, away: item.away };
    }
  }
  const shots = firstStat(map, ["Total shots", "Total Shots"]);
  const onTarget = firstStat(map, ["Shots on target", "Shots on goal", "Shots On Target"]);
  const xg = firstStat(map, ["Expected goals", "xG"]);
  const xgot = firstStat(map, ["Expected goals on target", "Expected goals on Target", "xGOT"]);
  const possession = firstStat(map, ["Ball possession", "Possession"]);
  let accuracy = firstStat(map, ["Accurate passes percentage", "Accurate passes %", "Passes accuracy"]);
  const accurate = firstStat(map, ["Accurate passes"]);
  const total = firstStat(map, ["Total passes"]);
  if (!accuracy && accurate && total) {
    accuracy = {
      home: num(total.home) ? num(accurate.home) / num(total.home) * 100 : null,
      away: num(total.away) ? num(accurate.away) / num(total.away) * 100 : null
    };
  }
  const big = firstStat(map, ["Big chances", "Big Chances"]);
  return {
    shots: pair(shots, num),
    onTarget: pair(onTarget, num),
    xg: pair(xg, dec),
    xgot: pair(xgot, dec),
    possession: pair(possession, pct),
    passAccuracy: pair(accuracy, pct),
    bigChances: pair(big, num)
  };
}

async function findLastFinishedMatch() {
  for (let page = 0; page < 3; page++) {
    const data = await getJSON(API + "/team/" + TEAM_ID + "/events/last/" + page);
    for (const event of data.events || []) if (event.status?.type === "finished") return event;
  }
  return null;
}

export async function getLatestMatch() {
  const event = await findLastFinishedMatch();
  if (!event) throw new Error("Nessuna partita finita trovata.");
  const raw = await getJSON(API + "/event/" + event.id + "/statistics");
  return {
    id: event.id,
    homeTeam: event.homeTeam?.name || "Home",
    awayTeam: event.awayTeam?.name || "Away",
    homeScore: event.homeScore?.display ?? event.homeScore?.current ?? 0,
    awayScore: event.awayScore?.display ?? event.awayScore?.current ?? 0,
    startTimestamp: event.startTimestamp,
    stats: normalizeStats(raw)
  };
}

export default async function handler(req, res) {
  try {
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json(await getLatestMatch());
  } catch (err) {
    return res.status(502).json({ error: err.message || "Errore SofaScore" });
  }
}
