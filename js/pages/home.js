import { sb } from '../supabase.js';
import { state } from '../state.js';
import { navigate } from '../router.js';
import { subscribe } from '../realtime.js';
import { escapeHTML, fmt, pct, deadlineLabel, statusInfo } from '../utils.js';

let currentCat = 'all';

export async function renderHome() {
  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="page-header">
      <h1>Mercati</h1>
      <a href="#/new" class="btn-primary btn-sm">+ Nuovo</a>
    </div>
    <div id="catBar" class="cat-bar"></div>
    <div id="betsList" class="bets-list"><div class="loading">Caricamento…</div></div>
  `;

  await loadCategories();
  renderCatBar();
  await loadBets();

  subscribe(['bets', 'positions'], () => loadBets());
}

async function loadCategories() {
  if (state.categories.length) return;
  const { data } = await sb.from('categories').select('*').order('sort_order');
  state.categories = data || [];
}

function renderCatBar() {
  const bar = document.getElementById('catBar');
  if (!bar) return;
  const cats = [{ id: 'all', name: 'Tutte' }, ...state.categories];
  bar.innerHTML = cats.map(c =>
    `<button type="button" class="chip ${String(currentCat) === String(c.id) ? 'active' : ''}" data-id="${c.id}">${escapeHTML(c.name)}</button>`
  ).join('');
  bar.querySelectorAll('.chip').forEach(chip => {
    chip.onclick = () => {
      currentCat = chip.dataset.id;
      renderCatBar();
      loadBets();
    };
  });
}

async function loadBets() {
  const list = document.getElementById('betsList');
  if (!list) return;
  let q = sb.from('bets_with_stats').select('*, category:categories(name)').order('created_at', { ascending: false }).limit(100);
  if (currentCat !== 'all') q = q.eq('category_id', currentCat);
  const { data, error } = await q;
  if (error) { list.innerHTML = `<div class="error-box">${escapeHTML(error.message)}</div>`; return; }
  if (!data?.length) { list.innerHTML = '<div class="empty">Nessuna scommessa. Creane una!</div>'; return; }
  list.innerHTML = data.map(betCard).join('');
  list.querySelectorAll('.bet-card').forEach(el => {
    el.onclick = () => navigate('/bet/' + el.dataset.id);
  });
}

function betCard(b) {
  const yes = Number(b.yes_pool) || 0;
  const no = Number(b.no_pool) || 0;
  const yPct = pct(yes, no);
  const nPct = 100 - yPct;
  const closed = new Date(b.deadline) < new Date();
  const st = statusInfo(b, closed);
  return `
    <div class="bet-card" data-id="${b.id}" data-status="${st.key}">
      <div class="bet-card-head">
        <span class="bet-cat">${escapeHTML(b.category?.name || 'Senza categoria')}</span>
        <span class="bet-status status-${st.key}">${st.label}</span>
      </div>
      <h3 class="bet-title">${escapeHTML(b.title)}</h3>
      <div class="pool-bar">
        <div class="pool-yes" style="width:${yPct}%"></div>
        <div class="pool-no" style="width:${nPct}%"></div>
      </div>
      <div class="pool-row">
        <span class="pool-yes-label">SI ${yPct}% · ${fmt(yes)}cr</span>
        <span class="pool-no-label">NO ${nPct}% · ${fmt(no)}cr</span>
      </div>
      <div class="bet-card-foot">
        <span>${b.bettors} ${b.bettors === 1 ? 'giocatore' : 'giocatori'}</span>
        <span>${closed ? 'Chiusa' : deadlineLabel(b.deadline)}</span>
      </div>
    </div>
  `;
}
