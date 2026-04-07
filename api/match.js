export default async function handler(req, res) {

  const headers = {
    "User-Agent": "Mozilla/5.0",
    "Accept": "application/json",
  };

  // =========================
  // FETCH HELPER
  // =========================
  async function getJSON(url) {
    try {
      const r = await fetch(url, { headers });
      if (!r.ok) return null;
      return await r.json();
    } catch {
      return null;
    }
  }

  // =========================
  // FIND LAST ROMA MATCH (TEAM ID)
  // =========================
  async function findLastMatch() {
  const TEAM_ID = 3062;

  // endpoint molto più affidabile
  const url = `https://api.sofascore.com/api/v1/team/${TEAM_ID}/events/last/0`;

  const data = await getJSON(url);
  if (!data || !data.events) return null;

  // trova la prima partita finita
  for (const event of data.events) {
    if (event.status?.type === "finished") {
      return event;
    }
  }

  return null;
}

  // =========================
  // GET MATCH STATS
  // =========================
  async function getStats(eventId) {
    const url = `https://api.sofascore.com/api/v1/event/${eventId}/statistics`;
    const data = await getJSON(url);

    if (!data) return {};

    const all = data.statistics?.find(p => p.period === "ALL");
    const map = {};

    if (all) {
      for (const group of all.groups) {
        for (const item of group.statisticsItems) {
          map[item.name] = {
            home: item.home,
            away: item.away,
          };
        }
      }
    }

    return map;
  }

  // =========================
  // FORMAT RESPONSE
  // =========================
  function format(event, stats) {
    const home = event.homeTeam.name;
    const away = event.awayTeam.name;

    const hScore = event.homeScore?.display ?? 0;
    const aScore = event.awayScore?.display ?? 0;

    const s = (n) => stats[n] || { home: "-", away: "-" };

    return {
      match: `${home} ${hScore}-${aScore} ${away}`,
      shots: `${s("Total shots").home} - ${s("Total shots").away}`,
      onTarget: `${s("Shots on target").home} - ${s("Shots on target").away}`,
      xg: `${s("Expected goals").home} - ${s("Expected goals").away}`,
      possession: `${s("Ball possession").home} - ${s("Ball possession").away}`,
      passes: `${s("Accurate passes").home} - ${s("Accurate passes").away}`,
    };
  }

  // =========================
  // MAIN
  // =========================
  try {
    const match = await findLastMatch();

    if (!match) {
      return res.status(404).json({ error: "No match found" });
    }

    const stats = await getStats(match.id);
    const formatted = format(match, stats);

    res.status(200).json(formatted);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
