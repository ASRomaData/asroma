export default async function handler(req, res) {
  const TEAM_NAME = "roma";

  const headers = {
    "User-Agent": "Mozilla/5.0",
    "Accept": "application/json",
  };

  async function findLastMatch() {
    const TEAM_ID = 3062;
    const today = new Date();
  
    for (let i = 0; i < 30; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
  
      const dateStr = d.toISOString().split("T")[0];
      const url = `https://api.sofascore.com/api/v1/sport/football/scheduled-events/${dateStr}`;
  
      const data = await getJSON(url);
      if (!data) continue;
  
      for (const event of data.events || []) {
        const homeId = event.homeTeam?.id;
        const awayId = event.awayTeam?.id;
  
        if (homeId === TEAM_ID || awayId === TEAM_ID) {
          if (event.status?.type === "finished") {
            return event;
          }
        }
      }
    }
  
    return null;
  }

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
