import { html } from "../utils/template.js";
import { getFlagUrl } from "../flags.js";
import { buildRanking, calculatePoints, DEFAULT_SCORING } from "../scoring.js";
import { calculateStandings } from "../utils/standings.js";
import { formatDateTime, formatScore, formatInput, selected } from "../utils/formatters.js";

export function renderEmptyParty() {
  return html`
    <section class="empty-state">
      <div class="pitch-visual" aria-hidden="true"><span></span><span></span><span></span></div>
      <h2>Crie ou entre em uma party</h2>
      <p>Depois disso, você registra palpites, fecha resultados e acompanha o ranking.</p>
    </section>
  `;
}

export function renderParty(state) {
  const { party, members } = state.partyState;
  const owner = party.ownerUid === state.user.uid;
  
  const tabs = [
    ["groups-stage", "Fase de Grupos"],
    ["knockout-stage", "Mata-mata"],
    ["tables", "Tabelas"],
    ["ranking", "Ranking"]
  ];
  if (owner) tabs.push(["admin", "Painel Admin"]);

  if (!tabs.find(t => t[0] === state.activeTab)) state.activeTab = "groups-stage";

  return html`
    <section class="party-header">
      <div>
        <p class="eyebrow">${owner ? "Você é dono" : "Participante"}</p>
        <h2>${party.name}</h2>
        <div class="meta-row">
          <span>Código ${party.code}</span>
          <span>${members.length} participante(s)</span>
          <button class="link-button" data-action="copy-code" data-code="${party.code}" type="button">Copiar código</button>
          ${owner 
            ? html`<button class="link-button" data-action="sync-schedule" type="button">Sincronizar tabela</button>
                   <button class="link-button text-danger" data-action="delete-party" type="button">Excluir Party</button>` 
            : html`<button class="link-button text-danger" data-action="leave-party" type="button">Sair da Party</button>`}
        </div>
        ${renderScheduleSource(party.scheduleSource)}
      </div>
      <div class="score-summary">
        ${renderMyScore(state)}
      </div>
    </section>

    <nav class="tabs" aria-label="Areas da party">
      ${tabs.map(([id, label]) => html`
        <button class="${state.activeTab === id ? "is-active" : ""}" data-action="tab" data-tab="${id}" type="button">${label}</button>
      `)}
    </nav>

    <section class="tab-panel">
      ${renderActiveTab(state)}
    </section>
  `;
}

function renderScheduleSource(source) {
  if (!source?.label) return "";
  return html`<p class="schedule-source">Fonte: ${source.label}${source.importedAt ? ` - ${formatDateTime(source.importedAt)}` : ""}</p>`;
}

function renderMyScore(state) {
  const { party, members, matches, predictions } = state.partyState;
  const scoring = party.scoring || DEFAULT_SCORING;
  const ranking = buildRanking(members, matches, predictions, scoring);
  const me = ranking.find((row) => row.uid === state.user.uid);
  return html`<span>${me?.total || 0}</span><small>pontos</small>`;
}

function renderActiveTab(state) {
  if (state.activeTab === "groups-stage") return renderGroupStage(state);
  if (state.activeTab === "knockout-stage") return renderKnockoutStage(state);
  if (state.activeTab === "tables") return renderGroupTables(state);
  if (state.activeTab === "ranking") return renderRanking(state);
  if (state.activeTab === "admin") return renderAdminPanel(state);
  return renderGroupStage(state);
}

function renderProgress(state, stageType) {
  const matches = state.partyState.matches.filter(m => m.stageType === stageType);
  if (matches.length === 0) return "";
  
  const total = matches.length;
  const predicted = state.partyState.predictions.filter(p => p.uid === state.user.uid && matches.some(m => m.id === p.matchId) && Number.isInteger(p.homeScore)).length;
  const pct = total === 0 ? 0 : Math.round((predicted / total) * 100);
  
  return html`
    <div class="progress-container">
      <div class="progress-header">
        <span>Palpites Preenchidos</span>
        <strong>${predicted} de ${total} jogos (${pct}%)</strong>
      </div>
      <div class="progress-track">
        <div class="progress-bar" style="width: ${pct}%"></div>
      </div>
    </div>
  `;
}

