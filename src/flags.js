const FALLBACK_SHIELD = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23cbd5e1'%3E%3Cpath d='M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z'/%3E%3C/svg%3E";

const TEAM_CODES = {
  "África do Sul": "za",
  "Alemanha": "de",
  "Arábia Saudita": "sa",
  "Argentina": "ar",
  "Argélia": "dz",
  "Austrália": "au",
  "Áustria": "at",
  "Bélgica": "be",
  "Bósnia e Herzegovina": "ba",
  "Brasil": "br",
  "Cabo Verde": "cv",
  "Canadá": "ca",
  "Catar": "qa",
  "Colômbia": "co",
  "Coreia do Sul": "kr",
  "Costa do Marfim": "ci",
  "Croácia": "hr",
  "Curaçau": "cw",
  "Egito": "eg",
  "Equador": "ec",
  "Escócia": "gb-sct",
  "Espanha": "es",
  "Estados Unidos": "us",
  "França": "fr",
  "Gana": "gh",
  "Haiti": "ht",
  "Holanda": "nl",
  "Inglaterra": "gb-eng",
  "Irã": "ir",
  "Iraque": "iq",
  "Japão": "jp",
  "Jordânia": "jo",
  "Marrocos": "ma",
  "México": "mx",
  "Noruega": "no",
  "Nova Zelândia": "nz",
  "Panamá": "pa",
  "Paraguai": "py",
  "Portugal": "pt",
  "RD Congo": "cd",
  "República Tcheca": "cz",
  "Senegal": "sn",
  "Suécia": "se",
  "Suíça": "ch",
  "Tunísia": "tn",
  "Turquia": "tr",
  "Uruguai": "uy",
  "Uzbequistão": "uz"
};

export function getFlagUrl(teamName) {
  const code = TEAM_CODES[teamName];
  if (code) {
    return `https://flagcdn.com/w40/${code}.png`;
  }
  return FALLBACK_SHIELD;
}