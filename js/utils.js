export function escapeHTML(s) {
  if (s == null) return '';
  return String(s).replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}

export function fmt(n) {
  const v = Number(n) || 0;
  return v.toLocaleString('it-IT', { maximumFractionDigits: 0 });
}

export function fmtDec(n) {
  const v = Number(n) || 0;
  return v.toLocaleString('it-IT', { maximumFractionDigits: 2 });
}

export function pct(a, b) {
  const total = (Number(a) || 0) + (Number(b) || 0);
  if (!total) return 50;
  return Math.round((Number(a) / total) * 100);
}

export function deadlineLabel(deadline) {
  const d = new Date(deadline);
  const now = new Date();
  const diffMs = d - now;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMs < 0) return 'Chiusa';
  if (diffMin < 60) return `Tra ${diffMin}m`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `Tra ${diffH}h`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) return `Tra ${diffD}g`;
  return d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
}

export function fullDate(d) {
  return new Date(d).toLocaleString('it-IT', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

export function timeAgo(d) {
  const t = new Date(d).getTime();
  const diff = Math.floor((Date.now() - t) / 1000);
  if (diff < 60) return 'adesso';
  if (diff < 3600) return Math.floor(diff/60) + 'm fa';
  if (diff < 86400) return Math.floor(diff/3600) + 'h fa';
  if (diff < 604800) return Math.floor(diff/86400) + 'g fa';
  return new Date(d).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
}

export function statusLabel(bet, closed) {
  if (bet.status === 'resolved') {
    return bet.outcome === 'yes'
      ? { key: 'resolved-yes', label: 'RISOLTA · SI' }
      : { key: 'resolved-no',  label: 'RISOLTA · NO' };
  }
  if (bet.status === 'cancelled') return { key: 'cancelled', label: 'ANNULLATA' };
  if (bet.status === 'closed')    return { key: 'closed',    label: 'CHIUSA' };
  if (closed)                     return { key: 'expired',   label: 'SCADUTA' };
  return                                 { key: 'open',      label: 'APERTA' };
}
export function statusInfo(bet, closed) {
  return statusInfo(bet, closed).label;
}


export function toLocalInputValue(date) {
  const d = new Date(date);
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
