'use client';
import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/client/api';
import { ACTION_GROUPS, ACTION_LABEL } from '../lib/shared';
import { box, btn, inp, lbl, ft, LOGEDGE, Badge, Notice } from './shared';
import { ActivityRowsSkeleton } from './skeletons';

const EMPTY = { team: '', user: '', action: '', from: '', to: '', q: '' };
const PAGE = 50;

// Activity history with filters: team, user, action type, date range (+ text search).
// fixedTeamId pins it to one team (inside a team workspace) and hides the team filter.
export default function ActivityPanel({ fixedTeamId = null }) {
  const [opts, setOpts] = useState({ teams: [], users: [] });
  const [f, setF] = useState(EMPTY);
  const [applied, setApplied] = useState(EMPTY);
  const [items, setItems] = useState([]);
  const [more, setMore] = useState(false);
  const [busy, setBusy] = useState(true);
  const [err, setErr] = useState('');

  useEffect(() => { api('/api/activity/options').then(setOpts).catch((e) => setErr(e.message)); }, []);

  const fetchPage = useCallback(async (flt, offset) => {
    const p = new URLSearchParams({ limit: PAGE, offset });
    const team = fixedTeamId || flt.team;
    if (team) p.set('team_id', team);
    if (flt.user) p.set('user_id', flt.user);
    if (flt.action) p.set('action', flt.action);
    if (flt.q.trim()) p.set('q', flt.q.trim());
    // Dates are local calendar days; send them as exact instants.
    if (flt.from) p.set('from', new Date(`${flt.from}T00:00:00`).toISOString());
    if (flt.to) p.set('to', new Date(`${flt.to}T23:59:59.999`).toISOString());
    return api(`/api/activity?${p}`);
  }, [fixedTeamId]);

  useEffect(() => {
    let live = true;
    setBusy(true); setErr('');
    fetchPage(applied, 0)
      .then((r) => { if (live) { setItems(r.items); setMore(r.hasMore); } })
      .catch((e) => live && setErr(e.message))
      .finally(() => live && setBusy(false));
    return () => { live = false; };
  }, [applied, fetchPage]);

  async function loadMore() {
    setBusy(true);
    try { const r = await fetchPage(applied, items.length); setItems((x) => [...x, ...r.items]); setMore(r.hasMore); }
    catch (e) { setErr(e.message); }
    setBusy(false);
  }

  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const dirty = JSON.stringify(f) !== JSON.stringify(applied);
  const active = Object.values(applied).some(Boolean);

  return (
    <>
      <form onSubmit={(e) => { e.preventDefault(); setApplied(f); }} className={`${box} mb-4 grid gap-3 p-3 sm:grid-cols-2 lg:grid-cols-6`}>
        {!fixedTeamId && (
          <label className={lbl}>Team
            <select className={inp} value={f.team} onChange={set('team')}>
              <option value="">All teams</option>
              {opts.teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </label>
        )}
        <label className={lbl}>User
          <select className={inp} value={f.user} onChange={set('user')}>
            <option value="">Anyone</option>
            {opts.users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </label>
        <label className={lbl}>Action type
          <select className={inp} value={f.action} onChange={set('action')}>
            <option value="">All actions</option>
            {ACTION_GROUPS.map(([g, list]) => (
              <optgroup key={g} label={g}>
                <option value={`${g.toLowerCase().replace(/s$/, '')}.*`}>All {g.toLowerCase()}</option>
                {list.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </optgroup>
            ))}
          </select>
        </label>
        <label className={lbl}>From<input type="date" className={inp} value={f.from} max={f.to || undefined} onChange={set('from')} /></label>
        <label className={lbl}>To<input type="date" className={inp} value={f.to} min={f.from || undefined} onChange={set('to')} /></label>
        <label className={lbl}>Search<input className={inp} value={f.q} onChange={set('q')} placeholder="Module, name…" maxLength={100} /></label>
        <div className="flex gap-2 sm:col-span-2 lg:col-span-6">
          <button className={btn} disabled={!dirty}>Apply filters</button>
          {(active || dirty) && <button type="button" className={btn} onClick={() => { setF(EMPTY); setApplied(EMPTY); }}>Clear</button>}
        </div>
      </form>
      <Notice tone="error">{err}</Notice>
      {items.map((h) => (
        <div key={h.id} className={`${box} mb-1.5 flex flex-wrap items-baseline gap-x-4 gap-y-1 border-l-4 px-3 py-2 ${LOGEDGE[h.action] || 'border-l-slate-400'}`}>
          <time className="min-w-[150px] text-sm text-slate-500">{ft(h.createdAt)}</time>
          <div className="min-w-0 flex-1 basis-60">
            <span className="break-words">{h.message}</span>
            <small className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
              <Badge>{ACTION_LABEL[h.action] || h.action}</Badge>
              <span>by {h.actorName}</span>
              {!fixedTeamId && h.teamName && <span>· {h.teamName}</span>}
            </small>
          </div>
        </div>
      ))}
      {!items.length && !busy && !err && <p className="text-slate-500">{active ? 'No activity matches these filters.' : 'No activity yet.'}</p>}
      {busy && <ActivityRowsSkeleton rows={items.length ? 2 : 6} />}
      {more && !busy && <button className={`${btn} mt-2`} onClick={loadMore}>Load more</button>}
    </>
  );
}
