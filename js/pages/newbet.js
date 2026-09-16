import { sb } from '../supabase.js';
import { state } from '../state.js';
import { navigate } from '../router.js';
import { toast } from '../components.js';
import { escapeHTML, toLocalInputValue } from '../utils.js';

export async function renderNewBet() {
  if (!state.profile) { navigate('/login'); return; }

  const app = document.getElementById('app');
  const cats = state.categories.length
    ? state.categories
    : (await sb.from('categories').select('*').order('sort_order')).data || [];
  state.categories = cats;

  const defaultDeadline = new Date(Date.now() + 24 * 3600 * 1000);

  app.innerHTML = `
    <div class="page-header">
      <h1>Nuova scommessa</h1>
    </div>
    <form id="newBetForm" class="section">
      <div class="field">
        <label>Titolo *</label>
        <input type="text" name="title" required maxlength="140" placeholder="Es. Domani pioverà?">
      </div>
      <div class="field">
        <label>Descrizione</label>
        <textarea name="description" maxlength="600" placeholder="Dettagli, regole di risoluzione…"></textarea>
      </div>
      <div class="field">
        <label>Categoria *</label>
        <select name="category_id" required>
          ${cats.map(c => `<option value="${c.id}">${escapeHTML(c.name)}</option>`).join('')}
        </select>
      </div>
      <div class="field">
        <label>Scadenza puntate *</label>
        <input type="datetime-local" name="deadline" required value="${toLocalInputValue(defaultDeadline)}">
      </div>
      <button type="submit" class="btn-primary" style="width:100%">Crea scommessa</button>
      <p class="error" id="newBetErr"></p>
    </form>
  `;

  app.querySelector('#newBetForm').onsubmit = async (e) => {
    e.preventDefault();
    const f = e.target;
    const err = app.querySelector('#newBetErr');
    err.textContent = '';

    const title = f.title.value.trim();
    const description = f.description.value.trim() || null;
    const category_id = parseInt(f.category_id.value, 10);
    const deadline = new Date(f.deadline.value);

    if (!title) { err.textContent = 'Titolo obbligatorio'; return; }
    if (!(deadline > new Date())) { err.textContent = 'La scadenza deve essere nel futuro'; return; }

    const submit = f.querySelector('button[type=submit]');
    submit.disabled = true;
    const { data, error } = await sb.from('bets').insert({
      creator_id: state.profile.id,
      title, description, category_id,
      deadline: deadline.toISOString()
    }).select('id').single();
    submit.disabled = false;

    if (error) { err.textContent = error.message; return; }
    toast('Scommessa creata!', 'success');
    navigate('/bet/' + data.id);
  };
}