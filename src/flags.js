const FALLBACK_SHIELD = "data:image/svg+xml;charset=UTF-8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23cbd5e1'%3E%3Cpath d='M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z'/%3E%3C/svg%3E";

const TEAM_CODES = {
  // África do Sul
  "África do Sul": "za", "South Africa": "za",
  // Alemanha
  "Alemanha": "de", "Germany": "de",
  // Arábia Saudita
  "Arábia Saudita": "sa", "Saudi Arabia": "sa",
  // Argentina
  "Argentina": "ar",
  // Argélia
  "Argélia": "dz", "Algeria": "dz",
  // Austrália
  "Austrália": "au", "Australia": "au",
  // Áustria
  "Áustria": "at", "Austria": "at",
  // Bélgica
  "Bélgica": "be", "Belgium": "be",
  // Bósnia e Herzegovina
  "Bósnia e Herzegovina": "ba", "Bosnia and Herzegovina": "ba", "Bosnia": "ba",
  // Brasil
  "Brasil": "br", "Brazil": "br",
  // Cabo Verde
  "Cabo Verde": "cv", "Cape Verde": "cv",
  // Canadá
  "Canadá": "ca", "Canada": "ca",
  // Catar
  "Catar": "qa", "Qatar": "qa",
  // Colômbia
  "Colômbia": "co", "Colombia": "co",
  // Coreia do Sul
  "Coreia do Sul": "kr", "South Korea": "kr",
  // Costa do Marfim
  "Costa do Marfim": "ci", "Ivory Coast": "ci", "Côte d'Ivoire": "ci",
  // Croácia
  "Croácia": "hr", "Croatia": "hr",
  // Curaçau
  "Curaçau": "cw", "Curaçao": "cw", "Curacao": "cw",
  // Egito
  "Egito": "eg", "Egypt": "eg",
  // Equador
  "Equador": "ec", "Ecuador": "ec",
  // Escócia
  "Escócia": "gb-sct", "Scotland": "gb-sct",
  // Espanha
  "Espanha": "es", "Spain": "es",
  // Estados Unidos
  "Estados Unidos": "us", "USA": "us", "United States": "us",
  // França
  "França": "fr", "France": "fr",
  // Gana
  "Gana": "gh", "Ghana": "gh",
  // Haiti
  "Haiti": "ht",
  // Holanda
  "Holanda": "nl", "Netherlands": "nl",
  // Inglaterra
  "Inglaterra": "gb-eng", "England": "gb-eng",
  // Irã
  "Irã": "ir", "Iran": "ir",
  // Iraque
  "Iraque": "iq", "Iraq": "iq",
  // Japão
  "Japão": "jp", "Japan": "jp",
  // Jordânia
  "Jordânia": "jo", "Jordan": "jo",
  // Marrocos
  "Marrocos": "ma", "Morocco": "ma",
  // México
  "México": "mx", "Mexico": "mx",
  // Noruega
  "Noruega": "no", "Norway": "no",
  // Nova Zelândia
  "Nova Zelândia": "nz", "New Zealand": "nz",
  // Panamá
  "Panamá": "pa", "Panama": "pa",
  // Paraguai
  "Paraguai": "py", "Paraguay": "py",
  // Portugal
  "Portugal": "pt",
  // RD Congo
  "RD Congo": "cd", "DR Congo": "cd", "Congo DR": "cd",
  // República Tcheca
  "República Tcheca": "cz", "Czech Republic": "cz", "Czechia": "cz",
  // Senegal
  "Senegal": "sn",
  // Suécia
  "Suécia": "se", "Sweden": "se",
  // Suíça
  "Suíça": "ch", "Switzerland": "ch",
  // Tunísia
  "Tunísia": "tn", "Tunisia": "tn",
  // Turquia
  "Turquia": "tr", "Turkey": "tr",
  // Uruguai
  "Uruguai": "uy", "Uruguay": "uy",
  // Uzbequistão
  "Uzbequistão": "uz", "Uzbekistan": "uz"
};

export function getFlagUrl(teamName) {
  const cleanName = (teamName || "").trim();
  const code = TEAM_CODES[cleanName];
  if (code) {
    return `https://flagcdn.com/w40/${code}.png`;
  }
  return FALLBACK_SHIELD;
}