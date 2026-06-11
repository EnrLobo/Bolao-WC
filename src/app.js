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
  store: null, user: null, parties: [], partyState: null,
  currentPartyId: localStorage.getItem(selectedPartyKey),
  activeTab: "groups-stage",
  filters: { stage: "group", group: "A" },
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
    appContainer.innerHTML = `<div style="padding: 30px; text-align: center; color: #ff1744;"><h2>Erro ao carregar o aplicativo</h2><p>${error.message}</p></div>`;
  }
}

function bindGlobalEvents() {
  appContainer.addEventListener("submit", async (e) => { 
    e.preventDefault(); 
    const f = e.target; 
    if (f.dataset.action) await executeAction(f.dataset.action, f, e.submitter); 
  });

  appContainer.addEventListener("click", async (e) => { 
    const b = e.target.closest("[data-action]"); 
    if (b && b.dataset.action && b.tagName !== "FORM" && b.type !== "submit") {
      await executeAction(b.dataset.action, b); 
    }
  });
}

async function executeAction(action, source, submitter) {
  if (state.busy) return;
  state.busy = true;

  try {
    if (action === "tab") { state.activeTab = source.dataset.tab; document.getElementById("workspace").innerHTML = renderParty(state); }
    else if (action === "filter-group") { state.filters.group = source.dataset.group; document.getElementById("workspace").innerHTML = renderParty(state); }
    else if (action === "filter-stage") { state.filters.stage = source.dataset.stage; document.getElementById("workspace").innerHTML = renderParty(state); }
    else if (action === "copy-code") { await navigator.clipboard.writeText(source.dataset.code); showToast("Código copiado."); }
    else if (action === "view-team") { openTeamModal(source.dataset.team, state.partyState.matches); }
    else await handleAsyncActions(action, source, submitter);
  } catch (error) {
    console.error("Erro capturado:", error);
    alert(`Aviso: ${error.message}`);
  } finally {
    state.busy = false;
    
    // Força a liberação de TODOS os botões da tela caso algum tenha sido renderizado desativado
    document.querySelectorAll('button').forEach(b => {
      b.classList.remove('is-loading');
      b.disabled = false; 
    });
    
    // Atualiza apenas a área de trabalho
    const workspace = document.getElementById("workspace");
    if (workspace && state.partyState) {
      workspace.innerHTML = renderParty(state);
    }
  }
}

