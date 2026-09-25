import { createClient } from '@supabase/supabase-js';

// Cleans up common copy-paste mistakes: spaces, quotes, missing https://, a trailing /rest/v1/.
function cleanUrl(raw) {
  let v = String(raw || '').trim().replace(/^['"]|['"]$/g, '').trim();
  if (!v) return '';
  if (!/^https?:\/\//i.test(v)) v = 'https://' + v;
  v = v.replace(/\/rest\/v1\/?$/i, '').replace(/\/+$/, '');
  try {
    const u = new URL(v);
    return u.protocol === 'https:' || u.hostname === 'localhost' || u.hostname === '127.0.0.1' ? u.origin : '';
  } catch {
    return '';
  }
}
const cleanKey = (raw) => String(raw || '').trim().replace(/^['"]|['"]$/g, '').trim();

const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const url = cleanUrl(rawUrl);
const key = cleanKey(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

// What's wrong with the setup, in plain words ('' when everything is fine).
export const supabaseProblem = !rawUrl
  ? 'Falta la variable NEXT_PUBLIC_SUPABASE_URL.'
  : !url
    ? 'NEXT_PUBLIC_SUPABASE_URL no es una dirección válida. Debe verse así: https://abcdefgh.supabase.co'
    : !key
      ? 'Falta la variable NEXT_PUBLIC_SUPABASE_ANON_KEY.'
      : key.split('.').length !== 3 && !key.startsWith('sb_publishable_')
        ? 'NEXT_PUBLIC_SUPABASE_ANON_KEY no parece la llave "anon public" de Supabase.'
        : '';

export const supabaseConfigured = !supabaseProblem;

// Browser client. The anon key is public by design; row level security protects the data.
export const supabase = supabaseConfigured
  ? createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, storageKey: 'rutinas-gym-auth' } })
  : null;
