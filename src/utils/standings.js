export function calculateStandings(matches) {
  const groups = {};
  "ABCDEFGHIJKL".split("").forEach(g => { groups[g] = {}; });

  matches.forEach(m => {
    if (m.stageType !== "group") return;
    const g = m.group;
    if (!g || !groups[g]) return;

    if (!groups[g][m.homeTeamName]) groups[g][m.homeTeamName] = { name: m.homeTeamName, pts: 0, pld: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, gd: 0 };
    if (!groups[g][m.awayTeamName]) groups[g][m.awayTeamName] = { name: m.awayTeamName, pts: 0, pld: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, gd: 0 };

    if (m.status === "finished" && Number.isInteger(m.homeScore) && Number.isInteger(m.awayScore)) {
      const home = groups[g][m.homeTeamName];
      const away = groups[g][m.awayTeamName];
      home.pld++; away.pld++;
      home.gf += m.homeScore; home.ga += m.awayScore; home.gd = home.gf - home.ga;
      away.gf += m.awayScore; away.ga += m.homeScore; away.gd = away.gf - away.ga;
      if (m.homeScore > m.awayScore) { home.w++; home.pts += 3; away.l++; }
      else if (m.homeScore < m.awayScore) { away.w++; away.pts += 3; home.l++; }
      else { home.d++; away.d++; home.pts += 1; away.pts += 1; }
    }
  });

  const sortedGroups = {};
  for (const [g, teamsMap] of Object.entries(groups)) {
    sortedGroups[g] = Object.values(teamsMap).sort((a, b) => {
      if (b.pts !== a.pts) return b.pts - a.pts;
      if (b.gd !== a.gd) return b.gd - a.gd;
      if (b.gf !== a.gf) return b.gf - a.gf;
      return a.name.localeCompare(b.name, "pt-BR");
    });
  }
  return sortedGroups;
}