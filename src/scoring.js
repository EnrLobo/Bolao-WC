export const DEFAULT_SCORING = {
  exact: 5,
  outcome: 2,
  miss: 0,
};

export function normalizeScore(value) {
  if (value === "" || value === null || value === undefined) {
    return null;
  }

  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
}

export function hasScore(entity) {
  return Number.isInteger(entity?.homeScore) && Number.isInteger(entity?.awayScore);
}

export function calculatePoints(match, prediction, scoring = DEFAULT_SCORING) {
  if (!match || match.status !== "finished" || !hasScore(match)) {
    return { points: 0, kind: "pending", label: "Aguardando resultado" };
  }

  if (!prediction || !hasScore(prediction)) {
    return { points: 0, kind: "empty", label: "Sem palpite" };
  }

  const exact =
    prediction.homeScore === match.homeScore && prediction.awayScore === match.awayScore;

  if (exact) {
    return { points: scoring.exact, kind: "exact", label: "Placar exato" };
  }

  const actualOutcome = resolveOutcome(match, match);
  const predictedOutcome = resolveOutcome(match, prediction);

  if (actualOutcome && predictedOutcome && actualOutcome === predictedOutcome) {
    return { points: scoring.outcome, kind: "outcome", label: "Vencedor correto" };
  }

  return { points: scoring.miss, kind: "miss", label: "Erro" };
}

export function buildRanking(members, matches, predictions, scoring = DEFAULT_SCORING) {
  const matchesById = new Map(matches.map((match) => [match.id, match]));
  const rows = new Map(
    members.map((member) => [
      member.uid,
      {
        uid: member.uid,
        name: member.name || member.email || "Participante",
        email: member.email || "",
        exact: 0,
        outcome: 0,
        miss: 0,
        pending: 0,
        empty: 0,
        total: 0,
      },
    ]),
  );

  matches.forEach((match) => {
    if (match.status !== "finished") {
      return;
    }

    members.forEach((member) => {
      const row = rows.get(member.uid);
      const prediction = predictions.find(
        (item) => item.uid === member.uid && item.matchId === match.id,
      );
      const score = calculatePoints(matchesById.get(match.id), prediction, scoring);
      row.total += score.points;
      row[score.kind] = (row[score.kind] || 0) + 1;
    });
  });

  return [...rows.values()].sort((a, b) => {
    if (b.total !== a.total) return b.total - a.total;
    if (b.exact !== a.exact) return b.exact - a.exact;
    if (b.outcome !== a.outcome) return b.outcome - a.outcome;
    return a.name.localeCompare(b.name, "pt-BR");
  });
}

function resolveOutcome(match, source) {
  if (!hasScore(source)) {
    return "";
  }

  if (match.stageType === "knockout" && source.winner) {
    return source.winner;
  }

  if (source.homeScore > source.awayScore) return "home";
  if (source.awayScore > source.homeScore) return "away";
  return "draw";
}