function renderGroupStage(state) {
  const currentGroup = state.filters.group === "all" ? "A" : state.filters.group;
  const groupsList = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"];
  const matches = state.partyState.matches.filter(m => m.stageType === "group" && m.group === currentGroup);

  return html`
    ${renderProgress(state, "group")}
    <div class="pill-nav">
      ${groupsList.map(g => html`<button class="pill ${currentGroup === g ? 'is-active' : ''}" data-action="filter-group" data-group="${g}" type="button">Grupo ${g}</button>`)}
    </div>
    <div class="match-list">
      ${matches.length === 0 ? html`<p class="muted">Nenhum jogo encontrado.</p>` : matches.map(m => renderPredictionMatch(m, state))}
    </div>
  `;
}

function renderKnockoutStage(state) {
  const currentStage = state.filters.stage === "group" || state.filters.stage === "all" ? "round32" : state.filters.stage;
  const stages = [
    { id: "round32", label: "16 Avos" }, { id: "round16", label: "Oitavas" },
    { id: "quarter", label: "Quartas" }, { id: "semi", label: "Semifinal" },
    { id: "third", label: "3º Lugar" }, { id: "final", label: "Final" }
  ];
  const matches = state.partyState.matches.filter(m => m.stageType === "knockout" && m.stage === currentStage);

  return html`
    ${renderProgress(state, "knockout")}
    <div class="pill-nav">
      ${stages.map(s => html`<button class="pill ${currentStage === s.id ? 'is-active' : ''}" data-action="filter-stage" data-stage="${s.id}" type="button">${s.label}</button>`)}
    </div>
    <div class="match-list">
      ${matches.length === 0 ? html`<p class="muted">Nenhum jogo configurado ainda.</p>` : matches.map(m => renderPredictionMatch(m, state))}
    </div>
  `;
}

function renderGroupTables(state) {
  const standings = calculateStandings(state.partyState.matches);
  return html`
    <div class="section-heading">
      <div><h3>Classificação dos Grupos</h3><p class="muted">Atualizada em tempo real com base nos resultados oficiais.</p></div>
    </div>
    <div class="groups-grid">
      ${Object.entries(standings).map(([groupLetter, teams]) => {
        if (teams.length === 0) return "";
        return html`
          <div class="group-card">
            <h4>Grupo ${groupLetter}</h4>
            <div class="table-wrap">
              <table class="group-table">
                <thead><tr><th>Seleção</th><th title="Pontos">P</th><th title="Jogos">J</th><th title="Vitórias">V</th><th title="Empates">E</th><th title="Derrotas">D</th><th title="Saldo">SG</th></tr></thead>
                <tbody>
                  ${teams.map(team => html`
                    <tr>
                      <td><div style="display: flex; align-items: center; gap: 8px;"><img src="${getFlagUrl(team.name)}" class="team-flag" style="width: 16px; height: 16px;" alt="" /><strong>${team.name}</strong></div></td>
                      <td><strong>${team.pts}</strong></td><td>${team.pld}</td><td>${team.w}</td><td>${team.d}</td><td>${team.l}</td><td>${team.gd}</td>
                    </tr>
                  `)}
                </tbody>
              </table>
            </div>
          </div>
        `;
      })}
    </div>
  `;
}

function renderRanking(state) {
  const { party, members, matches, predictions } = state.partyState;
  const scoring = party.scoring || DEFAULT_SCORING;
  const ranking = buildRanking(members, matches, predictions, scoring);
  
  return html`
    <div class="table-wrap">
      <table>
        <thead><tr><th>Posição</th><th>Participante</th><th>Total</th><th>Exatos</th><th>Vencedor</th><th>Erros</th></tr></thead>
        <tbody>
          ${ranking.map((row) => html`
            <tr class="${row.uid === state.user.uid ? "is-me" : ""}">
              <td>
                <div class="rank-pos">
                  <strong>${row.position}º</strong>
                  ${row.trend > 0 ? html`<span class="trend up">▲ ${row.trend}</span>` : ""}
                  ${row.trend < 0 ? html`<span class="trend down">▼ ${Math.abs(row.trend)}</span>` : ""}
                  ${row.trend === 0 ? html`<span class="trend neutral">-</span>` : ""}
                </div>
              </td>
              <td><strong>${row.name}</strong><small>${row.email}</small></td>
              <td><strong>${row.total}</strong></td><td>${row.exact}</td><td>${row.outcome}</td><td>${row.miss}</td>
            </tr>
          `)}
        </tbody>
      </table>
    </div>
  `;
}

