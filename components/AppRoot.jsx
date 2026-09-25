'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase, supabaseConfigured } from '@/lib/supabase.js';
import { loadAll } from '@/lib/data.js';
import TrainingApp from './TrainingApp.jsx';
import { Shape } from './Icons.jsx';

// Session → data → app. Shows sign-in when logged out.
export default function AppRoot() {
  const [session, setSession] = useState(undefined); // undefined = still checking
  const [db, setDb] = useState(null);
  const [error, setError] = useState('');
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!supabaseConfigured) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const userId = session && session.user ? session.user.id : null;
  const reload = useCallback(async () => {
    if (!session) return;
    try {
      setError('');
      const data = await loadAll(supabase, session.user);
      setDb(data);
      setVersion((v) => v + 1);
    } catch (e) {
      setError(e.message || 'No se pudieron cargar tus datos.');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  useEffect(() => { if (userId) reload(); else setDb(null); }, [userId, reload]);

  if (!supabaseConfigured) {
    return (
      <Centered>
        <h1 className="disp" style={{ margin: 0, fontSize: 30 }}>Falta conectar Supabase</h1>
        <p className="muted" style={{ margin: 0, lineHeight: 1.5 }}>
          Agrega <code>NEXT_PUBLIC_SUPABASE_URL</code> y <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> en Vercel (Settings → Environment Variables) o en <code>.env.local</code>, y vuelve a desplegar.
        </p>
      </Centered>
    );
  }
  if (session === undefined || (session && !db && !error)) return <Centered><Shape name="SCALLOP" fill="var(--accent)" size={64} className="spin-fast" /><span className="muted">Cargando…</span></Centered>;
  if (!session) return <SignIn />;
  if (error && !db) {
    return (
      <Centered>
        <h1 className="disp" style={{ margin: 0, fontSize: 26 }}>No se pudieron cargar tus datos</h1>
        <p className="muted" style={{ margin: 0 }}>{error}</p>
        <button className="btn btn-ink" onClick={reload}>Reintentar</button>
        <button className="btn btn-line" onClick={() => supabase.auth.signOut()}>Cerrar sesión</button>
      </Centered>
    );
  }
  return (
    <TrainingApp key={version} supabase={supabase} user={session.user} initialDb={db}
      onReload={reload} onSignOut={() => supabase.auth.signOut()} />
  );
}

function Centered({ children }) {
  return <div className="centered"><div className="centered-inner">{children}</div></div>;
}

function SignIn() {
  const [mode, setMode] = useState('in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setMsg('');
    try {
      if (mode === 'in') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin } });
        if (error) throw error;
        if (!data.session) setMsg('Te enviamos un correo para confirmar tu cuenta. Ábrelo y luego inicia sesión.');
      }
    } catch (err) {
      setMsg(err.message === 'Invalid login credentials' ? 'Correo o contraseña incorrectos.' : err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Centered>
      <Shape name="SCALLOP" fill="var(--accent)" size={72} face />
      <h1 className="disp" style={{ margin: 0, fontSize: 40, fontWeight: 800, lineHeight: 1 }}>Rutinas GYM</h1>
      <p className="muted" style={{ margin: 0 }}>{mode === 'in' ? 'Inicia sesión para ver tu entreno de hoy.' : 'Crea tu cuenta. Tu programa body recomp se carga solo.'}</p>
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%' }}>
        <label htmlFor="email" className="label">Correo</label>
        <input id="email" className="field" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <label htmlFor="password" className="label">Contraseña</label>
        <input id="password" className="field" type="password" autoComplete={mode === 'in' ? 'current-password' : 'new-password'} minLength={6} required value={password} onChange={(e) => setPassword(e.target.value)} />
        <button className="btn btn-ink" style={{ minHeight: 56, marginTop: 6 }} disabled={busy}>{busy ? 'Un momento…' : mode === 'in' ? 'Entrar' : 'Crear cuenta'}</button>
      </form>
      {msg && <p role="status" className="status ok" style={{ margin: 0 }}>{msg}</p>}
      <button className="btn" onClick={() => { setMode(mode === 'in' ? 'up' : 'in'); setMsg(''); }}>{mode === 'in' ? '¿No tienes cuenta? Crear una' : 'Ya tengo cuenta'}</button>
    </Centered>
  );
}
