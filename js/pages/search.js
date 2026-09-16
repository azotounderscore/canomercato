import { sb } from '../supabase.js';
import { navigate } from '../router.js';
import { escapeHTML, fmt, pct, deadlineLabel, timeAgo } from '../utils.js';

export async function renderSearch(initialQ) {
  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="page-header">
      <h1>Cerca</h1>
    </div>
    <div class="section">
      <input id="searchInput" class="search-input" type="search" placeholder="Scommesse, utenti, commenti…" value="${escapeHTML(initialQ || '')}">
    </div>
    <div id="searchResults"></div>
  `;

  const input = document.getElementById('searchInput');
  let timer = null;
  async function run(q) {
    q = (q || '').trim();
    if (q.length < 2) {
      document.getElementById('searchResults').innerHTML = '<div class="empty">Digita almeno 2 caratteri</div>';
      return;
    }
    const results = document.getElementById('searchResults');
    results.innerHTML = '<div class="loading">Ricerca…</div>';

    const [bets, users, comments] = await Promise.all([
      sb.from('bets_with_stats').select('*, category:categories(name)').ilike('title', `%${q}%`).limit(20),
      sb.from('profiles').select('*').ilike('username', `%${q}%`).limit(20),
      sb.from('comments').select('*, user:profiles(username), bet:bets(id, title)').ilike('body', `%${q}%`).limit(20)
    ]);

    const parts = [];

    if (bets.data?.length) {
      parts.push(`
        <div class="section">
          <h2>Scommesse</h2>
          <div class="bets-list">
            ${bets.data.map(betResult).join('')}
          </div>
        </div>
      `);
    }
    if (users.data?.length) {
      parts.push(`
        <div class="section">
          <h2>Utenti</h2>
          <div class="pos-list">
            ${users.data.map(u => `
              <div class="pos-item" data-user="${encodeURIComponent(u.username)}" style="cursor:pointer">
                <span class="avatar" style="width:26px;height:26px;font-size:11px">${escapeHTML(u.username[0].toUpperCase())}</span>
                <span class="username">${escapeHTML(u.username)}</span>
                <span class="stake" style="color:var(--text-muted);font-weight:500">${fmt(u.balance)}cr</span>
              </div>
            `).join('')}
          </div>
        </div>
      `);
    }
    if (comments.data?.length) {
      parts.push(`
        <div class="section">
          <h2>Commenti</h2>
          ${comments.data.map(c => `
            <div class="comment" data-bet="${c.bet?.id}" style="cursor:pointer">
              <div class="comment-head">
                <span class="comment-user">${escapeHTML(c.user?.username || '?')}</span>
                <span class="comment-time">${timeAgo(c.created_at)}</span>
              </div>
              <div class="comment-body">${escapeHTML(c.body)}</div>
              <div style="font-size:11px;color:var(--text-dim);margin-top:2px">in “${escapeHTML(c.bet?.title || '—')}”</div>
            </div>
          `).join('')}
        </div>
      `);
    }

    results.innerHTML = parts.length ? parts.join('') : '<div class="empty">Nessun risultato</div>';

    results.querySelectorAll('[data-bet]').forEach(el => el.onclick = () => navigate('/bet/' + el.dataset.bet));
    results.querySelectorAll('[data-user]').forEach(el => el.onclick = () => navigate('/u/' + el.dataset.user));
    results.querySelectorAll('.bet-card').forEach(el => el.onclick = () => navigate('/bet/' + el.dataset.id));
  }

  function betResult(b) {
    const yes = Number(b.yes_pool) || 0;
    const no = Number(b.no_pool) || 0;
    const yPct = pct(yes, no);
    const nPct = 100 - yPct;
    const closed = new Date(b.deadline) < new Date();
    return `
      <div class="bet-card" data-id="${b.id}">
        <div class="bet-card-head">
          <span class="bet-cat">${escapeHTML(b.category?.name || '—')}</span>
        </div>
        <h3 class="bet-title" style="margin-bottom:8px">${escapeHTML(b.title)}</h3>
        <div class="pool-bar">
          <div class="pool-yes" style="width:${yPct}%"></div>
          <div class="pool-no" style="width:${nPct}%"></div>
        </div>
        <div class="pool-row">
          <span class="pool-yes-label">SI ${yPct}%</span>
          <span class="pool-no-label">NO ${nPct}%</span>
        </div>
      </div>
    `;
  }

  input.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(() => run(input.value), 250);
  });
  if (initialQ) run(initialQ);
}