function renderAdminPanel(state) {
  const scoring = state.partyState.party.scoring || DEFAULT_SCORING;
  
  // CORREÇÃO: Nova lógica de organização avançada para o Admin
  const isGroupView = state.filters.stage === "group" || state.filters.stage === "all";
  
  let filteredMatches = [];
  let subMenuHtml = "";

  if (isGroupView) {
    const currentGroup = state.filters.group === "all" ? "A" : state.filters.group;
    filteredMatches = state.partyState.matches.filter(m => m.stageType === "group" && m.group === currentGroup);
    
    const groupsList = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"];
    subMenuHtml = html`
      <div class="pill-nav" style="margin-top: 12px; border-top: 1px solid var(--line); padding-top: 12px;">
        ${groupsList.map(g => html`
          <button class="pill ${currentGroup === g ? 'is-active' : ''}" data-action="filter-group" data-group="${g}" type="button">Grupo ${g}</button>
        `)}
      </div>
    `;
  } else {
    const currentKnockoutStage = state.filters.stage === "knockout" ? "round32" : state.filters.stage;
    filteredMatches = state.partyState.matches.filter(m => m.stageType === "knockout" && m.stage === currentKnockoutStage);
    
    const stages = [
      { id: "round32", label: "16 Avos" }, { id: "round16", label: "Oitavas" },
      { id: "quarter", label: "Quartas" }, { id: "semi", label: "Semifinal" },
      { id: "third", label: "3º Lugar" }, { id: "final", label: "Final" }
    ];
    subMenuHtml = html`
      <div class="pill-nav" style="margin-top: 12px; border-top: 1px solid var(--line); padding-top: 12px;">
        ${stages.map(s => html`
          <button class="pill ${currentKnockoutStage === s.id ? 'is-active' : ''}" data-action="filter-stage" data-stage="${s.id}" type="button">${s.label}</button>
        `)}
      </div>
    `;
  }

  return html`
    <div class="rules-grid" style="margin-bottom: 32px;">
      <section class="panel no-margin">
        <h3>Pontuação do Bolão</h3>
        <form class="form-grid scoring-form" data-action="save-scoring">
          <label>Placar exato <input name="exact" type="number" min="0" value="${scoring.exact}" /></label>
          <label>Vencedor correto <input name="outcome" type="number" min="0" value="${scoring.outcome}" /></label>
          <label>Erro <input name="miss" type="number" min="0" value="${scoring.miss}" /></label>
          <button class="button button-primary" type="submit">Salvar regras</button>
        </form>
      </section>
    </div>
    <div class="section-divider"></div>
    <div class="section-heading">
      <div><h3>Lançamento de Resultados Oficiais</h3><p class="muted">Estes resultados definem os pontos e atualizam todos os participantes em tempo real.</p></div>
    </div>
    <div class="pill-nav">
      <button class="pill ${isGroupView ? 'is-active' : ''}" data-action="filter-stage" data-stage="group" type="button">Fase de Grupos</button>
      <button class="pill ${!isGroupView ? 'is-active' : ''}" data-action="filter-stage" data-stage="knockout" type="button">Mata-mata</button>
    </div>
    
    ${subMenuHtml}

    <div class="match-list" style="margin-top: 20px;">
      ${filteredMatches.length === 0 
        ? html`<p class="muted">Nenhum jogo configurado nesta seleção.</p>` 
        : filteredMatches.map(m => renderResultEditor(m))}
    </div>
  `;
}

