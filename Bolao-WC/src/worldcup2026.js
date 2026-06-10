const GROUPS = "ABCDEFGHIJKL".split("");
const GROUP_PAIRINGS = [
  [1, 2],
  [3, 4],
  [1, 3],
  [4, 2],
  [4, 1],
  [2, 3],
];

const KNOCKOUT_ROUNDS = [
  { stage: "round32", stageName: "16 avos", count: 16 },
  { stage: "round16", stageName: "Oitavas", count: 8 },
  { stage: "quarter", stageName: "Quartas", count: 4 },
  { stage: "semi", stageName: "Semifinais", count: 2 },
  { stage: "third", stageName: "3o lugar", count: 1 },
  { stage: "final", stageName: "Final", count: 1 },
];

export const STAGE_FILTERS = [
  { value: "all", label: "Todos" },
  { value: "group", label: "Grupos" },
  { value: "knockout", label: "Mata-mata" },
];

export const GROUP_FILTERS = [
  { value: "all", label: "Todos" },
  ...GROUPS.map((group) => ({ value: group, label: `Grupo ${group}` })),
];

export function createInitialMatches() {
  return [...createGroupMatches(), ...createKnockoutMatches()];
}

function createGroupMatches() {
  const matches = [];

  GROUPS.forEach((group, groupIndex) => {
    GROUP_PAIRINGS.forEach(([homeSeed, awaySeed], matchIndex) => {
      matches.push({
        id: `G-${group}-${matchIndex + 1}`,
        sortOrder: groupIndex * GROUP_PAIRINGS.length + matchIndex + 1,
        stage: "group",
        stageType: "group",
        stageName: `Grupo ${group}`,
        roundName: `Rodada ${Math.floor(matchIndex / 2) + 1}`,
        group,
        homeTeamName: teamSeed(group, homeSeed),
        awayTeamName: teamSeed(group, awaySeed),
        homeScore: null,
        awayScore: null,
        winner: "",
        status: "scheduled",
      });
    });
  });

  return matches;
}

function createKnockoutMatches() {
  let sortOrder = 1000;
  const matches = [];

  KNOCKOUT_ROUNDS.forEach((round) => {
    for (let index = 1; index <= round.count; index += 1) {
      matches.push({
        id: `${round.stage.toUpperCase()}-${String(index).padStart(2, "0")}`,
        sortOrder,
        stage: round.stage,
        stageType: "knockout",
        stageName: round.stageName,
        roundName: `${round.stageName} ${index}`,
        group: "",
        homeTeamName: `${round.stageName} ${index} - Mandante`,
        awayTeamName: `${round.stageName} ${index} - Visitante`,
        homeScore: null,
        awayScore: null,
        winner: "",
        status: "scheduled",
      });
      sortOrder += 1;
    }
  });

  return matches;
}

function teamSeed(group, seed) {
  return `Grupo ${group} - Selecao ${seed}`;
}
