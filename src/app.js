import { getFlagUrl } from "./flags.js";
import { buildRanking, calculatePoints, DEFAULT_SCORING, normalizeScore } from "./scoring.js";
import { createStore } from "./store.js";
import { GROUP_FILTERS, STAGE_FILTERS } from "./worldcup2026.js";

const selectedPartyKey = "bolao-copa-2026:selected-party";
const app = document.querySelector("#app");

const state = {
  store: null,
  user: null,
  parties: [],
  partyState: null,
  currentPartyId: localStorage.getItem(selectedPartyKey),
  activeTab: "predictions",
  filters: {
    stage: "all",
    group: "all",
  },
  notice: null,
  busy: false,
};

init();

async function init() {
  bindEvents();
  state.store = await createStore();
  state.store.onAuthChanged(async (user) => {
    state.user = user;
    state.partyState = null;

    if (user) {
      await refreshParties();
    }

    render();
  });
}

function bindEvents() {
  app.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.target;
    const action = form.dataset.action;

    if (!action) {
      return;
    }

    await runAction(action, form, event.submitter);
  });

  app.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-action]");
    if (!button || button.tagName === "FORM") {
      return;
    }

    const action = button.dataset.action;
    if (!action || button.type === "submit") {
      return;
    }

    await runAction(action, button);
  });
}

async function runAction(action, source, submitter) {
  try {
    state.busy = true;
    render();

    if (action === "auth") {
      await handleAuth(source, submitter);
    }

    if (action === "sign-out") {
      await state.store.signOut();
      state.currentPartyId = null;
      state.parties = [];
      state.partyState = null;
      localStorage.removeItem(selectedPartyKey);
    }

    if (action === "create-party") {
      const data = formData(source);
      const name = requiredText(data.get("name"), "Informe o nome da party.");
      state.currentPartyId = await state.store.createParty({ name });
      localStorage.setItem(selectedPartyKey, state.currentPartyId);
      await refreshParties();
      setNotice("Party criada.");
    }

    if (action === "join-party") {
      const data = formData(source);
      const code = requiredText(data.get("code"), "Informe o codigo da party.");
      state.currentPartyId = await state.store.joinParty({ code });
      localStorage.setItem(selectedPartyKey, state.currentPartyId);
      await refreshParties();
      setNotice("Voce entrou na party.");
    }

    if (action === "select-party") {
      state.currentPartyId = source.dataset.partyId;
      localStorage.setItem(selectedPartyKey, state.currentPartyId);
      await loadCurrentParty();
    }

    if (action === "tab") {
      state.activeTab = source.dataset.tab;
    }

    if (action === "apply-filters") {
      const data = formData(source);
      state.filters.stage = data.get("stage") || "all";
      state.filters.group = data.get("group") || "all";
    }

    if (action === "save-prediction") {
      await handleSavePrediction(source);
      await loadCurrentParty();
      setNotice("Palpite salvo.");
    }

    if (action === "save-match") {
      await handleSaveMatch(source);
      await loadCurrentParty();
      setNotice("Resultado salvo.");
    }

    if (action === "save-scoring") {
      await handleSaveScoring(source);
      await loadCurrentParty();
      setNotice("Pontuacao atualizada.");
    }

    if (action === "sync-schedule") {
      const sourceInfo = await state.store.syncSchedule(state.currentPartyId);
      await loadCurrentParty();
      setNotice(`Tabela sincronizada via ${sourceInfo.label}.`);
    }

    if (action === "refresh") {
      await refreshParties();
      setNotice("Dados atualizados.");
    }

    if (action === "copy-code") {
      await navigator.clipboard.writeText(source.dataset.code);
      setNotice("Codigo copiado.");
    }
  } catch (error) {
    setNotice(error.message || "Algo deu errado.", "error");
  } finally {
    state.busy = false;
    render();
  }
}

async function handleAuth(form, submitter) {
  const data = formData(form);
  const name = String(data.get("name") || "").trim();
  const email = requiredText(data.get("email"), "Informe o e-mail.").toLowerCase();

  if (state.store.mode === "local") {
    await state.store.signInLocal({ name, email });
    setNotice("Acesso local ativo.");
    return;
  }

  const password = requiredText(data.get("password"), "Informe a senha.");
  const intent = submitter?.dataset.intent || "signin";

  if (intent === "signup") {
    await state.store.signUp({ name, email, password });
    setNotice("Conta criada.");
    return;
  }

  await state.store.signIn({ email, password });
  setNotice("Login realizado.");
}

