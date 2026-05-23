// Dicionário interno para os dados históricos (que a API não fornece)
// Podemos preencher os outros países aos poucos depois
const HISTORICAL_DATA = {
  "Brasil": {
    teamId: 6, // ID oficial do Brasil na API-Football
    history: "A única seleção a participar de todas as edições e a maior vencedora do torneio. Conhecida pelo futebol alegre e ofensivo.",
    titles: 5,
    bestCampaign: "Campeão (1958, 1962, 1970, 1994, 2002)",
    mapUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/bc/Brazil_in_the_world_%28W3%29.svg/800px-Brazil_in_the_world_%28W3%29.svg.png"
  },
  "Argentina": {
    teamId: 26, // ID oficial da Argentina na API-Football
    history: "Atual campeã mundial, conhecida por sua paixão intensa pelo futebol e por revelar craques históricos.",
    titles: 3,
    bestCampaign: "Campeão (1978, 1986, 2022)",
    mapUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e9/Argentina_in_the_world_%28W3%29.svg/800px-Argentina_in_the_world_%28W3%29.svg.png"
  }
};

export default async function handler(req, res) {
  const { name } = req.query;

  if (!name) {
    return res.status(400).json({ error: "Nome da seleção não fornecido." });
  }

  const teamInfo = HISTORICAL_DATA[name];

  // Se a seleção ainda não estiver mapeada no nosso dicionário interno
  if (!teamInfo) {
    return res.status(200).json({
      history: "História em construção...",
      titles: 0,
      bestCampaign: "A definir",
      mapUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e4/Globe.svg/800px-Globe.svg.png",
      squad: ["Dados desta seleção estarão disponíveis em breve."]
    });
  }

  try {
    // Busca o elenco atualizado na API-Football
    const response = await fetch(`https://v3.football.api-sports.io/players/squads?team=${teamInfo.teamId}`, {
      method: "GET",
      headers: {
        "x-rapidapi-host": "v3.football.api-sports.io",
        // A chave real ficará escondida nas variáveis de ambiente da Vercel
        "x-rapidapi-key": process.env.API_FOOTBALL_KEY 
      }
    });

    if (!response.ok) {
      throw new Error("Erro de comunicação com a API de esportes.");
    }

    const data = await response.json();
    
    // Extrai apenas os nomes dos jogadores e formata a lista
    let squadList = ["Convocação não encontrada."];
    if (data.response && data.response.length > 0) {
      squadList = data.response[0].players.map(p => {
        // Traduz as posições do inglês para português
        const pos = p.position === "Goalkeeper" ? "G" :
                    p.position === "Defender" ? "D" :
                    p.position === "Midfielder" ? "M" : "A";
        return `${p.name} (${pos})`;
      });
    }

    // Devolve o "pacote completo" (História + Elenco) para o site
    return res.status(200).json({
      history: teamInfo.history,
      titles: teamInfo.titles,
      bestCampaign: teamInfo.bestCampaign,
      mapUrl: teamInfo.mapUrl,
      squad: squadList
    });

  } catch (error) {
    return res.status(500).json({ error: "Erro interno ao buscar os dados da convocação." });
  }
}