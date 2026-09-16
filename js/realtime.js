import { sb } from './supabase.js';

let channels = [];
let debounceTimer = null;

export function subscribe(tables, callback) {
  unsubscribeAll();
  const trigger = () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(callback, 120);
  };
  for (const t of tables) {
    const ch = sb.channel('rt-' + t + '-' + Math.random().toString(36).slice(2))
      .on('postgres_changes', { event: '*', schema: 'public', table: t }, trigger)
      .subscribe();
    channels.push(ch);
  }
}

export function unsubscribeAll() {
  clearTimeout(debounceTimer);
  for (const ch of channels) sb.removeChannel(ch);
  channels = [];
}