async function handleSavePrediction(form) {
  const data = formData(form);
  const matchId = data.get("matchId");
  const homeScore = normalizeScore(data.get("homeScore"));
  const awayScore = normalizeScore(data.get("awayScore"));
  const match = state.partyState.matches.find((item) => item.id === matchId);

  if (homeScore === null || awayScore === null) {
    throw new Error("Informe os dois placares do palpite.");
  }

  if (match.stageType === "knockout" && homeScore === awayScore && !data.get("winner")) {
    throw new Error("Em empate no mata-mata, escolha quem passa.");
  }

  await state.store.savePrediction(state.currentPartyId, {
    matchId,
    homeScore,
    awayScore,
    winner: data.get("winner") || "",
  });
}

async function handleSaveMatch(form) {
  const data = formData(form);
  const matchId = data.get("matchId");
  const homeScore = normalizeScore(data.get("homeScore"));
  const awayScore = normalizeScore(data.get("awayScore"));
  const status = data.get("status");
  const match = state.partyState.matches.find((item) => item.id === matchId);

  if (status === "finished" && (homeScore === null || awayScore === null)) {
    throw new Error("Para fechar um jogo, informe os dois placares.");
  }

  if (match.stageType === "knockout" && status === "finished" && homeScore === awayScore && !data.get("winner")) {
    throw new Error("Em empate no mata-mata, escolha quem passou.");
  }

  await state.store.saveMatch(state.currentPartyId, {
    id: matchId,
    homeTeamName: requiredText(data.get("homeTeamName"), "Informe o mandante."),
    awayTeamName: requiredText(data.get("awayTeamName"), "Informe o visitante."),
    homeScore,
    awayScore,
    winner: data.get("winner") || "",
    status,
  });
}

async function handleSaveScoring(form) {
  const data = formData(form);
  const scoring = {
    exact: numberFrom(data.get("exact"), "Placar exato"),
    outcome: numberFrom(data.get("outcome"), "Vencedor correto"),
    miss: numberFrom(data.get("miss"), "Erro"),
  };

  await state.store.saveScoring(state.currentPartyId, scoring);
}

async function refreshParties() {
  if (!state.user) {
    state.parties = [];
    return;
  }

  state.parties = await state.store.listParties();
  const selectedStillExists = state.parties.some((party) => party.partyId === state.currentPartyId);

  if (!selectedStillExists) {
    state.currentPartyId = state.parties[0]?.partyId || null;
  }

  if (state.currentPartyId) {
    localStorage.setItem(selectedPartyKey, state.currentPartyId);
    await loadCurrentParty();
  } else {
    localStorage.removeItem(selectedPartyKey);
    state.partyState = null;
  }
}

async function loadCurrentParty() {
  if (!state.currentPartyId) {
    state.partyState = null;
    return;
  }

  state.partyState = await state.store.getParty(state.currentPartyId);
}

function render() {
  if (!state.store) {
    app.innerHTML = renderBoot();
    return;
  }

  app.innerHTML = `
    ${renderNotice()}
    ${state.user ? renderDashboard() : renderAuth()}
  `;
}

function renderBoot() {
  return `
    <div class="boot-screen">
      <div class="brand-mark" aria-hidden="true">
        <img src="assets/logo.png" alt="Logo" style="width: 100%; height: 100%; object-fit: contain; border-radius: 50%;" />
      </div>
      <p>Carregando BigBall...</p>
    </div>
  `;
}

function renderNotice() {
  if (!state.notice) {
    return "";
  }

  return `
    <div class="notice notice-${state.notice.type}" role="status">
      ${escapeHtml(state.notice.message)}
    </div>
  `;
}

