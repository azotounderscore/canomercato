import { sb, getSession, getProfile } from './supabase.js';
import { state } from './state.js';
import { route, start, setOnNav } from './router.js';
import { renderNav, toast } from './components.js';
import { unsubscribeAll } from './realtime.js';

import { renderAuth } from './pages/auth.js';
import { renderHome } from './pages/home.js';
import { renderBet } from './pages/bet.js';
import { renderNewBet } from './pages/newbet.js';
import { renderProfile } from './pages/profile.js';
import { renderAdmin } from './pages/admin.js';
import { renderSearch } from './pages/search.js';

async function refreshProfile() {
  const s = await getSession();
  state.session = s;
  state.profile = s ? await getProfile(s.user.id) : null;
}

function setupRoutes() {
  route('/', () => renderHome());
  route('/bet/:id', ({ id }) => renderBet(id));
  route('/new', () => renderNewBet());
  route('/u/:username', ({ username }) => renderProfile(username));
  route('/admin', () => renderAdmin());
  route('/search', ({ q }) => renderSearch(q));
  route('/login', () => renderAuth());
}

async function init() {
  await refreshProfile();
  setupRoutes();

  sb.auth.onAuthStateChange(async () => {
    await refreshProfile();
    renderNav();
    // re-renderizza la route corrente
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  });

  setOnNav(() => unsubscribeAll());
  renderNav();
  start();

  // Aggiorna saldo quando cambia il profilo (admin che modifica crediti)
  sb.channel('profile-self')
    .on('postgres_changes', {
      event: 'UPDATE', schema: 'public', table: 'profiles',
      filter: state.profile ? `id=eq.${state.profile.id}` : 'id=eq.00000000-0000-0000-0000-000000000000'
    }, async () => {
      await refreshProfile();
    })
    .subscribe();
}

init().catch(e => {
  console.error(e);
  document.getElementById('app').innerHTML = '<div class="error-box">Errore di avvio: ' + e.message + '</div>';
});