function renderPredictionMatch(match, state) {
  const prediction = state.partyState.predictions.find(p => p.matchId === match.id && p.uid === state.user.uid);
  const score = calculatePoints(match, prediction, state.partyState.party.scoring || DEFAULT_SCORING);
  const closed = match.status === "finished";

  return html`
    <form class="match-row compact-row" data-action="save-prediction">
      <input type="hidden" name="matchId" value="${match.id}" />
      <div class="match-info">
        <strong>${match.roundName}</strong><small>${renderMatchMeta(match, closed)}</small>
      </div>
      <div class="prediction-grid">
        <button class="link-button team-name team-clickable" data-action="view-team" data-team="${match.homeTeamName}" type="button">
          <img src="${getFlagUrl(match.homeTeamName)}" class="team-flag" alt="" />${match.homeTeamName}
        </button>
        <input name="homeScore" type="number" min="0" inputmode="numeric" value="${formatInput(prediction?.homeScore)}" ${closed ? "disabled" : ""} />
        <span class="versus">x</span>
        <input name="awayScore" type="number" min="0" inputmode="numeric" value="${formatInput(prediction?.awayScore)}" ${closed ? "disabled" : ""} />
        <button class="link-button team-name team-clickable align-right" data-action="view-team" data-team="${match.awayTeamName}" type="button">
          ${match.awayTeamName}<img src="${getFlagUrl(match.awayTeamName)}" class="team-flag" alt="" />
        </button>
      </div>
      ${renderWinnerSelect(match, prediction?.winner, closed)}
      <div class="row-actions">
        <span class="points-pill ${score.kind}">${score.points} pts</span>
        <button class="button button-primary" type="submit" ${closed ? "disabled" : ""}>Salvar</button>
      </div>
    </form>
  `;
}

function renderResultEditor(match) {
  return html`
    <form class="match-row editor-row compact-row" data-action="save-match">
      <input type="hidden" name="matchId" value="${match.id}" />
      <div class="match-info"><strong>${match.roundName}</strong><small>${match.id}</small></div>
      <div class="editor-grid">
        <label>Mandante <input name="homeTeamName" value="${match.homeTeamName}" required /></label>
        <label>Placar <input name="homeScore" type="number" min="0" value="${formatInput(match.homeScore)}" /></label>
        <label>Visitante <input name="awayTeamName" value="${match.awayTeamName}" required /></label>
        <label>Placar <input name="awayScore" type="number" min="0" value="${formatInput(match.awayScore)}" /></label>
        <label>Status
          <select name="status">
            <option value="scheduled" ${selected(match.status, "scheduled")}>Aberto</option>
            <option value="finished" ${selected(match.status, "finished")}>Fechado</option>
          </select>
        </label>
      </div>
      ${renderWinnerSelect(match, match.winner, false)}
      <div class="row-actions">
        <span class="points-pill ${match.status === "finished" ? "exact" : "pending"}">${match.status === "finished" ? "Fechado" : "Aguardando"}</span>
        <button class="button button-primary" type="submit">Salvar</button>
      </div>
    </form>
  `;
}

function renderWinnerSelect(match, currentValue = "", disabledSelect = false) {
  if (match.stageType !== "knockout") return "";
  return html`
    <label class="winner-select">
      Classificado
      <select name="winner" ${disabledSelect ? "disabled" : ""}>
        <option value="" ${selected(currentValue, "")}>Pelo placar</option>
        <option value="home" ${selected(currentValue, "home")}>${match.homeTeamName}</option>
        <option value="away" ${selected(currentValue, "away")}>${match.awayTeamName}</option>
      </select>
    </label>
  `;
}

function renderMatchMeta(match, closed) {
  const parts = [];
  if (closed) parts.push(`Resultado Oficial: ${formatScore(match)}`);
  if (match.date) parts.push(match.time ? `${match.date} ${match.time}` : match.date);
  if (match.ground) parts.push(match.ground);
  if (match.stageType === "knockout" && match.crossingHome && match.crossingAway) parts.push(`${match.crossingHome} x ${match.crossingAway}`);
  return parts.join(" - ");
}