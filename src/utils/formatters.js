export function formatInput(value) {
  return Number.isInteger(value) ? String(value) : "";
}

export function formatScore(match) {
  if (!Number.isInteger(match.homeScore) || !Number.isInteger(match.awayScore)) {
    return "- x -";
  }
  return `${match.homeScore} x ${match.awayScore}`;
}

export function formatDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(date);
}

export function selected(current, expected) {
  return current === expected ? "selected" : "";
}

export function requiredText(value, message) {
  const text = String(value || "").trim();
  if (!text) throw new Error(message);
  return text;
}