async function handleAsyncActions(action, source, submitter) {
  const formData = source.tagName === "FORM" ? new FormData(source) : null;

  if (action === "auth") {
    const name = String(formData.get("name") || "").trim();
    const email = requiredText(formData.get("email"), "Informe o e-mail.").toLowerCase();
    if (state.store.mode === "local") { await state.store.signInLocal({ name, email }); showToast("Acesso local ativo."); return; }
    const password = requiredText(formData.get("password"), "Informe a senha.");
    const intent = submitter?.dataset.intent || "signin";
    if (intent === "signup") { await state.store.signUp({ name, email, password }); showToast("Conta criada."); } 
    else { await state.store.signIn({ email, password }); showToast("Login realizado."); }
  }

  if (action === "sign-out") {
    await state.store.signOut();
    state.currentPartyId = null; state.parties = [];
    localStorage.removeItem(selectedPartyKey);
  }

  if (action === "create-party") {
    const name = requiredText(formData.get("name"), "Informe o nome.");
    state.currentPartyId = await state.store.createParty({ name });
    localStorage.setItem(selectedPartyKey, state.currentPartyId);
    
    // Libera o estado ocupado ANTES de redesenhar a tela inteira
    state.busy = false; 
    
    await refreshParties(); 
    showToast("Party criada."); 
    renderApp();
  }

  if (action === "join-party") {
    const code = requiredText(formData.get("code"), "Informe o código.");
    state.currentPartyId = await state.store.joinParty({ code });
    localStorage.setItem(selectedPartyKey, state.currentPartyId);
    
    state.busy = false;
    
    await refreshParties(); 
    showToast("Você entrou na party."); 
    renderApp();
  }

  if (action === "select-party") {
    state.currentPartyId = source.dataset.partyId;
    localStorage.setItem(selectedPartyKey, state.currentPartyId);
    await loadCurrentParty(); renderApp();
  }

  if (action === "delete-party") {
    if (confirm("Tem certeza que deseja excluir esta party permanentemente? Todos os dados serão perdidos.")) {
      if (state.store.unsubscribeFromParty) state.store.unsubscribeFromParty();
      await state.store.deleteParty(state.currentPartyId);
      
      state.currentPartyId = null; 
      state.partyState = null;
      localStorage.removeItem(selectedPartyKey);
      
      state.busy = false;
      
      await refreshParties(); 
      showToast("Party excluída."); 
      renderApp();
    }
  }

  if (action === "leave-party") {
    if (confirm("Tem certeza que deseja sair desta party?")) {
      if (state.store.unsubscribeFromParty) state.store.unsubscribeFromParty();
      await state.store.leaveParty(state.currentPartyId);
      
      state.currentPartyId = null; 
      state.partyState = null;
      localStorage.removeItem(selectedPartyKey);
      
      state.busy = false;
      
      await refreshParties(); 
      showToast("Você saiu da party."); 
      renderApp();
    }
  }

  if (action === "save-prediction") {
    const matchId = formData.get("matchId");
    const homeScore = normalizeScore(formData.get("homeScore"));
    const awayScore = normalizeScore(formData.get("awayScore"));
    
    if (homeScore === null && awayScore === null) {
      if (state.store.deletePrediction) {
        await state.store.deletePrediction(state.currentPartyId, matchId);
        showToast("Palpite apagado.");
      }
    } else if (homeScore === null || awayScore === null) {
      throw new Error("Informe os dois placares para salvar, ou deixe ambos em branco para apagar.");
    } else {
      await state.store.savePrediction(state.currentPartyId, { matchId, homeScore, awayScore, winner: formData.get("winner") || "" });
      showToast("Palpite salvo.");
    }
  }

  if (action === "save-match") {
    await state.store.saveMatch(state.currentPartyId, {
      id: formData.get("matchId"), homeTeamName: formData.get("homeTeamName"), awayTeamName: formData.get("awayTeamName"),
      homeScore: normalizeScore(formData.get("homeScore")), awayScore: normalizeScore(formData.get("awayScore")), winner: formData.get("winner") || "", status: formData.get("status")
    });
    showToast("Resultado fechado.");
  }

  if (action === "save-scoring") {
    await state.store.saveScoring(state.currentPartyId, { exact: Number(formData.get("exact")), outcome: Number(formData.get("outcome")), miss: Number(formData.get("miss")) });
    showToast("Regras atualizadas.");
  }

  if (action === "refresh") {
    await refreshParties(); showToast("Dados sincronizados."); renderApp();
  }

  if (action === "sync-schedule") {
    await state.store.syncSchedule(state.currentPartyId); showToast("Tabela sincronizada com sucesso!");
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
    if (state.store.unsubscribeFromParty) state.store.unsubscribeFromParty();
    state.partyState = null;
  }
}

async function loadCurrentParty() {
  if (!state.currentPartyId) { 
    state.partyState = null; 
    if (state.store.unsubscribeFromParty) state.store.unsubscribeFromParty();
    return; 
  }
  
  try {
    state.partyState = await state.store.getParty(state.currentPartyId);
    
    if (state.store.subscribeToParty) {
      state.store.subscribeToParty(state.currentPartyId, (livePartyState) => {
        state.partyState = livePartyState;
        const workspace = document.getElementById("workspace");
        if (workspace && !state.busy) { 
          workspace.innerHTML = renderParty(state);
        }
      });
    }
  } catch (error) {
    console.warn("Limpando party fantasma do cache:", error.message);
    
    // 1. Quebra do Loop Infinito: Limpa o cache imediatamente
    localStorage.removeItem(selectedPartyKey);
    if (state.store.unsubscribeFromParty) state.store.unsubscribeFromParty();
    
    // 2. Remove a party "fantasma" da barra lateral
    state.parties = state.parties.filter(p => p.partyId !== state.currentPartyId);
    
    // 3. Esvazia a tela de forma segura sem chamar a função de novo
    state.currentPartyId = null;
    state.partyState = null;
    renderApp();
  }
}


function renderApp() {
  if (!state.store) return;
  if (!state.user) { appContainer.innerHTML = renderAuth(state); return; }

  appContainer.innerHTML = html`
    <header class="topbar">
      <div class="brand-row compact">
        <div class="brand-mark"><img src="assets/logo.png" alt="Logo" style="width:100%;height:100%;border-radius:50%;" /></div>
        <div><p class="eyebrow">${state.store.mode === "firebase" ? "Firestore" : "Modo local"}</p><h1>BigBall</h1></div>
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