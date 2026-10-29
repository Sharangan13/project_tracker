'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../lib/client/api';
import { box, inp, lbl, pri, Notice } from './shared';
import { AuthSkeleton } from './skeletons';

const TABS = [['account', 'Login to My Account'], ['team', 'Login to a Team'], ['register', 'Create account']];
const HELP = {
  account: 'Sign in with your personal username to see all your teams.',
  team: 'Use the team code and the username and password your team leader gave you.',
  register: 'Create a personal account. You can then create a team or be added to one.',
};

export default function AuthScreen() {
  const router = useRouter();
  const [tab, setTab] = useState('account');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    api('/api/auth/me')
      .then((me) => router.replace(me.scope.type === 'team' ? `/team/${me.scope.teamId}` : '/account'))
      .catch(() => setChecking(false));
  }, [router]);

  async function submit(e) {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.currentTarget));
    setBusy(true); setErr('');
    try {
      if (tab === 'register') {
        if (f.password !== f.confirm) throw new Error('Passwords do not match.');
        await api('/api/auth/register', { method: 'POST', body: { username: f.username, displayName: f.displayName, password: f.password } });
        router.replace('/account');
      } else if (tab === 'team') {
        const r = await api('/api/auth/team-login', { method: 'POST', body: { teamCode: f.teamCode, username: f.username, password: f.password } });
        router.replace(`/team/${r.teamId}`);
      } else {
        await api('/api/auth/login', { method: 'POST', body: { username: f.username, password: f.password } });
        router.replace('/account');
      }
    } catch (ex) { setErr(ex.message); setBusy(false); }
  }

  if (checking) return <AuthSkeleton />;
  return (
    <main className="mx-auto grid min-h-screen w-full max-w-md content-center gap-4 px-4 py-8">
      <div className="text-center">
        <h1 className="text-2xl font-bold">Module Task Tracker</h1>
        <p className="mt-1 text-sm text-slate-500">Assign and track module tasks across your teams.</p>
      </div>
      <div className={`${box} p-4 sm:p-6`}>
        <div role="tablist" className="mb-4 grid grid-cols-3 gap-1 rounded-md bg-slate-100 p-1 text-center text-xs font-medium sm:text-sm dark:bg-slate-900">
          {TABS.map(([k, l]) => (
            <button key={k} role="tab" aria-selected={tab === k} onClick={() => { setTab(k); setErr(''); }}
              className={`rounded px-1.5 py-2 ${tab === k ? 'bg-white shadow dark:bg-slate-700' : 'text-slate-500'}`}>{l}</button>
          ))}
        </div>
        <form key={tab} onSubmit={submit} className="grid gap-3">
          <p className="text-sm text-slate-500">{HELP[tab]}</p>
          <Notice tone="error">{err}</Notice>
          {tab === 'team' && <label className={lbl}>Team code<input name="teamCode" autoCapitalize="characters" autoComplete="off" placeholder="ABCD-2345" required className={`${inp} font-mono uppercase`} /></label>}
          {tab === 'register' && <label className={lbl}>Your name<input name="displayName" autoComplete="name" maxLength={60} required className={inp} /></label>}
          <label className={lbl}>Username<input name="username" autoComplete="username" autoCapitalize="none" spellCheck={false} required className={inp} /></label>
          <label className={lbl}>Password<input name="password" type="password" autoComplete={tab === 'register' ? 'new-password' : 'current-password'} minLength={tab === 'register' ? 8 : undefined} required className={inp} /></label>
          {tab === 'register' && <label className={lbl}>Confirm password<input name="confirm" type="password" autoComplete="new-password" minLength={8} required className={inp} /></label>}
          <button className={pri} disabled={busy}>{busy ? 'Please wait…' : tab === 'register' ? 'Create account' : tab === 'team' ? 'Login to team' : 'Login'}</button>
        </form>
      </div>
    </main>
  );
}
