import { sb } from '../supabase.js';
import { state } from '../state.js';
import { navigate } from '../router.js';
import { subscribe } from '../realtime.js';
import { toast, openModal, priceChartSVG } from '../components.js';
import { escapeHTML, fmt, pct, deadlineLabel, fullDate, timeAgo, statusInfo } from '../utils.js';

export async function renderBet(id) {
  const app = document.getElementById('app');
  app.innerHTML = '<div class="loading">Caricamento…</div>';

  let bet, positions = [], comments = [];

  async function load() {
    const [b, p, c] = await Promise.all([
      sb.from('bets_with_stats')
        .select('*, category:categories(name), creator:profiles(username)')
        .eq('id', id).maybeSingle(),
      sb.from('positions')
        .select('*, user:profiles(username)')
        .eq('bet_id', id)
        .order('created_at', { ascending: false }),
      sb.from('comments')
        .select('*, user:profiles(username)')
        .eq('bet_id', id)
        .order('created_at', { ascending: true })
    ]);
    if (b.error || !b.data) {
      app.innerHTML = '<div class="error-box">Scommessa non trovata.</div>';
      return;
    }
    bet = b.data;
    positions = p.data || [];
    comments = c.data || [];
    render();
  }

  function render() {
    const yes = Number(bet.yes_pool) || 0;
    const no = Number(bet.no_pool) || 0;
    const yPct = pct(yes, no);
    const nPct = 100 - yPct;
    const closed = new Date(bet.deadline) < new Date();
    const isOpen = bet.status === 'open' && !closed;
    const me = state.profile;
    const myYes = positions.filter(p => p.user_id === me?.id && p.side === 'yes').reduce((s,p)=>s+Number(p.stake),0);
    const myNo  = positions.filter(p => p.user_id === me?.id && p.side === 'no').reduce((s,p)=>s+Number(p.stake),0);
    const iBetYes = myYes > 0;
    const iBetNo  = myNo > 0;
    const st = statusInfo(bet, closed);

    app.innerHTML = `
      <div class="bet-detail">
        <div class="bet-card-head">
          <span class="bet-cat">${escapeHTML(bet.category?.name || 'Senza categoria')}</span>
          <span class="bet-status status-${st.key}">${st.label}</span>
        </div>
        <h1>${escapeHTML(bet.title)}</h1>
        ${bet.description ? `<div class="bet-desc">${escapeHTML(bet.description)}</div>` : ''}
        <div class="bet-card-foot" style="margin-bottom:6px">
          <span>di ${escapeHTML(bet.creator?.username || '?')}</span>
          <span>${closed ? 'Scaduta il' : 'Scade'} ${fullDate(bet.deadline)}</span>
        </div>

        <div class="outcome-grid">
          <button class="outcome-btn yes" id="btnYes" ${(!isOpen || iBetNo || !me) ? 'disabled' : ''}>
            <div class="outcome-label">SI</div>
            <div class="outcome-pct">${yPct}%</div>
            <div class="outcome-pool">${fmt(yes)}cr · ${iBetYes ? 'tu: ' + fmt(myYes) + 'cr' : (iBetNo ? 'hai puntato NO' : 'paga ' + (yPct ? (100/yPct).toFixed(2) : '—') + '×')}</div>
          </button>
          <button class="outcome-btn no" id="btnNo" ${(!isOpen || iBetYes || !me) ? 'disabled' : ''}>
            <div class="outcome-label">NO</div>
            <div class="outcome-pct">${nPct}%</div>
            <div class="outcome-pool">${fmt(no)}cr · ${iBetNo ? 'tu: ' + fmt(myNo) + 'cr' : (iBetYes ? 'hai puntato SI' : 'paga ' + (nPct ? (100/nPct).toFixed(2) : '—') + '×')}</div>
          </button>
        </div>

        ${!me ? `<div class="empty" style="padding:6px 0 2px"><a href="#/login" style="color:var(--accent);font-weight:600">Accedi per puntare</a></div>` : ''}
        ${me && !isOpen ? `<div class="empty" style="padding:6px 0 2px">Puntate chiuse.</div>` : ''}
      </div>

      <div class="section">
        <h2>Andamento SI</h2>
        ${priceChartSVG(positions)}
      </div>

      <div class="section">
        <h2>Puntate (${positions.length})</h2>
        ${positions.length ? `<div class="pos-list">${positions.map(posItem).join('')}</div>` : '<div class="empty" style="padding:14px 0">Nessuna puntata</div>'}
      </div>

      ${(me?.is_admin && (bet.status === 'open' || bet.status === 'closed')) ? adminPanelHTML(bet) : ''}

      <div class="section">
        <h2>Commenti (${comments.length})</h2>
        <div id="commentsList">
          ${comments.length ? comments.map(commentItem).join('') : '<div class="empty" style="padding:14px 0">Ancora nessun commento</div>'}
        </div>
        ${me ? `
          <form class="comment-form" id="commentForm">
            <textarea name="body" maxlength="500" placeholder="Scrivi un commento…" rows="1"></textarea>
            <button type="submit" class="btn-primary btn-sm">Invia</button>
          </form>
        ` : `<div class="empty" style="padding:14px 0"><a href="#/login" style="color:var(--accent);font-weight:600">Accedi per commentare</a></div>`}
      </div>
    `;

    wireEvents();
  }

  function wireEvents() {
    const btnYes = document.getElementById('btnYes');
    const btnNo  = document.getElementById('btnNo');
    if (btnYes && !btnYes.disabled) btnYes.onclick = () => openBetModal('yes');
    if (btnNo && !btnNo.disabled) btnNo.onclick = () => openBetModal('no');

    const cf = document.getElementById('commentForm');
    if (cf) cf.onsubmit = async (e) => {
      e.preventDefault();
      const body = e.target.body.value.trim();
      if (!body) return;
      const btn = e.target.querySelector('button');
      btn.disabled = true;
      const { error } = await sb.from('comments').insert({ bet_id: bet.id, user_id: state.profile.id, body });
      btn.disabled = false;
      if (error) { toast(error.message, 'error'); return; }
      e.target.body.value = '';
    };

    // Auto-grow textarea
    const ta = cf?.querySelector('textarea');
    if (ta) ta.addEventListener('input', () => {
      ta.style.height = 'auto';
      ta.style.height = Math.min(120, ta.scrollHeight) + 'px';
    });

    // Admin
    document.querySelectorAll('[data-admin]').forEach(el => {
      el.onclick = () => adminAction(el.dataset.admin);
    });
  }

  function openBetModal(side) {
    const sideLabel = side === 'yes' ? 'SI' : 'NO';
    const otherLabel = side === 'yes' ? 'NO' : 'SI';
    const bal = Number(state.profile.balance) || 0;
    openModal({
      title: `Punta su ${sideLabel}`,
      bodyHTML: `
        <form id="betForm">
          <div class="field">
            <label>Importo (crediti · saldo: ${fmt(bal)})</label>
            <input type="number" name="stake" min="1" step="1" value="100" required>
          </div>
          <div style="display:flex;gap:6px;margin-bottom:12px">
            ${[50,100,250,500].map(v => `<button type="button" class="chip" data-quick="${v}">${v}</button>`).join('')}
            <button type="button" class="chip" data-quick="all">Tutto</button>
          </div>
          <p style="font-size:12px;color:var(--text-muted);margin:0 0 12px">
            Ricordati: potrai puntare solo su <b>${sideLabel}</b> per questa scommessa (non su ${otherLabel}).
          </p>
          <button type="submit" class="btn-primary" style="width:100%">Conferma</button>
          <p class="error" id="betErr"></p>
        </form>
      `,
      onMount: (root, close) => {
        const form = root.querySelector('#betForm');
        const input = form.stake;
        root.querySelectorAll('[data-quick]').forEach(b => {
          b.onclick = () => {
            if (b.dataset.quick === 'all') input.value = Math.floor(bal);
            else input.value = b.dataset.quick;
          };
        });
        form.onsubmit = async (e) => {
          e.preventDefault();
          const stake = parseInt(input.value, 10);
          const errEl = root.querySelector('#betErr');
          errEl.textContent = '';
          if (!stake || stake <= 0) { errEl.textContent = 'Importo non valido'; return; }
          if (stake > bal) { errEl.textContent = 'Saldo insufficiente'; return; }
          const submit = form.querySelector('button[type=submit]');
          submit.disabled = true;
          const { error } = await sb.rpc('place_bet', {
            p_bet_id: bet.id, p_side: side, p_stake: stake
          });
          submit.disabled = false;
          if (error) { errEl.textContent = error.message; return; }
          // aggiorna saldo locale
          state.profile.balance = bal - stake;
          toast('Puntata piazzata!', 'success');
          close();
        };
      }
    });
  }

  async function adminAction(action) {
    if (action === 'close') {
      if (!confirm('Chiudere le puntate? Non sarà più possibile puntare.')) return;
      const { error } = await sb.rpc('close_bet', { p_bet_id: bet.id });
      if (error) return toast(error.message, 'error');
      toast('Scommessa chiusa', 'success');
    }
    if (action === 'cancel') {
      if (!confirm('Annullare la scommessa? Tutti saranno rimborsati con +2%.')) return;
      const { error } = await sb.rpc('cancel_bet', { p_bet_id: bet.id });
      if (error) return toast(error.message, 'error');
      toast('Scommessa annullata', 'success');
    }
    if (action === 'resolve-yes' || action === 'resolve-no') {
      const outcome = action === 'resolve-yes' ? 'yes' : 'no';
      if (!confirm(`Risolvere come ${outcome.toUpperCase()}? Il pool verrà distribuito.`)) return;
      const { error } = await sb.rpc('resolve_bet', { p_bet_id: bet.id, p_outcome: outcome });
      if (error) return toast(error.message, 'error');
      toast('Scommessa risolta', 'success');
    }
  }

  function posItem(p) {
    return `
      <div class="pos-item">
        <span class="side-tag ${p.side}">${p.side === 'yes' ? 'SI' : 'NO'}</span>
        <a class="username" href="#/u/${encodeURIComponent(p.user?.username || '')}">${escapeHTML(p.user?.username || '?')}</a>
        <span class="stake">${fmt(p.stake)}cr</span>
      </div>
    `;
  }

  function commentItem(c) {
    return `
      <div class="comment">
        <div class="comment-head">
          <a class="comment-user" href="#/u/${encodeURIComponent(c.user?.username || '')}">${escapeHTML(c.user?.username || '?')}</a>
          <span class="comment-time">${timeAgo(c.created_at)}</span>
        </div>
        <div class="comment-body">${escapeHTML(c.body)}</div>
      </div>
    `;
  }

  function adminPanelHTML(bet) {
    const showResolve = bet.status === 'open' || bet.status === 'closed';
    return `
      <div class="section" style="border-color:#c7d2fe;background:#eef2ff">
        <h2>Pannello admin</h2>
        <div style="display:flex;flex-wrap:wrap;gap:6px">
          ${bet.status === 'open' ? `<button class="btn-secondary btn-sm" data-admin="close">Chiudi puntate</button>` : ''}
          ${showResolve ? `
            <button class="btn-yes btn-sm" data-admin="resolve-yes">Risolvi SI</button>
            <button class="btn-no btn-sm" data-admin="resolve-no">Risolvi NO</button>
          ` : ''}
          ${showResolve ? `<button class="btn-secondary btn-sm" data-admin="cancel">Annulla</button>` : ''}
        </div>
      </div>
    `;
  }

  await load();
  subscribe(['bets', 'positions', 'comments'], () => load());
}