function renderAuth() {
  const firebaseMode = state.store.mode === "firebase";

  return `
    <main class="auth-layout">
      <section class="auth-panel">
        <div class="brand-row">
          <div class="brand-mark" aria-hidden="true">
            <img src="assets/logo.png" alt="Logo" style="width: 100%; height: 100%; object-fit: contain; border-radius: 50%;" />
          </div>
          <div>
            <p class="eyebrow">Dê seu chute certeiro</p>
            <h1>BigBall</h1>
          </div>
        </div>

        <form class="form-grid" data-action="auth">
          <label>
            Nome
            <input name="name" autocomplete="name" placeholder="Seu nome" />
          </label>
          <label>
            E-mail
            <input name="email" type="email" autocomplete="email" placeholder="voce@email.com" required />
          </label>
          ${
            firebaseMode
              ? `<label>
                  Senha
                  <input name="password" type="password" autocomplete="current-password" minlength="6" required />
                </label>`
              : ""
          }
          <div class="button-row">
            ${
              firebaseMode
                ? `<button class="button button-primary" type="submit" data-intent="signin">Entrar</button>
                   <button class="button" type="submit" data-intent="signup">Criar conta</button>`
                : `<button class="button button-primary" type="submit">Entrar no modo local</button>`
            }
          </div>
        </form>

        <p class="helper-text">
          ${firebaseMode
            ? "Firebase conectado. Os dados serao salvos no Firestore."
            : "Modo local para teste. Preencha o Firebase para salvar em banco real."}
        </p>
      </section>
    </main>
  `;
}

function renderDashboard() {
  return `
    <header class="topbar">
      <div class="brand-row compact">
        <div class="brand-mark" aria-hidden="true">
          <img src="assets/logo.png" alt="Logo" style="width: 100%; height: 100%; object-fit: contain; border-radius: 50%;" />
        </div>
        <div>
          <p class="eyebrow">${state.store.mode === "firebase" ? "Firestore" : "Modo local"}</p>
          <h1>BigBall</h1>
        </div>
      </div>
      <div class="user-box">
        <span>${escapeHtml(state.user.name || state.user.email)}</span>
        <button class="button button-ghost" data-action="refresh" type="button" ${disabled()}>
          Atualizar
        </button>
        <button class="button button-ghost" data-action="sign-out" type="button" ${disabled()}>
          Sair
        </button>
      </div>
    </header>

    <div class="dashboard">
      ${renderSidebar()}
      <main class="workspace">
        ${state.partyState ? renderParty() : renderEmptyParty()}
      </main>
    </div>
  `;
}

function renderSidebar() {
  return `
    <aside class="sidebar">
      <section class="panel">
        <h2>Minhas parties</h2>
        <div class="party-list">
          ${
            state.parties.length
              ? state.parties.map(renderPartyButton).join("")
              : `<p class="muted">Nenhuma party ainda.</p>`
          }
        </div>
      </section>

      <section class="panel">
        <h2>Criar party</h2>
        <form class="form-grid" data-action="create-party">
          <label>
            Nome da party
            <input name="name" placeholder="Amigos da Copa" required />
          </label>
          <button class="button button-primary" type="submit" ${disabled()}>Criar</button>
        </form>
      </section>

      <section class="panel">
        <h2>Entrar</h2>
        <form class="form-grid" data-action="join-party">
          <label>
            Codigo
            <input name="code" placeholder="ABC123" maxlength="8" required />
          </label>
          <button class="button" type="submit" ${disabled()}>Entrar na party</button>
        </form>
      </section>
    </aside>
  `;
}

function renderPartyButton(party) {
  const selected = party.partyId === state.currentPartyId ? "is-selected" : "";
  return `
    <button class="party-button ${selected}" data-action="select-party" data-party-id="${escapeHtml(
      party.partyId,
    )}" type="button">
      <span>${escapeHtml(party.name)}</span>
      <small>${escapeHtml(party.code)} - ${party.memberCount || 1} participante(s)</small>
    </button>
  `;
}

function renderEmptyParty() {
  return `
    <section class="empty-state">
      <div class="pitch-visual" aria-hidden="true">
        <span></span>
        <span></span>
        <span></span>
      </div>
      <h2>Crie ou entre em uma party</h2>
      <p>Depois disso, voce registra palpites, fecha resultados e acompanha o ranking.</p>
    </section>
  `;
}

