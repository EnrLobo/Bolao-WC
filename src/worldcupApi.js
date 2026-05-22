export const OPENFOOTBALL_WORLD_CUP_2026_URL =
  "https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json";

const REQUEST_TIMEOUT_MS = 3500;

const KNOCKOUT_STAGE_BY_ROUND = {
  "Round of 32": { stage: "round32", stageName: "16 avos" },
  "Round of 16": { stage: "round16", stageName: "Oitavas" },
  "Quarter-final": { stage: "quarter", stageName: "Quartas" },
  "Semi-final": { stage: "semi", stageName: "Semifinais" },
  "Match for third place": { stage: "third", stageName: "3o lugar" },
  Final: { stage: "final", stageName: "Final" },
};

export async function loadOfficialWorldCupSchedule({ fetchImpl = fetch } = {}) {
  if (typeof fetchImpl !== "function") {
    throw new Error("Fetch nao esta disponivel neste ambiente.");
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetchImpl(OPENFOOTBALL_WORLD_CUP_2026_URL, {
      cache: "no-store",
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`OpenFootball respondeu com HTTP ${response.status}.`);
    }

    const payload = await response.json();
    const matches = mapOpenFootballMatches(payload.matches || []);

    if (matches.length !== 104) {
      throw new Error(`Tabela importada com ${matches.length} jogos; esperado: 104.`);
    }

    return {
      name: payload.name || "World Cup 2026",
      matches,
      source: {
        provider: "openfootball",
        label: "OpenFootball worldcup.json",
        url: OPENFOOTBALL_WORLD_CUP_2026_URL,
        importedAt: new Date().toISOString(),
      },
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

export function mapOpenFootballMatches(rawMatches) {
  const groupCounters = new Map();
  const knockoutCounters = new Map();

  return rawMatches.map((rawMatch, index) => {
    if (rawMatch.group) {
      return mapGroupMatch(rawMatch, index, groupCounters);
    }

    return mapKnockoutMatch(rawMatch, index, knockoutCounters);
  });
}

export function mergeScheduleMatches(currentMatches, importedMatches) {
  const currentById = new Map(currentMatches.map((match) => [match.id, match]));

  return importedMatches.map((importedMatch) => {
    const currentMatch = currentById.get(importedMatch.id);
    if (!currentMatch) {
      return importedMatch;
    }

    const importedFinished = importedMatch.status === "finished";

    return {
      ...currentMatch,
      ...importedMatch,
      homeScore: importedFinished ? importedMatch.homeScore : currentMatch.homeScore,
      awayScore: importedFinished ? importedMatch.awayScore : currentMatch.awayScore,
      winner: importedFinished ? importedMatch.winner : currentMatch.winner,
      status: importedFinished ? "finished" : currentMatch.status,
      updatedAt: currentMatch.updatedAt,
    };
  });
}

function mapGroupMatch(rawMatch, index, groupCounters) {
  const group = extractGroup(rawMatch.group);
  const groupIndex = groupCounters.get(group) || 0;
  const matchIndex = groupIndex + 1;
  groupCounters.set(group, matchIndex);

  return {
    ...baseMatch(rawMatch, index),
    id: `G-${group}-${matchIndex}`,
    sortOrder: index + 1,
    stage: "group",
    stageType: "group",
    stageName: `Grupo ${group}`,
    roundName: rawMatch.round || `Jogo ${index + 1}`,
    group,
  };
}

function mapKnockoutMatch(rawMatch, index, knockoutCounters) {
  const stageInfo = KNOCKOUT_STAGE_BY_ROUND[rawMatch.round] || {
    stage: "knockout",
    stageName: rawMatch.round || "Mata-mata",
  };
  const currentIndex = knockoutCounters.get(stageInfo.stage) || 0;
  const matchIndex = currentIndex + 1;
  knockoutCounters.set(stageInfo.stage, matchIndex);
  const matchNumber = rawMatch.num || index + 1;

  return {
    ...baseMatch(rawMatch, index),
    id: `${stageInfo.stage.toUpperCase()}-${String(matchIndex).padStart(2, "0")}`,
    sortOrder: matchNumber,
    stage: stageInfo.stage,
    stageType: "knockout",
    stageName: stageInfo.stageName,
    roundName: `Jogo ${matchNumber} - ${stageInfo.stageName}`,
    group: "",
    sourceMatchNumber: matchNumber,
    crossingHome: rawMatch.team1 || "",
    crossingAway: rawMatch.team2 || "",
  };
}

function baseMatch(rawMatch, index) {
  const score = readScore(rawMatch);

  return {
    id: `M-${index + 1}`,
    sortOrder: index + 1,
    stage: "",
    stageType: "",
    stageName: "",
    roundName: rawMatch.round || `Jogo ${index + 1}`,
    group: "",
    homeTeamName: rawMatch.team1 || "Mandante indefinido",
    awayTeamName: rawMatch.team2 || "Visitante indefinido",
    homeScore: score.homeScore,
    awayScore: score.awayScore,
    winner: score.winner,
    status: score.status,
    date: rawMatch.date || "",
    time: rawMatch.time || "",
    ground: rawMatch.ground || "",
    source: "openfootball",
    sourceRound: rawMatch.round || "",
    sourceMatchNumber: rawMatch.num || null,
  };
}

function readScore(rawMatch) {
  const fullTime = rawMatch.score?.ft;
  const penalties = rawMatch.score?.p;
  const hasFullTime =
    Array.isArray(fullTime) &&
    Number.isInteger(fullTime[0]) &&
    Number.isInteger(fullTime[1]);

  if (!hasFullTime) {
    return {
      homeScore: null,
      awayScore: null,
      winner: "",
      status: "scheduled",
    };
  }

  return {
    homeScore: fullTime[0],
    awayScore: fullTime[1],
    winner: winnerFromScore(fullTime, penalties),
    status: "finished",
  };
}

function winnerFromScore(fullTime, penalties) {
  if (fullTime[0] > fullTime[1]) return "home";
  if (fullTime[1] > fullTime[0]) return "away";

  if (
    Array.isArray(penalties) &&
    Number.isInteger(penalties[0]) &&
    Number.isInteger(penalties[1])
  ) {
    return penalties[0] > penalties[1] ? "home" : "away";
  }

  return "";
}

function extractGroup(groupName) {
  const match = String(groupName).match(/[A-L]$/);
  return match ? match[0] : "";
}
