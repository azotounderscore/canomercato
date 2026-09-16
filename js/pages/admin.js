import { sb } from '../supabase.js';
import { state } from '../state.js';
import { navigate } from '../router.js';
import { subscribe } from '../realtime.js';
import { toast, openModal } from '../components.js';
import { escapeHTML, fmt, pct, fullDate, statusInfo } from '../utils.js';

let tab = 'bets';

export async function renderAdmin() {
  if (!state.profile?.is_admin) { navigate('/'); return; }

  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="page-header"><h1>Admin</h1></div>
    <div class="admin-tabs">
      <button data-tab="bets" class="${tab==='bets'?'active':''}">Scommesse</button>
      <button data-tab="users" class="${tab==='users'?'active':''}">Utenti</button>
      <button data-tab="cats" class="${tab==='cats'?'active':''}">Categorie</button>
    </div>
    <div id="adminBody"><div class="loading">Caricamento…</div></div>
  `;
  app.querySelectorAll('.admin-tabs button').forEach(b => {
    b.onclick = () => { tab = b.dataset.tab; renderAdmin(); };
  });

  if (tab === 'bets') await renderBetsTab();
  if (tab === 'users') await renderUsersTab();
  if (tab === 'cats') await renderCatsTab();

  subscribe(['bets', 'positions', 'profiles', 'categories'], () => {
    if (tab === 'bets') renderBetsTab();
    if (tab === 'users') renderUsersTab();
    if (tab === 'cats') renderCatsTab();
  });
}

/* ---------- BETS ---------- */
async function renderBetsTab() {
  const body = document.getElementById('adminBody');
  if (!body) return;
  const { data, error } = await sb.from('bets_with_stats')
    .select('*, category:categories(name)')
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) { body.innerHTML = `<div class="error-box">${escapeHTML(error.message)}</div>`; return; }

  body.innerHTML = `
    <div class="section">
      <h2>Gestione scommesse (${data.length})</h2>
      ${data.map(rowHTML).join('') || '<div class="empty">Nessuna</div>'}
    </div>
  `;

  body.querySelectorAll('[data-action]').forEach(btn => {
    btn.onclick = () => handleAction(btn.dataset.action, Number(btn.dataset.id));
  });

  function rowHTML(b) {
    const closed = new Date(b.deadline) < new Date();
    const yes = Number(b.yes_pool)||0, no = Number(b.no_pool)||0;
    const yPct = pct(yes, no);
    const st = statusInfo(b, closed);
    const canAct = b.status === 'open' || b.status === 'closed';
    return `
      <div class="admin-row" data-status="${st.key}" style="flex-wrap:wrap">
        <div class="grow">
          <div class="name">
            <a href="#/bet/${b.id}">${escapeHTML(b.title)}</a>
          </div>
          <div class="meta">
            ${escapeHTML(b.category?.name || '—')} · SI ${yPct}% / NO ${100-yPct}%
            · ${fmt(yes+no)}cr
            · <span class="bet-status status-${st.key}" style="font-size:10px;padding:2px 6px">${st.label}</span>
          </div>
        </div>
        <div class="actions">
          ${b.status === 'open' ? `<button class="btn-secondary btn-sm" data-action="close" data-id="${b.id}">Chiudi</button>` : ''}
          ${canAct ? `
            <button class="btn-yes btn-sm" data-action="resolve-yes" data-id="${b.id}">SI</button>
            <button class="btn-no btn-sm" data-action="resolve-no" data-id="${b.id}">NO</button>
            <button class="btn-secondary btn-sm" data-action="cancel" data-id="${b.id}">Annulla</button>
          ` : ''}
          <button class="btn-secondary btn-sm" data-action="delete" data-id="${b.id}" style="color:var(--no);border-color:#fecaca">Elimina</button>
        </div>
      </div>
    `;
  }
}

async function handleAction(action, id) {
  if (action === 'close') {
    if (!confirm('Chiudere le puntate? Non sarà più possibile puntare.')) return;
    const { error } = await sb.rpc('close_bet', { p_bet_id: id });
    if (error) return toast(error.message, 'error');
    toast('Scommessa chiusa', 'success');
  }
  if (action === 'cancel') {
    if (!confirm('Annullare la scommessa? Tutti saranno rimborsati con +2%.')) return;
    const { error } = await sb.rpc('cancel_bet', { p_bet_id: id });
    if (error) return toast(error.message, 'error');
    toast('Scommessa annullata', 'success');
  }
  if (action === 'resolve-yes' || action === 'resolve-no') {
    const outcome = action === 'resolve-yes' ? 'yes' : 'no';
    if (!confirm(`Risolvere come ${outcome.toUpperCase()}? Il pool verrà distribuito.`)) return;
    const { error } = await sb.rpc('resolve_bet', { p_bet_id: id, p_outcome: outcome });
    if (error) return toast(error.message, 'error');
    toast('Scommessa risolta', 'success');
  }
  if (action === 'delete') {
    // Recupera stato per il messaggio di conferma
    const { data: b } = await sb.from('bets').select('status, title').eq('id', id).maybeSingle();
    if (!b) return toast('Scommessa non trovata', 'error');
    let msg = `Eliminare definitivamente "${b.title}"?\n\n`;
    if (b.status === 'open' || b.status === 'closed') {
      msg += 'Tutte le puntate verranno RIMBORSATE al 100% e la scommessa eliminata. Operazione irreversibile.';
    } else {
      msg += 'La scommessa e tutti i suoi commenti/puntate verranno rimossi. I saldi NON verranno modificati (risoluzione/rimborso già avvenuti). Operazione irreversibile.';
    }
    if (!confirm(msg)) return;
    const { error } = await sb.rpc('admin_delete_bet', { p_bet_id: id });
    if (error) return toast(error.message, 'error');
    toast('Scommessa eliminata', 'success');
  }
}

/* ---------- USERS ---------- */
async function renderUsersTab() {
  const body = document.getElementById('adminBody');
  if (!body) return;
  const { data, error } = await sb.from('profiles').select('*').order('created_at', { ascending: true });
  if (error) { body.innerHTML = `<div class="error-box">${escapeHTML(error.message)}</div>`; return; }

  body.innerHTML = `
    <div class="section">
      <h2>Utenti (${data.length})</h2>
      ${data.map(rowHTML).join('')}
    </div>
  `;

  body.querySelectorAll('[data-edit-bal]').forEach(btn => {
    btn.onclick = () => openBalanceModal(btn.dataset.id, btn.dataset.username, Number(btn.dataset.balance));
  });
  body.querySelectorAll('[data-toggle-admin]').forEach(btn => {
    btn.onclick = async () => {
      const value = btn.dataset.value === 'true';
      if (!confirm(value ? 'Rendere admin questo utente?' : 'Rimuovere i privilegi admin?')) return;
      const { error } = await sb.rpc('admin_toggle_admin', { p_user_id: btn.dataset.id, p_value: value });
      if (error) return toast(error.message, 'error');
      toast('Aggiornato', 'success');
    };
  });

  function rowHTML(u) {
    const isMe = state.profile?.id === u.id;
    return `
      <div class="admin-row">
        <div class="grow">
          <div class="name">
            <a href="#/u/${encodeURIComponent(u.username)}">${escapeHTML(u.username)}</a>
            ${u.is_admin ? ' <span style="color:var(--accent);font-size:11px;font-weight:700">ADMIN</span>' : ''}
          </div>
          <div class="meta">${fmt(u.balance)}cr · iscritto ${fullDate(u.created_at)}</div>
        </div>
        <div class="actions">
          <button class="btn-secondary btn-sm" data-edit-bal data-id="${u.id}" data-username="${escapeHTML(u.username)}" data-balance="${u.balance}">Crediti</button>
          ${!isMe ? `<button class="btn-secondary btn-sm" data-toggle-admin data-id="${u.id}" data-value="${!u.is_admin}">
            ${u.is_admin ? '−admin' : '+admin'}
          </button>` : ''}
        </div>
      </div>
    `;
  }

  function openBalanceModal(id, username, balance) {
    openModal({
      title: `Crediti di ${username}`,
      bodyHTML: `
        <form id="balForm">
          <div class="field">
            <label>Nuovo saldo</label>
            <input type="number" name="balance" step="1" min="0" value="${Math.round(balance)}" required>
          </div>
          <div style="display:flex;gap:6px;margin-bottom:12px">
            <button type="button" class="chip" data-add="500">+500</button>
            <button type="button" class="chip" data-add="1000">+1000</button>
            <button type="button" class="chip" data-add="-500">−500</button>
          </div>
          <button type="submit" class="btn-primary" style="width:100%">Salva</button>
        </form>
      `,
      onMount: (root, close) => {
        const form = root.querySelector('#balForm');
        root.querySelectorAll('[data-add]').forEach(b => {
          b.onclick = () => form.balance.value = Math.max(0, Math.round(Number(form.balance.value)) + Number(b.dataset.add));
        });
        form.onsubmit = async (e) => {
          e.preventDefault();
          const v = Math.round(Number(form.balance.value));
          const { error } = await sb.rpc('admin_set_balance', { p_user_id: id, p_balance: v });
          if (error) return toast(error.message, 'error');
          toast('Saldo aggiornato', 'success');
          close();
        };
      }
    });
  }
}

/* ---------- CATEGORIES ---------- */
async function renderCatsTab() {
  const body = document.getElementById('adminBody');
  if (!body) return;
  const { data, error } = await sb.from('categories').select('*').order('sort_order');
  if (error) { body.innerHTML = `<div class="error-box">${escapeHTML(error.message)}</div>`; return; }

  // Conta scommesse per categoria (per il confirm di eliminazione)
  const { data: counts } = await sb.from('bets').select('category_id');
  const countMap = {};
  (counts || []).forEach(b => { countMap[b.category_id] = (countMap[b.category_id] || 0) + 1; });

  body.innerHTML = `
    <div class="section">
      <h2>Categorie (${data.length})</h2>
      ${data.map(rowHTML).join('')}
      <form id="newCatForm" style="margin-top:14px;display:flex;gap:6px">
        <input type="text" name="name" placeholder="Nuova categoria" required maxlength="40" class="search-input" style="flex:1">
        <button type="submit" class="btn-primary btn-sm">Aggiungi</button>
      </form>
    </div>
  `;

  body.querySelectorAll('[data-rename-cat]').forEach(btn => {
    btn.onclick = () => openRenameModal(btn.dataset.renameCat, btn.dataset.name);
  });
  body.querySelectorAll('[data-del-cat]').forEach(btn => {
    btn.onclick = async () => {
      const id = Number(btn.dataset.delCat);
      const n = countMap[id] || 0;
      const warn = n > 0
        ? `Questa categoria è usata da ${n} scommess${n === 1 ? 'a' : 'e'}. Diventeranno "Senza categoria". Continuare?`
        : 'Eliminare la categoria?';
      if (!confirm(warn)) return;
      const { error } = await sb.from('categories').delete().eq('id', id);
      if (error) return toast(error.message, 'error');
      toast('Eliminata', 'success');
    };
  });

  body.querySelector('#newCatForm').onsubmit = async (e) => {
    e.preventDefault();
    const name = e.target.name.value.trim();
    if (!name) return;
    const slug = name.toLowerCase().replace(/\s+/g,'-').replace(/[^a-z0-9-]/g,'');
    const maxOrder = data.reduce((m,c) => Math.max(m, c.sort_order), 0);
    const { error } = await sb.from('categories').insert({ name, slug, sort_order: maxOrder + 1 });
    if (error) return toast(error.message, 'error');
    toast('Creata', 'success');
    e.target.reset();
  };

  function rowHTML(c) {
    const n = countMap[c.id] || 0;
    return `
      <div class="admin-row">
        <div class="grow">
          <div class="name">${escapeHTML(c.name)}</div>
          <div class="meta">slug: ${escapeHTML(c.slug)} · ${n} scommess${n === 1 ? 'a' : 'e'}</div>
        </div>
        <div class="actions">
          <button class="btn-secondary btn-sm" data-rename-cat="${c.id}" data-name="${escapeHTML(c.name)}">Rinomina</button>
          <button class="btn-secondary btn-sm" data-del-cat="${c.id}" style="color:var(--no);border-color:#fecaca">Elimina</button>
        </div>
      </div>
    `;
  }

  function openRenameModal(id, currentName) {
    openModal({
      title: 'Rinomina categoria',
      bodyHTML: `
        <form id="renameForm">
          <div class="field">
            <label>Nuovo nome</label>
            <input type="text" name="name" required maxlength="40" value="${escapeHTML(currentName)}">
          </div>
          <p style="font-size:12px;color:var(--text-muted);margin:0 0 12px">
            Lo slug verrà rigenerato automaticamente dal nome.
          </p>
          <button type="submit" class="btn-primary" style="width:100%">Salva</button>
        </form>
      `,
      onMount: (root, close) => {
        const form = root.querySelector('#renameForm');
        form.onsubmit = async (e) => {
          e.preventDefault();
          const name = form.name.value.trim();
          if (!name) return;
          const { error } = await sb.rpc('admin_rename_category', { p_id: id, p_name: name });
          if (error) return toast(error.message, 'error');
          toast('Categoria rinominata', 'success');
          close();
        };
      }
    });
  }
}