function renderParty() {
  const { party, members } = state.partyState;
  const owner = party.ownerUid === state.user.uid;
  const tabs = [
    ["predictions", "Palpites"],
    ["results", "Resultados"],
    ["ranking", "Ranking"],
    ["rules", "Regras"],
  ];

  return `
    <section class="party-header">
      <div>
        <p class="eyebrow">${owner ? "Voce e dono" : "Participante"}</p>
        <h2>${escapeHtml(party.name)}</h2>
        <div class="meta-row">
          <span>Codigo ${escapeHtml(party.code)}</span>
          <span>${members.length} participante(s)</span>
          <button class="link-button" data-action="copy-code" data-code="${escapeHtml(
            party.code,
          )}" type="button">Copiar codigo</button>
          ${
            owner
              ? `<button class="link-button" data-action="sync-schedule" type="button" ${disabled()}>
                  Sincronizar tabela
                </button>`
              : ""
          }
        </div>
        ${renderScheduleSource(party.scheduleSource)}
      </div>
      <div class="score-summary">
        ${renderMyScore()}
      </div>
    </section>

    <nav class="tabs" aria-label="Areas da party">
      ${tabs
        .map(
          ([id, label]) => `
            <button class="${state.activeTab === id ? "is-active" : ""}" data-action="tab" data-tab="${id}" type="button">
              ${label}
            </button>
          `,
        )
        .join("")}
    </nav>

    <section class="tab-panel">
      ${renderActiveTab()}
    </section>
  `;
}

function renderMyScore() {
  const { party, members, matches, predictions } = state.partyState;
  const scoring = party.scoring || DEFAULT_SCORING;
  const ranking = buildRanking(members, matches, predictions, scoring);
  const me = ranking.find((row) => row.uid === state.user.uid);

  return `
    <span>${me?.total || 0}</span>
    <small>pontos</small>
  `;
}

function renderScheduleSource(source) {
  if (!source?.label) {
    return "";
  }

  return `
    <p class="schedule-source">
      Fonte: ${escapeHtml(source.label)}${source.importedAt ? ` - ${formatDateTime(source.importedAt)}` : ""}
    </p>
  `;
}

function renderActiveTab() {
  if (state.activeTab === "results") {
    return renderResults();
  }

  if (state.activeTab === "ranking") {
    return renderRanking();
  }

  if (state.activeTab === "rules") {
    return renderRules();
  }

  return renderPredictions();
}

function renderPredictions() {
  const matches = filteredMatches();

  return `
    ${renderFilters()}
    <div class="match-list">
      ${matches.map(renderPredictionMatch).join("")}
    </div>
  `;
}

function renderFilters() {
  return `
    <form class="filter-bar" data-action="apply-filters">
      <label>
        Fase
        <select name="stage">
          ${STAGE_FILTERS.map(
            (filter) =>
              `<option value="${filter.value}" ${selected(state.filters.stage, filter.value)}>${filter.label}</option>`,
          ).join("")}
        </select>
      </label>
      <label>
        Grupo
        <select name="group">
          ${GROUP_FILTERS.map(
            (filter) =>
              `<option value="${filter.value}" ${selected(state.filters.group, filter.value)}>${filter.label}</option>`,
          ).join("")}
        </select>
      </label>
      <button class="button" type="submit" ${disabled()}>Filtrar</button>
    </form>
  `;
}

function renderPredictionMatch(match) {
  const prediction = predictionFor(match.id, state.user.uid);
  const score = calculatePoints(match, prediction, state.partyState.party.scoring || DEFAULT_SCORING);
  const closed = match.status === "finished";

  return `
    <form class="match-row" data-action="save-prediction">
      <input type="hidden" name="matchId" value="${escapeHtml(match.id)}" />
      <div class="match-info">
        <span class="stage-badge">${escapeHtml(match.stageName)}</span>
        <strong>${escapeHtml(match.roundName)}</strong>
        <small>${renderMatchMeta(match, closed)}</small>
      </div>
      <div class="prediction-grid">
        <span class="team-name">
          <img src="${getFlagUrl(match.homeTeamName)}" class="team-flag" alt="" />
          ${escapeHtml(match.homeTeamName)}
        </span>
        <input name="homeScore" type="number" min="0" inputmode="numeric" value="${formatInput(prediction?.homeScore)}" aria-label="Placar do mandante" ${closed ? "disabled" : ""} />
        <span class="versus">x</span>
        <input name="awayScore" type="number" min="0" inputmode="numeric" value="${formatInput(prediction?.awayScore)}" aria-label="Placar do visitante" ${closed ? "disabled" : ""} />
        <span class="team-name align-right">
          ${escapeHtml(match.awayTeamName)}
          <img src="${getFlagUrl(match.awayTeamName)}" class="team-flag" alt="" />
        </span>
      </div>
      ${renderWinnerSelect(match, prediction?.winner, closed)}
      <div class="row-actions">
        <span class="points-pill ${score.kind}">${score.points} pts - ${escapeHtml(score.label)}</span>
        <button class="button button-primary" type="submit" ${closed || state.busy ? "disabled" : ""}>Salvar</button>
      </div>
    </form>
  `;
}

