const FALLBACK_SHIELD = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23cbd5e1'%3E%3Cpath d='M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z'/%3E%3C/svg%3E";

const TEAM_CODES = {
  "Brazil": "br", "Brasil": "br",
  "Argentina": "ar",
  "France": "fr", "França": "fr",
  "Germany": "de", "Alemanha": "de",
  "Spain": "es", "Espanha": "es",
  "England": "gb-eng", "Inglaterra": "gb-eng",
  "Portugal": "pt",
  "Italy": "it", "Itália": "it",
  "USA": "us", "Estados Unidos": "us",
  "Mexico": "mx", "México": "mx",
  "Canada": "ca", "Canadá": "ca",
  "Uruguay": "uy", "Uruguai": "uy",
  "Colombia": "co", "Colômbia": "co",
  "Ecuador": "ec", "Equador": "ec",
  "Netherlands": "nl", "Holanda": "nl",
  "Belgium": "be", "Bélgica": "be",
  "Japan": "jp", "Japão": "jp",
  "Morocco": "ma", "Marrocos": "ma"
  // Você pode adicionar mais países depois que as eliminatórias acabarem!
};

export function getFlagUrl(teamName) {
  const code = TEAM_CODES[teamName];
  if (code) {
    return `https://flagcdn.com/w40/${code}.png`;
  }
  return FALLBACK_SHIELD;
}