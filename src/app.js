import { createStore } from "./store.js";
import { normalizeScore } from "./scoring.js";
import { showToast } from "./components/toast.js";
import { requiredText } from "./utils/formatters.js";
import { html } from "./utils/template.js";

import { renderAuth } from "./views/authView.js";
import { renderSidebar } from "./views/sidebarView.js";
import { renderParty, renderEmptyParty } from "./views/partyView.js";
import { openTeamModal } from "./components/teamModal.js";

const selectedPartyKey = "bolao-copa-2026:selected-party";
const appContainer = document.querySelector("#app");

export const state = {
  store: null,
  user: null,
  parties: [],
  partyState: null,
  currentPartyId: localStorage.getItem(selectedPartyKey),
  activeTab: "groups-stage", // Nova aba padrão
  filters: { stage: "group", group: "A" }, // Filtros padrão limpos
  busy: false,
};

init();

async function init() {
  try {
    bindGlobalEvents();
    state.store = await createStore();
    
    state.store.onAuthChanged(async (user) => {
      state.user = user;
      state.partyState = null;
      if (user) await refreshParties();
      renderApp();
    });
  } catch (error) {
    console.error("Erro fatal ao inicializar:", error);
    appContainer.innerHTML = `
      <div style="padding: 30px; text-align: center; color: #b42318;">
        <h2>Erro ao carregar o aplicativo</h2>
        <p>${error.message}</p>
        <p><small>Abra o Console (F12) para ver os detalhes do erro.</small></p>
      </div>
    `;
  }
}

function bindGlobalEvents() {
  appContainer.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.target;
    const action = form.dataset.action;
    if (action) await executeAction(action, form, event.submitter);
  });

  appContainer.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-action]");
    if (!button || button.tagName === "FORM" || button.type === "submit") return;
    await executeAction(button.dataset.action, button);
  });
}

async function executeAction(action, source, submitter) {
  if (state.busy) return;
  state.busy = true;
  document.querySelectorAll('button[type="submit"]').forEach(b => b.classList.add('is-loading'));

  try {
    if (action === "tab") {
      state.activeTab = source.dataset.tab;
      document.getElementById("workspace").innerHTML = renderParty(state);
    } else if (action === "filter-group") {
      state.filters.group = source.dataset.group;
      document.getElementById("workspace").innerHTML = renderParty(state);
    } else if (action === "filter-stage") {
      state.filters.stage = source.dataset.stage;
      document.getElementById("workspace").innerHTML = renderParty(state);
    } else if (action === "copy-code") {
      await navigator.clipboard.writeText(source.dataset.code);
      showToast("Código copiado.");
    } else if (action === "view-team") {
      const teamName = source.dataset.team;
      openTeamModal(teamName, state.partyState.matches);
    } else {
      await handleAsyncActions(action, source, submitter);
    }
  } catch (error) {
    showToast(error.message || "Algo deu errado.", "error");
  } finally {
    state.busy = false;
    document.querySelectorAll('button').forEach(b => b.classList.remove('is-loading'));
  }
}

