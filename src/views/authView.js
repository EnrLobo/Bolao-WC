import { html } from "../utils/template.js";

export function renderAuth(state) {
  const firebaseMode = state.store.mode === "firebase";

  return html`
    <main class="auth-layout">
      <section class="auth-panel">
        <div class="brand-row">
          <div class="brand-mark" aria-hidden="true">
            <img src="assets/logo.png" alt="Logo" style="width: 100%; height: 100%; object-fit: contain; border-radius: 50%;" />
          </div>
          <div class="brand-titles">
            <p class="eyebrow">Dê seu chute certeiro</p>
            <h1>BigBall</h1>
          </div>
        </div>

        <form class="form-grid" data-action="auth">
          <label>
            Nome <span style="font-weight: normal; color: var(--muted);">(Opcional se já tiver conta)</span>
            <input name="name" autocomplete="name" placeholder="Como quer ser chamado" />
          </label>
          <label>
            E-mail
            <input name="email" type="email" autocomplete="email" placeholder="voce@email.com" required />
          </label>
          ${firebaseMode ? html`
            <label>
              Senha
              <input name="password" type="password" autocomplete="current-password" minlength="6" required />
            </label>
          ` : ""}
          <div class="button-row">
            ${firebaseMode ? html`
              <button class="button button-primary" type="submit" data-intent="signin">Entrar no Bolão</button>
              <button class="button" type="submit" data-intent="signup">Criar nova conta</button>
            ` : html`
              <button class="button button-primary" type="submit">Entrar no modo local</button>
            `}
          </div>
        </form>

        <p class="helper-text">
          ${firebaseMode
            ? "Conexão segura estabelecida. Seus dados estão salvos em tempo real na nuvem."
            : "Modo local para teste. Preencha as chaves do Firebase para salvar em banco real."}
        </p>
      </section>
    </main>
  `;
}