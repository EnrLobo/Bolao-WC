import { html } from "../utils/template.js";

export function renderSidebar(state) {
  const isBusy = state.busy ? "disabled" : "";

  return html`
    <aside class="sidebar">
      <section class="panel">
        <h2>Minhas parties</h2>
        <div class="party-list">
          ${state.parties.length
            ? state.parties.map(p => renderPartyButton(p, state.currentPartyId)) 
            : html`<p class="muted">Nenhuma party ainda.</p>`}
        </div>
      </section>

      <section class="panel">
        <h2>Criar party</h2>
        <form class="form-grid" data-action="create-party">
          <label>
            Nome da party
            <input name="name" placeholder="Amigos da Copa" required />
          </label>
          <button class="button button-primary" type="submit" ${isBusy}>Criar</button>
        </form>
      </section>

      <section class="panel">
        <h2>Entrar</h2>
        <form class="form-grid" data-action="join-party">
          <label>
            Código
            <input name="code" placeholder="ABC123" maxlength="8" required />
          </label>
          <button class="button" type="submit" ${isBusy}>Entrar na party</button>
        </form>
      </section>
    </aside>
  `;
}

function renderPartyButton(party, currentPartyId) {
  const selectedClass = party.partyId === currentPartyId ? "is-selected" : "";
  return html`
    <button class="party-button ${selectedClass}" data-action="select-party" data-party-id="${party.partyId}" type="button">
      <span>${party.name}</span>
      <small>${party.code} - ${party.memberCount || 1} participante(s)</small>
    </button>
  `;
}