function renderResults() {
  const owner = state.partyState.party.ownerUid === state.user.uid;
  const matches = filteredMatches();

  return `
    ${renderFilters()}
    <div class="section-heading">
      <div>
        <h3>${owner ? "Lancamento de resultados" : "Resultados oficiais da party"}</h3>
        <p class="muted">${owner ? "Edite selecoes, placares e status dos jogos." : "Somente o dono da party altera resultados."}</p>
      </div>
    </div>
    <div class="match-list">
      ${matches.map((match) => (owner ? renderResultEditor(match) : renderReadonlyResult(match))).join("")}
    </div>
  `;
}

function renderResultEditor(match) {
  return `
    <form class="match-row editor-row" data-action="save-match">
      <input type="hidden" name="matchId" value="${escapeHtml(match.id)}" />
      <div class="match-info">
        <span class="stage-badge">${escapeHtml(match.stageName)}</span>
        <strong>${escapeHtml(match.roundName)}</strong>
        <small>${escapeHtml(match.id)}${match.sourceMatchNumber ? ` - FIFA ${match.sourceMatchNumber}` : ""}</small>
      </div>
      <div class="editor-grid">
        <label>
          Mandante
          <input name="homeTeamName" value="${escapeHtml(match.homeTeamName)}" required />
        </label>
        <label>
          Placar
          <input name="homeScore" type="number" min="0" inputmode="numeric" value="${formatInput(
            match.homeScore,
          )}" />
        </label>
        <label>
          Visitante
          <input name="awayTeamName" value="${escapeHtml(match.awayTeamName)}" required />
        </label>
        <label>
          Placar
          <input name="awayScore" type="number" min="0" inputmode="numeric" value="${formatInput(
            match.awayScore,
          )}" />
        </label>
        <label>
          Status
          <select name="status">
            <option value="scheduled" ${selected(match.status, "scheduled")}>Aberto</option>
            <option value="finished" ${selected(match.status, "finished")}>Fechado</option>
          </select>
        </label>
      </div>
      ${renderWinnerSelect(match, match.winner, false)}
      <div class="row-actions">
        <span class="points-pill ${match.status === "finished" ? "exact" : "pending"}">
          ${match.status === "finished" ? "Resultado fechado" : "Aguardando"}
        </span>
        <button class="button button-primary" type="submit" ${disabled()}>Salvar resultado</button>
      </div>
    </form>
  `;
}

function renderReadonlyResult(match) {
  return `
    <article class="match-row">
      <div class="match-info">
        <span class="stage-badge">${escapeHtml(match.stageName)}</span>
        <strong>${escapeHtml(match.roundName)}</strong>
        <small>${renderMatchMeta(match, match.status === "finished")}</small>
      </div>
      <div class="scoreboard">
        <span class="team-name">
          <img src="${getFlagUrl(match.homeTeamName)}" class="team-flag" alt="" />
          ${escapeHtml(match.homeTeamName)}
        </span>
        <strong>${formatScore(match)}</strong>
        <span class="team-name align-right">
          ${escapeHtml(match.awayTeamName)}
          <img src="${getFlagUrl(match.awayTeamName)}" class="team-flag" alt="" />
        </span>
      </div>
    </article>
  `;
}

