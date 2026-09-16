import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

// NOTA: NON chiamare questa variabile `supabase`, altrimenti va in conflitto
// con la proprietà globale `window.supabase` esposta dalla SDK.
export const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    storageKey: 'betfriends-auth',
    detectSessionInUrl: false
  }
});

export async function getSession() {
  const { data } = await sb.auth.getSession();
  return data.session;
}

export async function getProfile(userId) {
  const { data } = await sb.from('profiles').select('*').eq('id', userId).maybeSingle();
  return data;
}

export async function signUp(username, password) {
  const email = username.toLowerCase() + '@betfriends.local';
  const { data, error } = await sb.auth.signUp({
    email, password,
    options: { data: { username } }
  });
  if (error) throw error;
  return data;
}

export async function signIn(username, password) {
  const email = username.toLowerCase() + '@betfriends.local';
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signOut() {
  await sb.auth.signOut();
}