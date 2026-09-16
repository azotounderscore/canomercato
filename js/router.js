const routes = [];
let onNav = null;

export function route(path, handler) { routes.push({ path, handler }); }
export function navigate(hash) { location.hash = hash; }
export function setOnNav(fn) { onNav = fn; }

export function start() {
  window.addEventListener('hashchange', resolve);
  resolve();
}

function parseHash() {
  const raw = location.hash.replace(/^#/, '') || '/';
  const [path, query] = raw.split('?');
  const params = Object.fromEntries(new URLSearchParams(query || ''));
  return { path, query: params };
}

function match(pattern, path) {
  const pp = pattern.split('/').filter(Boolean);
  const pa = path.split('/').filter(Boolean);
  if (pp.length !== pa.length) return null;
  const params = {};
  for (let i = 0; i < pp.length; i++) {
    if (pp[i].startsWith(':')) params[pp[i].slice(1)] = decodeURIComponent(pa[i]);
    else if (pp[i] !== pa[i]) return null;
  }
  return params;
}

async function resolve() {
  const { path, query } = parseHash();
  const app = document.getElementById('app');
  if (onNav) onNav();
  for (const r of routes) {
    const m = match(r.path, path);
    if (m) {
      app.innerHTML = '';
      try { await r.handler({ ...m, ...query }); }
      catch (e) {
        console.error(e);
        app.innerHTML = '<div class="error-box">Errore: ' + (e.message || e) + '</div>';
      }
      return;
    }
  }
  app.innerHTML = '<div class="empty">Pagina non trovata</div>';
}

export function currentPath() {
  return parseHash().path;
}