function renderRanking() {
  const { party, members, matches, predictions } = state.partyState;
  const ranking = buildRanking(members, matches, predictions, party.scoring || DEFAULT_SCORING);

  return `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Participante</th>
            <th>Total</th>
            <th>Exatos</th>
            <th>Vencedor</th>
            <th>Erros</th>
          </tr>
        </thead>
        <tbody>
          ${ranking
            .map(
              (row, index) => `
                <tr class="${row.uid === state.user.uid ? "is-me" : ""}">
                  <td>${index + 1}</td>
                  <td>
                    <strong>${escapeHtml(row.name)}</strong>
                    <small>${escapeHtml(row.email)}</small>
                  </td>
                  <td>${row.total}</td>
                  <td>${row.exact}</td>
                  <td>${row.outcome}</td>
                  <td>${row.miss}</td>
                </tr>
              `,
            )
            .join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderRules() {
  const owner = state.partyState.party.ownerUid === state.user.uid;
  const scoring = state.partyState.party.scoring || DEFAULT_SCORING;

  return `
    <div class="rules-grid">
      <section class="panel no-margin">
        <h3>Pontuacao</h3>
        <form class="form-grid scoring-form" data-action="save-scoring">
          <label>
            Placar exato
            <input name="exact" type="number" min="0" value="${scoring.exact}" ${owner ? "" : "disabled"} />
          </label>
          <label>
            Vencedor correto
            <input name="outcome" type="number" min="0" value="${scoring.outcome}" ${owner ? "" : "disabled"} />
          </label>
          <label>
            Erro
            <input name="miss" type="number" min="0" value="${scoring.miss}" ${owner ? "" : "disabled"} />
          </label>
          ${
            owner
              ? `<button class="button button-primary" type="submit" ${disabled()}>Salvar regras</button>`
              : `<p class="muted">Apenas o dono da party altera a pontuacao.</p>`
          }
        </form>
      </section>

      <section class="panel no-margin">
        <h3>Modelo de disputa</h3>
        <dl class="definition-list">
          <div><dt>Grupos</dt><dd>12 grupos com 4 selecoes e 72 jogos.</dd></div>
          <div><dt>Mata-mata</dt><dd>32 classificados ate a final, totalizando 104 jogos.</dd></div>
          <div><dt>Empate no mata-mata</dt><dd>Escolha o classificado quando o placar terminar empatado.</dd></div>
        </dl>
      </section>
    </div>
  `;
}

function renderWinnerSelect(match, currentValue = "", disabledSelect = false) {
  if (match.stageType !== "knockout") {
    return "";
  }

  return `
    <label class="winner-select">
      Classificado
      <select name="winner" ${disabledSelect ? "disabled" : ""}>
        <option value="" ${selected(currentValue, "")}>Pelo placar</option>
        <option value="home" ${selected(currentValue, "home")}>${escapeHtml(match.homeTeamName)}</option>
        <option value="away" ${selected(currentValue, "away")}>${escapeHtml(match.awayTeamName)}</option>
      </select>
    </label>
  `;
}

function filteredMatches() {
  return state.partyState.matches.filter((match) => {
    const stageOk =
      state.filters.stage === "all" ||
      match.stageType === state.filters.stage ||
      match.stage === state.filters.stage;
    const groupOk = state.filters.group === "all" || match.group === state.filters.group;

    return stageOk && groupOk;
  });
}

function predictionFor(matchId, uid) {
  return state.partyState.predictions.find(
    (prediction) => prediction.matchId === matchId && prediction.uid === uid,
  );
}

function formData(form) {
  return new FormData(form);
}

function requiredText(value, message) {
  const text = String(value || "").trim();
  if (!text) {
    throw new Error(message);
  }
  return text;
}

function numberFrom(value, label) {
  const parsed = normalizeScore(value);
  if (parsed === null) {
    throw new Error(`${label}: informe um numero inteiro igual ou maior que zero.`);
  }
  return parsed;
}

function setNotice(message, type = "success") {
  state.notice = { message, type };
}

function formatInput(value) {
  return Number.isInteger(value) ? String(value) : "";
}

function formatScore(match) {
  if (!Number.isInteger(match.homeScore) || !Number.isInteger(match.awayScore)) {
    return "- x -";
  }
  return `${match.homeScore} x ${match.awayScore}`;
}

function renderMatchMeta(match, closed) {
  const parts = [];

  if (closed) {
    parts.push(`Resultado ${formatScore(match)}`);
  } else {
    parts.push("Aberto para palpite");
  }

  if (match.date) {
    parts.push(match.time ? `${match.date} ${match.time}` : match.date);
  }

  if (match.ground) {
    parts.push(match.ground);
  }

  if (match.stageType === "knockout" && match.crossingHome && match.crossingAway) {
    parts.push(`${match.crossingHome} x ${match.crossingAway}`);
  }

  return escapeHtml(parts.join(" - "));
}

function formatDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function selected(current, expected) {
  return current === expected ? "selected" : "";
}

function disabled() {
  return state.busy ? "disabled" : "";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