async function handleAsyncActions(action, source, submitter) {
  const formData = source.tagName === "FORM" ? new FormData(source) : null;

  if (action === "auth") {
    const name = String(formData.get("name") || "").trim();
    const email = requiredText(formData.get("email"), "Informe o e-mail.").toLowerCase();
    
    if (state.store.mode === "local") {
      await state.store.signInLocal({ name, email });
      showToast("Acesso local ativo.");
      return;
    }
    
    const password = requiredText(formData.get("password"), "Informe a senha.");
    const intent = submitter?.dataset.intent || "signin";
    
    if (intent === "signup") {
      await state.store.signUp({ name, email, password });
      showToast("Conta criada.");
    } else {
      await state.store.signIn({ email, password });
      showToast("Login realizado.");
    }
  }

  if (action === "sign-out") {
    await state.store.signOut();
    state.currentPartyId = null;
    state.parties = [];
    localStorage.removeItem(selectedPartyKey);
  }

  if (action === "create-party") {
    const name = requiredText(formData.get("name"), "Informe o nome.");
    state.currentPartyId = await state.store.createParty({ name });
    localStorage.setItem(selectedPartyKey, state.currentPartyId);
    await refreshParties();
    showToast("Party criada.");
    renderApp();
  }

  if (action === "join-party") {
    const code = requiredText(formData.get("code"), "Informe o código.");
    state.currentPartyId = await state.store.joinParty({ code });
    localStorage.setItem(selectedPartyKey, state.currentPartyId);
    await refreshParties();
    showToast("Você entrou na party.");
    renderApp();
  }

  if (action === "select-party") {
    state.currentPartyId = source.dataset.partyId;
    localStorage.setItem(selectedPartyKey, state.currentPartyId);
    await loadCurrentParty();
    renderApp();
  }

  if (action === "delete-party") {
    if (confirm("Tem certeza que deseja excluir esta party permanentemente?")) {
      await state.store.deleteParty(state.currentPartyId);
      state.currentPartyId = null;
      localStorage.removeItem(selectedPartyKey);
      await refreshParties();
      showToast("Party excluída.");
      renderApp();
    }
  }

  if (action === "leave-party") {
    if (confirm("Tem certeza que deseja sair desta party?")) {
      await state.store.leaveParty(state.currentPartyId);
      state.currentPartyId = null;
      localStorage.removeItem(selectedPartyKey);
      await refreshParties();
      showToast("Você saiu da party.");
      renderApp();
    }
  }

  if (action === "save-prediction") {
    const matchId = formData.get("matchId");
    const homeScore = normalizeScore(formData.get("homeScore"));
    const awayScore = normalizeScore(formData.get("awayScore"));
    const winner = formData.get("winner") || "";
    
    if (homeScore === null || awayScore === null) throw new Error("Informe os dois placares.");
    await state.store.savePrediction(state.currentPartyId, { matchId, homeScore, awayScore, winner });
    await loadCurrentParty();
    showToast("Palpite salvo.");
    document.getElementById("workspace").innerHTML = renderParty(state);
  }

  if (action === "save-match") {
    const status = formData.get("status");
    await state.store.saveMatch(state.currentPartyId, {
      id: formData.get("matchId"),
      homeTeamName: formData.get("homeTeamName"),
      awayTeamName: formData.get("awayTeamName"),
      homeScore: normalizeScore(formData.get("homeScore")),
      awayScore: normalizeScore(formData.get("awayScore")),
      winner: formData.get("winner") || "",
      status
    });
    await loadCurrentParty();
    showToast("Resultado fechado.");
    document.getElementById("workspace").innerHTML = renderParty(state);
  }

  if (action === "save-scoring") {
    await state.store.saveScoring(state.currentPartyId, {
      exact: Number(formData.get("exact")),
      outcome: Number(formData.get("outcome")),
      miss: Number(formData.get("miss")),
    });
    await loadCurrentParty();
    showToast("Regras atualizadas.");
    document.getElementById("workspace").innerHTML = renderParty(state);
  }

  if (action === "refresh") {
    await refreshParties();
    showToast("Dados sincronizados.");
    renderApp();
  }

  if (action === "sync-schedule") {
    await state.store.syncSchedule(state.currentPartyId);
    await loadCurrentParty();
    showToast("Tabela sincronizada com sucesso!");
    document.getElementById("workspace").innerHTML = renderParty(state);
  }
}

async function refreshParties() {
  if (!state.user) { state.parties = []; return; }
  state.parties = await state.store.listParties();
  if (!state.parties.some(p => p.partyId === state.currentPartyId)) {
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
  if (!state.currentPartyId) { state.partyState = null; return; }
  state.partyState = await state.store.getParty(state.currentPartyId);
}

function renderApp() {
  if (!state.store) return;
  
  if (!state.user) {
    appContainer.innerHTML = renderAuth(state);
    return;
  }

  appContainer.innerHTML = html`
    <header class="topbar">
      <div class="brand-row compact">
        <div class="brand-mark"><img src="assets/logo.png" alt="Logo" style="width:100%;height:100%;border-radius:50%;" /></div>
        <div>
          <p class="eyebrow">${state.store.mode === "firebase" ? "Firestore" : "Modo local"}</p>
          <h1>BigBall</h1>
        </div>
      </div>
      <div class="user-box">
        <span>${state.user.name || state.user.email}</span>
        <button class="button button-ghost" data-action="refresh" type="button">Atualizar</button>
        <button class="button button-ghost" data-action="sign-out" type="button">Sair</button>
      </div>
    </header>
    <div class="dashboard">
      ${renderSidebar(state)}
      <main class="workspace" id="workspace">
        ${state.partyState ? renderParty(state) : renderEmptyParty()}
      </main>
    </div>
  `;
}