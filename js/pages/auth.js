import { signIn, signUp } from '../supabase.js';
import { navigate } from '../router.js';
import { toast } from '../components.js';
import { state } from '../state.js';

export function renderAuth() {
  if (state.profile) { navigate('/'); return; }
  const app = document.getElementById('app');

  app.innerHTML = `
    <div class="auth-wrap">
      <div class="auth-tabs">
        <button data-tab="login" class="active" type="button">Accedi</button>
        <button data-tab="signup" type="button">Registrati</button>
      </div>
      <form id="authForm" class="auth-form" autocomplete="on">
        <div class="field">
          <label>Nome utente</label>
          <input type="text" name="username" autocomplete="username" required minlength="3" maxlength="20" pattern="[a-zA-Z0-9_]+" title="Solo lettere, numeri e underscore">
        </div>
        <div class="field">
          <label>Password</label>
          <input type="password" name="password" autocomplete="current-password" required minlength="6">
        </div>
        <button type="submit" id="authSubmit">Accedi</button>
      </form>
      <p id="authError" class="error"></p>
    </div>
  `;

  let mode = 'login';
  app.querySelectorAll('.auth-tabs button').forEach(t => {
    t.onclick = () => {
      app.querySelectorAll('.auth-tabs button').forEach(x => x.classList.remove('active'));
      t.classList.add('active');
      mode = t.dataset.tab;
      const submit = app.querySelector('#authSubmit');
      submit.textContent = mode === 'login' ? 'Accedi' : 'Registrati';
      const pwd = app.querySelector('input[name=password]');
      pwd.autocomplete = mode === 'login' ? 'current-password' : 'new-password';
    };
  });

  app.querySelector('#authForm').onsubmit = async (e) => {
    e.preventDefault();
    const f = e.target;
    const username = f.username.value.trim().toLowerCase();
    const password = f.password.value;
    const errEl = app.querySelector('#authError');
    errEl.textContent = '';
    if (!/^[a-z0-9_]{3,20}$/.test(username)) {
      errEl.textContent = 'Nome utente: 3-20 caratteri (lettere, numeri, _).';
      return;
    }
    const submit = app.querySelector('#authSubmit');
    submit.disabled = true;
    try {
      if (mode === 'login') await signIn(username, password);
      else await signUp(username, password);
      toast(mode === 'login' ? 'Bentornato!' : 'Registrato!', 'success');
      // auth state change farà il resto
      setTimeout(() => navigate('/'), 150);
    } catch (err) {
      errEl.textContent = translateError(err.message || String(err));
    } finally {
      submit.disabled = false;
    }
  };
}

function translateError(msg) {
  if (/Invalid login/i.test(msg)) return 'Nome utente o password errati.';
  if (/already registered/i.test(msg)) return 'Nome utente già in uso.';
  if (/duplicate key/i.test(msg)) return 'Nome utente già in uso.';
  if (/Password should be/i.test(msg)) return 'Password troppo corta (min. 6 caratteri).';
  if (/rate limit/i.test(msg)) return 'Troppi tentativi, riprova più tardi.';
  return msg;
}