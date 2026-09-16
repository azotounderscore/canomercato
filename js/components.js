import { state } from './state.js';
import { navigate, currentPath } from './router.js';
import { signOut } from './supabase.js';
import { escapeHTML } from './utils.js';

/* ================= NAV ================= */
export function renderNav() {
  const top = document.getElementById('topbar');
  const bottom = document.getElementById('bottomnav');
  const p = state.profile;

  top.innerHTML = `
    <a href="#/" class="brand">BetFriends</a>
    <input id="topSearch" class="search-input" type="search" placeholder="Cerca…" value="">
    <div class="top-right">
      ${p
        ? `<a href="#/u/${encodeURIComponent(p.username)}" class="avatar" title="${escapeHTML(p.username)}">${escapeHTML(p.username[0].toUpperCase())}</a>
           ${p.is_admin ? `<a href="#/admin" class="icon-btn" title="Admin">⚙</a>` : ''}
           <button id="btnLogout" class="icon-btn" title="Esci">⎋</button>`
        : `<a href="#/login" class="btn-login">Accedi</a>`}
    </div>
  `;

  const searchInput = top.querySelector('#topSearch');
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const q = e.target.value.trim();
      if (q) navigate('/search?q=' + encodeURIComponent(q));
    }
  });

  const logoutBtn = top.querySelector('#btnLogout');
  if (logoutBtn) logoutBtn.addEventListener('click', async () => {
    await signOut();
    navigate('/');
  });

  bottom.innerHTML = `
    <a href="#/" data-route="/">${iconHome()}<span>Home</span></a>
    <a href="#/new" data-route="/new">${iconPlus()}<span>Nuova</span></a>
    <a href="#/search" data-route="/search">${iconSearch()}<span>Cerca</span></a>
    <a href="${p ? '#/u/' + encodeURIComponent(p.username) : '#/login'}" data-route="/u">${iconUser()}<span>Profilo</span></a>
  `;
  highlightBottom();
  window.addEventListener('hashchange', highlightBottom);
}

function highlightBottom() {
  const path = currentPath();
  document.querySelectorAll('#bottomnav a').forEach(a => {
    const r = a.dataset.route;
    const active = r === '/' ? path === '/' : path.startsWith(r);
    a.classList.toggle('active', active);
  });
}

/* ================= TOAST ================= */
export function toast(msg, type = 'info') {
  const root = document.getElementById('toast-root');
  const el = document.createElement('div');
  el.className = 'toast toast-' + type;
  el.textContent = msg;
  root.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => el.remove(), 200);
  }, 2800);
}

/* ================= MODAL ================= */
export function openModal({ title, bodyHTML, onMount }) {
  const root = document.getElementById('modal-root');
  root.innerHTML = `
    <div class="modal-backdrop">
      <div class="modal">
        <div class="modal-head">
          <h3>${escapeHTML(title)}</h3>
          <button class="modal-close" type="button">×</button>
        </div>
        <div class="modal-body">${bodyHTML}</div>
      </div>
    </div>
  `;
  const backdrop = root.querySelector('.modal-backdrop');
  const close = () => { root.innerHTML = ''; document.removeEventListener('keydown', onKey); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  root.querySelector('.modal-close').onclick = close;
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) close(); });
  if (onMount) onMount(root, close);
  return close;
}

/* ================= SVG ICONS ================= */
function iconHome() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9.5 12 3l9 6.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/></svg>`;
}
function iconPlus() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>`;
}
function iconSearch() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>`;
}
function iconUser() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/></svg>`;
}

/* ================= CHART ================= */
// Disegna un grafico SVG della probabilità SI nel tempo a partire dalle posizioni.
export function priceChartSVG(positions, width = 640, height = 140) {
  const sorted = [...positions].sort((a,b) => new Date(a.created_at) - new Date(b.created_at));
  if (!sorted.length) {
    return `<div class="empty" style="padding:20px 0">Nessun dato</div>`;
  }
  const pad = { l: 6, r: 6, t: 8, b: 8 };
  const w = width - pad.l - pad.r;
  const h = height - pad.t - pad.b;

  // Costruisci punti
  const t0 = new Date(sorted[0].created_at).getTime();
  const t1 = Math.max(Date.now(), new Date(sorted[sorted.length-1].created_at).getTime());
  const span = Math.max(1, t1 - t0);
  let y = 0, n = 0;
  const points = [{ x: 0, p: 0.5 }];
  for (const pos of sorted) {
    if (pos.side === 'yes') y += Number(pos.stake);
    else n += Number(pos.stake);
    const total = y + n;
    const p = total ? y / total : 0.5;
    const x = (new Date(pos.created_at).getTime() - t0) / span;
    points.push({ x, p });
  }
  points.push({ x: 1, p: points[points.length-1].p });

  const toXY = (pt) => [pad.l + pt.x * w, pad.t + (1 - pt.p) * h];
  const path = points.map((pt, i) => (i === 0 ? 'M' : 'L') + toXY(pt).map(v => v.toFixed(1)).join(',')).join(' ');

  // Linea 50%
  const midY = pad.t + 0.5 * h;

  return `
    <svg class="chart-wrap" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">
      <line x1="${pad.l}" y1="${midY}" x2="${width-pad.r}" y2="${midY}" stroke="#e5e7eb" stroke-dasharray="3 3"/>
      <path d="${path}" fill="none" stroke="#16a34a" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
    </svg>
  `;
}