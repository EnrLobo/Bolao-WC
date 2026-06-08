import { html } from "../utils/template.js";
import { getFlagUrl } from "../flags.js";
import { TEAMS_INFO } from "../data/teams.js";

export function openTeamModal(teamName, matches) {
  // 1. Encontra todos os jogos dessa seleção na tabela atual
  const teamMatches = matches.filter(m => m.homeTeamName === teamName || m.awayTeamName === teamName);
  
  // 2. Busca as curiosidades no nosso arquivo local
  const info = TEAMS_INFO[teamName] || {
    confederation: "Aguardando definição",
    titles: 0,
    curiosity: "Informações detalhadas sobre esta seleção serão adicionadas em breve.",
    roster: []
  };

  // 3. Cria a estrutura do Modal no HTML
  const modal = document.createElement("div");
  modal.className = "modal-overlay";
  modal.id = "team-modal";

  modal.innerHTML = html`
    <div class="modal-content">
      <button class="modal-close" data-action="close-modal">&times;</button>
      
      <div style="display: flex; align-items: center; gap: 14px; margin-bottom: 24px;">
        <img src="${getFlagUrl(teamName)}" style="width: 56px; height: 56px; border-radius: 50%; border: 2px solid var(--line); object-fit: cover;" />
        <h2 style="margin: 0; font-size: 1.8rem;">${teamName}</h2>
      </div>

      <dl class="definition-list" style="margin-bottom: 24px;">
        <div><dt>Confederação</dt><dd>${info.confederation}</dd></div>
        <div><dt>Títulos Mundiais</dt><dd>${info.titles}</dd></div>
        <div><dt>Curiosidade</dt><dd>${info.curiosity}</dd></div>
      </dl>

      <h3 style="margin-bottom: 8px;">Agenda de Jogos</h3>
      <ul style="padding-left: 20px; color: var(--muted); margin-bottom: 24px;">
        ${teamMatches.map(m => html`
          <li style="margin-bottom: 6px;">
            <strong>${m.homeTeamName} x ${m.awayTeamName}</strong> <br/>
            <small>${m.stageName} - ${m.roundName}</small>
          </li>
        `)}
        ${teamMatches.length === 0 ? html`<li>Nenhum jogo encontrado na tabela.</li>` : ""}
      </ul>

      ${info.roster.length > 0 ? html`
        <h3 style="margin-bottom: 8px;">Principais Jogadores</h3>
        <p style="color: var(--muted); line-height: 1.5; margin-bottom: 24px;">
          ${info.roster.join(", ")}.
        </p>
      ` : ""}

      <h3 style="margin-bottom: 8px;">Localização</h3>
      <div class="map-container">
        <iframe
          width="100%" height="100%" frameborder="0"
          src="https://maps.google.com/maps?q=${teamName}&t=&z=4&ie=UTF8&iwloc=&output=embed" 
          allowfullscreen>
        </iframe>
      </div>
    </div>
  `.toString(); // Convertendo a SafeString de volta para texto para o innerHTML

  document.body.appendChild(modal);

  // 4. Lógica para fechar o modal
  modal.addEventListener("click", (e) => {
    if (e.target === modal || e.target.closest('[data-action="close-modal"]')) {
      modal.remove();
    }
  });
}