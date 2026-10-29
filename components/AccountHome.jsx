'use client';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, fmtCode } from '../lib/client/api';
import { ROLE_LABEL } from '../lib/shared';
import ActivityPanel from './ActivityPanel';
import { Badge, Header, NavButton, Notice, box, btn, inp, lbl, pri } from './shared';
import { AccountSkeleton } from './skeletons';

export default function AccountHome() {
  const router = useRouter();
  const [me, setMe] = useState(null);
  const [teams, setTeams] = useState(null);
  const [view, setView] = useState('teams');
  const [name, setName] = useState('');
  const [msg, setMsg] = useState({ text: '', tone: 'info' });
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '' });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const m = await api('/api/auth/me');
      if (m.scope.type === 'team') return router.replace(`/team/${m.scope.teamId}`);
      setMe(m.user);
      setTeams((await api('/api/teams')).teams);
    } catch (e) {
      if (e.status === 401) router.replace('/');
      else setMsg({ text: e.message, tone: 'error' });
    }
  }, [router]);
  useEffect(() => { load(); }, [load]);

  const signOut = async () => { await api('/api/auth/logout', { method: 'POST' }).catch(() => {}); router.replace('/'); };

  async function createTeam(e) {
    e.preventDefault(); setBusy(true);
    try {
      const r = await api('/api/teams', { method: 'POST', body: { name } });
      router.push(`/team/${r.team.id}`);
    } catch (ex) { setMsg({ text: ex.message, tone: 'error' }); setBusy(false); }
  }

  async function changePassword(e) {
    e.preventDefault(); setBusy(true);
    try {
      await api('/api/auth/password', { method: 'POST', body: pw });
      setPw({ currentPassword: '', newPassword: '' });
      setMsg({ text: 'Password updated. Your other sessions were signed out.', tone: 'info' });
    } catch (ex) { setMsg({ text: ex.message, tone: 'error' }); }
    setBusy(false);
  }

  if (!me || !teams) return <AccountSkeleton />;
  const tabs = [['teams', 'My teams'], ['activity', 'Activity'], ['settings', 'Account']];
  return (
    <>
      <Header title="Module Task Tracker" subtitle="Personal account"
        right={<><span className="truncate">{me.displayName} (@{me.username})</span><button className={btn} onClick={signOut}>Sign out</button></>}
        nav={tabs.map(([k, l]) => <NavButton key={k} active={view === k} onClick={() => { setView(k); setMsg({ text: '', tone: 'info' }); }}>{l}</NavButton>)} />
      <main className="mx-auto max-w-[1100px] px-4 pb-12 pt-5 sm:px-8">
        <Notice tone={msg.tone}>{msg.text}</Notice>

        {view === 'teams' && (
          <>
            <form onSubmit={createTeam} className="mb-6 mt-3 flex flex-wrap items-end gap-2">
              <label className={`${lbl} w-full sm:w-72`}>Create a new team
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Team name" minLength={2} maxLength={60} required className={inp} />
              </label>
              <button className={pri} disabled={busy}>Create team</button>
              <p className="w-full text-xs text-slate-500">You become the team leader and can add members and give them logins.</p>
            </form>
            <h2 className="mb-2 text-lg font-bold">My teams <span className="ml-1 text-sm font-medium text-slate-500">{teams.length}</span></h2>
            {teams.length ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {teams.map((t) => {
                  const pct = t.taskCount ? Math.round((t.completedCount / t.taskCount) * 100) : 0;
                  return (
                    <div key={t.id} className={`${box} flex flex-col gap-2 p-4`}>
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="min-w-0 break-words font-semibold">{t.name}</h3>
                        <Badge tone={t.role === 'leader' ? 'cyan' : 'slate'}>{ROLE_LABEL[t.role]}</Badge>
                      </div>
                      <p className="text-xs text-slate-500">Team code <span className="font-mono">{fmtCode(t.code)}</span> · {t.memberCount} member{t.memberCount === 1 ? '' : 's'}</p>
                      <p className="text-sm text-slate-500">{t.completedCount} of {t.taskCount} modules completed ({pct}%){t.myPending ? ` · ${t.myPending} pending for you` : ''}</p>
                      <div className="h-2 overflow-hidden rounded bg-slate-300 dark:bg-slate-700"><div className="h-full bg-emerald-600" style={{ width: `${pct}%` }} /></div>
                      <button className={`${pri} mt-auto`} onClick={() => router.push(`/team/${t.id}`)}>Open team</button>
                    </div>
                  );
                })}
              </div>
            ) : <p className="text-slate-500">You are not on any team yet. Create one above, or ask a team leader to add your username.</p>}
          </>
        )}

        {view === 'activity' && <div className="mt-3"><ActivityPanel /></div>}

        {view === 'settings' && (
          <form onSubmit={changePassword} className={`${box} mt-3 grid max-w-md gap-3 p-4`}>
            <h2 className="text-lg font-bold">Change password</h2>
            <label className={lbl}>Current password<input type="password" autoComplete="current-password" value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} required className={inp} /></label>
            <label className={lbl}>New password (8+ characters)<input type="password" autoComplete="new-password" minLength={8} value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} required className={inp} /></label>
            <button className={pri} disabled={busy}>Update password</button>
          </form>
        )}
      </main>
    </>
  );
}
