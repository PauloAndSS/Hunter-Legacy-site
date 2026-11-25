import { createClient } from '@supabase/supabase-js';
export const configured = Boolean(
  import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY,
);
export const db = configured
  ? createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY)
  : null;
export async function unwrap(p) {
  const { data, error } = await p;
  if (error) throw Error(error.message);
  return data;
}
export const rpc = (name, args) => unwrap(db.rpc(name, args));
