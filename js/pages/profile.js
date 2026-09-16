import { sb } from '../supabase.js';
import { state } from '../state.js';
import { subscribe } from '../realtime.js';
import { escapeHTML, fmt, pct, fullDate, deadlineLabel, statusLabel } from '../utils.js';

export async function renderProfile(username) {
  const app = document.getElementById('app');
  app.innerHTML = '<div class="loading">Caricamento…</div>';

  let profile, positions = [], createdBets = [];

  async function load() {
    const p = await sb.from('profiles').select('*').eq('username', username).maybeSingle();
    if (p.error || !p.data) { app.innerHTML = '<div class="error-box">Utente non trovato.</div>'; return; }
    profile = p.data;

    const [pos, cb] = await Promise.all([
      sb.from('positions')
        .select('*, bet:bets(id, title, status, outcome, deadline, category_id)')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(200),
      sb.from('bets')
        .select('id, title, status, deadline, category:categories(name)')
        .eq('creator_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(50)
    ]);
    positions = pos.data || [];
    createdBets = cb.data || [];
    render();
  }

  function render() {
    const me = state.profile;
    const isMe = me?.id === profile.id;
    const totalWagered = positions.reduce((s,p) => s + Number(p.stake), 0);
    const resolved = positions.filter(p => p.bet?.status === 'resolved');
    const won = resolved.filter(p => p.bet.outcome === p.side);
    const winRate = resolved.length ? Math.round(won.length / resolved.length * 100) : 0;
    const totalWonStake = won.reduce((s,p) => s + Number(p.stake), 0);

    app.innerHTML = `
      <div class="profile-head">
        <div class="avatar-lg">${escapeHTML(profile.username[0].toUpperCase())}</div>
        <div>
          <h1 style="margin:0;font-size:20px">${escapeHTML(profile.username)}</h1>
          <div style="color:var(--text-muted);font-size:12px">
            Iscritto ${fullDate(profile.created_at)}
            ${profile.is_admin ? ' · <b style="color:var(--accent)">ADMIN</b>' : ''}
          </div>
        </div>
      </div>

      <div class="stats-grid">
        <div class="stat">
          <div class="v">${fmt(profile.balance)}</div>
          <div class="l">Crediti</div>
        </div>
        <div class="stat win">
          <div class="v">${winRate}%</div>
          <div class="l">Win rate</div>
        </div>
        <div class="stat">
          <div class="v">${positions.length}</div>
          <div class="l">Puntate</div>
        </div>
      </div>

      <div class="section">
        <h2>Statistiche</h2>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:13px">
          <div>Totale puntato: <b>${fmt(totalWagered)}cr</b></div>
          <div>Vinte: <b style="color:var(--yes)">${won.length}</b></div>
          <div>Risolte: <b>${resolved.length}</b></div>
          <div>Puntato su vincenti: <b>${fmt(totalWonStake)}cr</b></div>
        </div>
      </div>

      <div class="section">
        <h2>Puntate recenti</h2>
        ${positions.length ? `<div class="pos-list">${positions.slice(0,20).map(posRow).join('')}</div>` : '<div class="empty" style="padding:14px 0">Nessuna puntata</div>'}
      </div>

      <div class="section">
        <h2>Scommesse create (${createdBets.length})</h2>
        ${createdBets.length ? `<div class="pos-list">${createdBets.map(betRow).join('')}</div>` : '<div class="empty" style="padding:14px 0">Nessuna scommessa creata</div>'}
      </div>
    `;

    app.querySelectorAll('[data-bet]').forEach(el => {
      el.onclick = () => location.hash = '/bet/' + el.dataset.bet;
    });
  }

  function posRow(p) {
    const won = p.bet?.status === 'resolved' && p.bet.outcome === p.side;
    const lost = p.bet?.status === 'resolved' && p.bet.outcome !== p.side;
    const color = won ? 'var(--yes)' : lost ? 'var(--no)' : 'var(--text-muted)';
    const label = won ? '✓' : lost ? '✗' : '·';
    return `
      <div class="pos-item" data-bet="${p.bet?.id}" style="cursor:pointer">
        <span class="side-tag ${p.side}">${p.side === 'yes' ? 'SI' : 'NO'}</span>
        <div class="username" style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
          ${escapeHTML(p.bet?.title || '(eliminata)')}
        </div>
        <span class="stake" style="color:${color}">${label} ${fmt(p.stake)}cr</span>
      </div>
    `;
  }

  function betRow(b) {
    const closed = new Date(b.deadline) < new Date();
    return `
      <div class="pos-item" data-bet="${b.id}" style="cursor:pointer">
        <span class="side-tag" style="background:var(--accent-bg);color:var(--accent);width:auto;padding:3px 8px">${escapeHTML(b.category?.name || '—')}</span>
        <div class="username" style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
          ${escapeHTML(b.title)}
        </div>
        <span class="stake" style="font-weight:500;color:var(--text-muted);font-size:11px">${statusLabel(b, closed)}</span>
      </div>
    `;
  }

  await load();
  subscribe(['positions', 'bets'], () => load());
}