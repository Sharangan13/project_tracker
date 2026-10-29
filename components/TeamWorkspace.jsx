'use client';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, fmtCode, genPassword } from '../lib/client/api';
import { parseModules, ROLE_LABEL } from '../lib/shared';
import ActivityPanel from './ActivityPanel';
import { TeamSkeleton } from './skeletons';
import { Badge, EDGE, Header, Modal, NavButton, Notice, box, btn, danger, fd, ft, inp, lbl, pri, sm } from './shared';

const copy = (text) => navigator.clipboard?.writeText(text).catch(() => {});
const statusKey = (t) => (!t.assigneeId ? 'unassigned' : t.status);

/* ---------- Task card + drop zone (drag & drop on desktop; Edit button works everywhere) ---------- */
function Card({ t, act }) {
  const can = act.canMove(t);
  return (
    <div
      draggable={can}
      onDragStart={(e) => { e.dataTransfer.setData('text/plain', t.id); e.dataTransfer.effectAllowed = 'move'; }}
      className={`w-full min-w-[140px] max-w-[200px] flex-1 basis-[140px] rounded-md border border-l-4 border-slate-300 bg-white px-2.5 py-2 dark:border-slate-600 dark:bg-slate-800 ${EDGE[statusKey(t)]} ${can ? 'cursor-grab' : ''}`}
    >
      <b className="font-semibold">{t.label}</b>
      {t.note && <p className="break-words text-sm text-slate-500">{t.note}</p>}
      <small className="block text-xs text-slate-500">
        {t.status === 'completed' ? `Completed ${fd(t.completedAt)}` : t.assignedAt ? `Since ${fd(t.assignedAt)}` : `Added ${fd(t.createdAt)}`}
      </small>
      {(act.canStatus(t) || act.leader) && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {act.canStatus(t) && t.status === 'pending' && t.assigneeId && <button className={btn + sm} onClick={() => act.setStatus(t, 'completed')}>Mark completed</button>}
          {act.canStatus(t) && t.status === 'completed' && <button className={btn + sm} onClick={() => act.setStatus(t, 'pending')}>Reopen</button>}
          <button className={btn + sm} onClick={() => act.edit(t)}>{act.leader ? 'Edit' : 'Note'}</button>
        </div>
      )}
    </div>
  );
}

function Zone({ items, m, s, empty, drop, act }) {
  const [over, setOver] = useState(false);
  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); drop(e.dataTransfer.getData('text/plain'), m, s); }}
      className={`flex min-h-[90px] flex-wrap content-start gap-2 rounded-lg p-1 transition-colors ${over ? 'bg-cyan-100 outline-dashed outline-2 outline-cyan-700 dark:bg-cyan-950' : ''}`}
    >
      {items.length ? items.map((t) => <Card key={t.id} t={t} act={act} />) : <span className="m-auto text-sm text-slate-500">{empty}</span>}
    </div>
  );
}

/* ---------- Modals ---------- */
function CredentialsBox({ username, password }) {
  return (
    <div className="grid gap-2 rounded-md border border-amber-400 bg-amber-50 p-3 text-sm dark:border-amber-700 dark:bg-amber-950">
      <p className="font-medium">Share these now. The password can’t be viewed again, only reset.</p>
      <p>Username: <span className="font-mono font-semibold">{username}</span></p>
      <p className="break-all">Password: <span className="font-mono font-semibold">{password}</span></p>
      <button type="button" className={btn} onClick={() => copy(`Username: ${username}\nPassword: ${password}`)}>Copy username &amp; password</button>
    </div>
  );
}

function AddMemberModal({ team, onClose, onDone }) {
  const [mode, setMode] = useState('create');
  const [f, setF] = useState({ displayName: '', username: '', password: genPassword(), role: 'member' });
  const [touched, setTouched] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState(null);
  const slug = (s) => s.toLowerCase().replace(/[^a-z0-9._-]/g, '').slice(0, 30);

  async function submit(e) {
    e.preventDefault(); setBusy(true); setErr('');
    try {
      await api(`/api/teams/${team.id}/members`, { method: 'POST', body: mode === 'create' ? { mode, ...f } : { mode, username: f.username, role: f.role } });
      onDone();
      if (mode === 'create') setCreated({ username: f.username.trim().toLowerCase(), password: f.password }); else onClose();
    } catch (ex) { setErr(ex.message); }
    setBusy(false);
  }

  if (created) {
    return (
      <Modal onClose={onClose}>
        <div className="grid gap-3">
          <h2 className="text-lg font-bold">Member created</h2>
          <p className="text-sm text-slate-500">They can sign in with <b>Login to a Team</b> using team code <span className="font-mono">{fmtCode(team.code)}</span>, or with <b>Login to My Account</b>.</p>
          <CredentialsBox {...created} />
          <button className={pri} onClick={onClose}>Done</button>
        </div>
      </Modal>
    );
  }
  return (
    <Modal onClose={onClose} wide>
      <form onSubmit={submit} className="grid gap-3">
        <h2 className="text-lg font-bold">Add a member</h2>
        <div className="grid grid-cols-2 gap-1 rounded-md bg-slate-100 p-1 text-sm dark:bg-slate-900">
          {[['create', 'Create new login'], ['existing', 'Add existing user']].map(([k, l]) => (
            <button type="button" key={k} onClick={() => { setMode(k); setErr(''); }} className={`rounded px-2 py-1.5 ${mode === k ? 'bg-white shadow dark:bg-slate-700' : 'text-slate-500'}`}>{l}</button>
          ))}
        </div>
        {mode === 'create' && (
          <label className={lbl}>Full name
            <input value={f.displayName} maxLength={60} required className={inp}
              onChange={(e) => setF({ ...f, displayName: e.target.value, username: touched ? f.username : slug(e.target.value) })} />
          </label>
        )}
        <label className={lbl}>Username
          <input value={f.username} onChange={(e) => { setTouched(true); setF({ ...f, username: e.target.value }); }} pattern="[A-Za-z0-9._\-]{3,30}"
            title="3–30 letters, numbers, dots, dashes or underscores" autoCapitalize="none" required className={inp} />
        </label>
        {mode === 'create' && (
          <label className={lbl}>Password
            <div className="flex gap-2">
              <input value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} minLength={8} required className={`${inp} min-w-0 flex-1 font-mono`} />
              <button type="button" className={btn} onClick={() => setF({ ...f, password: genPassword() })}>Generate</button>
            </div>
          </label>
        )}
        <label className={lbl}>Role
          <select className={inp} value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}>
            <option value="member">Member — works on assigned tasks</option>
            <option value="leader">Team leader — manages tasks and members</option>
          </select>
        </label>
        <Notice tone="error">{err}</Notice>
        <div className="flex justify-end gap-2">
          <button type="button" className={btn} onClick={onClose}>Cancel</button>
          <button className={pri} disabled={busy}>{mode === 'create' ? 'Create login' : 'Add to team'}</button>
        </div>
      </form>
    </Modal>
  );
}

function ResetModal({ team, member, onClose, onDone }) {
  const [pw, setPw] = useState(genPassword());
  const [err, setErr] = useState('');
  const [saved, setSaved] = useState(false);
  async function submit(e) {
    e.preventDefault();
    try { await api(`/api/teams/${team.id}/members/${member.id}`, { method: 'PATCH', body: { password: pw } }); setSaved(true); onDone(); }
    catch (ex) { setErr(ex.message); }
  }
  return (
    <Modal onClose={onClose}>
      <form onSubmit={submit} className="grid gap-3">
        <h2 className="text-lg font-bold">Reset password for {member.displayName}</h2>
        {saved ? <CredentialsBox username={member.username} password={pw} /> : (
          <>
            <label className={lbl}>New password
              <div className="flex gap-2">
                <input value={pw} onChange={(e) => setPw(e.target.value)} minLength={8} required className={`${inp} min-w-0 flex-1 font-mono`} />
                <button type="button" className={btn} onClick={() => setPw(genPassword())}>Generate</button>
              </div>
            </label>
            <p className="text-xs text-slate-500">They will be signed out everywhere.</p>
          </>
        )}
        <Notice tone="error">{err}</Notice>
        <div className="flex justify-end gap-2">
          <button type="button" className={btn} onClick={onClose}>{saved ? 'Close' : 'Cancel'}</button>
          {!saved && <button className={pri}>Save password</button>}
        </div>
      </form>
    </Modal>
  );
}

function DeleteTeamModal({ team, onClose, onDone }) {
  const [text, setText] = useState('');
  const [err, setErr] = useState('');
  async function submit(e) {
    e.preventDefault();
    try { await api(`/api/teams/${team.id}`, { method: 'DELETE', body: { confirmName: text } }); onDone(); }
    catch (ex) { setErr(ex.message); }
  }
  return (
    <Modal onClose={onClose}>
      <form onSubmit={submit} className="grid gap-3">
        <h2 className="text-lg font-bold text-red-600 dark:text-red-400">Delete team</h2>
        <p className="text-sm text-slate-500">This permanently deletes the team, all its tasks and its activity history. Logins created for this team and not used elsewhere are kept but lose access. Type <b>{team.name}</b> to confirm.</p>
        <input value={text} onChange={(e) => setText(e.target.value)} className={inp} autoComplete="off" />
        <Notice tone="error">{err}</Notice>
        <div className="flex justify-end gap-2">
          <button type="button" className={btn} onClick={onClose}>Cancel</button>
          <button className={`${btn}${danger}`} disabled={text.trim() !== team.name}>Delete team</button>
        </div>
      </form>
    </Modal>
  );
}

/* ---------- Main workspace ---------- */
export default function TeamWorkspace({ teamId }) {
  const router = useRouter();
  const [me, setMe] = useState(null);
  const [scope, setScope] = useState('account');
  const [team, setTeam] = useState(null);
  const [members, setMembers] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [view, setView] = useState('board');
  const [flash, setFlash] = useState('');
  const [flashTone, setFlashTone] = useState('info');
  const [edit, setEdit] = useState(null);
  const [modal, setModal] = useState(null); // 'add' | {reset: member} | 'delete'
  const [range, setRange] = useState('');
  const [rangeAssignee, setRangeAssignee] = useState('');
  const [teamName, setTeamName] = useState('');

  const leader = team?.role === 'leader';
  const say = (text, tone = 'info') => { setFlash(text); setFlashTone(tone); };
  const fail = (e) => (e.status === 401 ? router.replace('/') : say(e.message, 'error'));

  const load = useCallback(async () => {
    try {
      const [m, t, mem, tk] = await Promise.all([
        api('/api/auth/me'), api(`/api/teams/${teamId}`), api(`/api/teams/${teamId}/members`), api(`/api/teams/${teamId}/tasks`),
      ]);
      setMe(m.user); setScope(m.scope.type); setTeam(t.team); setTeamName((n) => n || t.team.name); setMembers(mem.members); setTasks(tk.tasks);
    } catch (e) {
      if (e.status === 401) router.replace('/');
      else if (e.status === 404) router.replace('/account');
      else say(e.message, 'error');
    }
  }, [teamId, router]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const onVis = () => document.visibilityState === 'visible' && load();
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [load]);

  const signOut = async () => { await api('/api/auth/logout', { method: 'POST' }).catch(() => {}); router.replace('/'); };

  /* ----- task actions ----- */
  async function patchTask(t, patch, okMsg) {
    setTasks((ts) => ts.map((x) => (x.id === t.id ? { ...x, ...patch } : x))); // optimistic
    try {
      await api(`/api/teams/${teamId}/tasks/${t.id}`, { method: 'PATCH', body: patch });
      if (okMsg) say(okMsg);
    } catch (e) { fail(e); }
    load();
  }

  function drop(id, mem, st) {
    const t = tasks.find((x) => x.id === id);
    if (!t) return;
    if (!leader) {
      if (t.assigneeId !== me.id || mem !== me.id || !st) return; // members only move their own task between Pending/Completed
      if (st !== t.status) patchTask(t, { status: st });
      return;
    }
    if (!mem) { if (t.assigneeId) patchTask(t, { assigneeId: null, status: 'pending' }); return; }
    if (mem !== t.assigneeId) patchTask(t, st === 'completed' ? { assigneeId: mem, status: 'completed' } : { assigneeId: mem });
    else if (st && st !== t.status) patchTask(t, { status: st });
  }

  const act = {
    leader,
    canMove: (t) => leader || (t.assigneeId && t.assigneeId === me?.id),
    canStatus: (t) => leader ? !!t.assigneeId : t.assigneeId === me?.id,
    setStatus: (t, status) => patchTask(t, { status }),
    edit: (t) => setEdit({ ...t }),
  };

  async function addModules(e) {
    e.preventDefault();
    const p = parseModules(range);
    if (p.error) return say(p.error, 'error');
    try {
      const r = await api(`/api/teams/${teamId}/tasks`, { method: 'POST', body: { range, assigneeId: rangeAssignee || null } });
      say(r.created ? `Created ${r.created} task${r.created > 1 ? 's' : ''}.${r.skipped ? ` ${r.skipped} already existed.` : ''}` : 'Those modules already exist.');
      setRange('');
    } catch (ex) { fail(ex); }
    load();
  }

  async function saveEdit(e) {
    e.preventDefault();
    const old = tasks.find((x) => x.id === edit.id);
    const patch = {};
    if (leader && edit.label.trim() && edit.label.trim() !== old.label) patch.label = edit.label.trim();
    if (edit.note.trim() !== old.note) patch.note = edit.note.trim();
    const assigneeChanged = leader && (edit.assigneeId || null) !== old.assigneeId;
    if (assigneeChanged) patch.assigneeId = edit.assigneeId || null;
    // Reassigning resets a task to pending on the server, so compare against that.
    const baseStatus = assigneeChanged ? 'pending' : old.status;
    if (edit.assigneeId && (leader || old.assigneeId === me.id) && edit.status !== baseStatus) patch.status = edit.status;
    setEdit(null);
    if (!Object.keys(patch).length) return;
    try { await api(`/api/teams/${teamId}/tasks/${old.id}`, { method: 'PATCH', body: patch }); say('Task updated.'); } catch (ex) { fail(ex); }
    load();
  }

  async function delTask(t) {
    if (!confirm(`Delete ${t.label}?`)) return;
    try { await api(`/api/teams/${teamId}/tasks/${t.id}`, { method: 'DELETE' }); } catch (ex) { fail(ex); }
    load();
  }

  /* ----- member / team actions ----- */
  async function patchMember(m, body, okMsg) {
    try { await api(`/api/teams/${teamId}/members/${m.id}`, { method: 'PATCH', body }); say(okMsg); } catch (ex) { fail(ex); }
    load();
  }
  async function removeMember(m) {
    const self = m.id === me.id;
    if (!confirm(self ? `Leave ${team.name}? Your tasks here go back to unassigned.` : `Remove ${m.displayName} from the team?${m.managed ? ' Their login will be deleted if it belongs to no other team.' : ''} Their tasks return to unassigned.`)) return;
    try {
      await api(`/api/teams/${teamId}/members/${m.id}`, { method: 'DELETE' });
      if (self) return router.replace(scope === 'team' ? '/' : '/account');
      say(`${m.displayName} removed.`);
    } catch (ex) { fail(ex); }
    load();
  }
  async function saveTeam(body, okMsg) {
    try { await api(`/api/teams/${teamId}`, { method: 'PATCH', body }); say(okMsg); } catch (ex) { fail(ex); }
    load();
  }

  if (!me || !team) return flash ? <div className="p-8"><Notice tone="error">{flash}</Notice></div> : <TeamSkeleton />;

  /* ----- derived ----- */
  const active = members.filter((m) => m.isActive);
  const by = (m, s) => tasks.filter((t) => t.assigneeId === m && t.status === s);
  const unassigned = tasks.filter((t) => !t.assigneeId);
  const nDone = tasks.filter((t) => t.status === 'completed').length;
  const pct = tasks.length ? Math.round((nDone / tasks.length) * 100) : 0;
  const Msg = () => <Notice tone={flashTone}>{flash}</Notice>;

  const board = (
    <>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        {leader ? (
          <form onSubmit={addModules} className="flex flex-wrap items-end gap-2">
            <label className={lbl}>Add modules<input value={range} onChange={(e) => setRange(e.target.value)} placeholder="1 to 10" required className={`${inp} w-36`} /></label>
            <label className={lbl}>Assign to (optional)
              <select className={`${inp} w-44`} value={rangeAssignee} onChange={(e) => setRangeAssignee(e.target.value)}>
                <option value="">Unassigned</option>
                {active.map((m) => <option key={m.id} value={m.id}>{m.displayName}</option>)}
              </select>
            </label>
            <button className={pri}>Create tasks</button>
          </form>
        ) : <p className="text-sm text-slate-500">You can mark your own tasks Completed or Pending and add notes to them.</p>}
        <div className="w-full min-w-[220px] text-sm text-slate-500 sm:w-auto">
          {nDone} of {tasks.length} modules completed ({pct}%)
          <div className="mt-1 h-2 overflow-hidden rounded bg-slate-300 dark:bg-slate-700"><div className="h-full bg-emerald-600" style={{ width: `${pct}%` }} /></div>
        </div>
      </div>
      <section className={`${box} mb-5 p-3.5`}>
        <h2 className="mb-2 text-lg font-bold">Unassigned tasks <span className="ml-1 text-sm font-medium text-slate-500">{unassigned.length}</span></h2>
        <Zone items={unassigned} m={null} s="pending" drop={drop} act={act} empty={tasks.length ? 'All tasks are assigned' : leader ? 'No tasks yet. Add modules above.' : 'No tasks yet.'} />
      </section>
      <h2 className="mb-2 text-lg font-bold">Team board{leader && <span className="ml-1 hidden text-sm font-medium text-slate-500 sm:inline">drag a task onto a column, or use Edit on touch screens</span>}</h2>
      {active.length ? (
        <div className={`${box} overflow-x-auto`}>
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="sticky left-0 z-[1] w-[84px] min-w-[84px] border-b border-r border-slate-300 bg-white p-2.5 dark:border-slate-700 dark:bg-slate-800" />
                {active.map((m) => (
                  <th key={m.id} className="min-w-[180px] border-b border-r border-slate-300 p-2.5 text-left last:border-r-0 dark:border-slate-700">
                    {m.displayName}{m.id === me.id && <span className="ml-1.5 text-xs font-medium text-cyan-700 dark:text-cyan-400">you</span>}
                    <small className="block text-xs font-normal text-slate-500">{by(m.id, 'pending').length} pending · {by(m.id, 'completed').length} completed</small>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[['pending', 'Pending', 'Drop to assign'], ['completed', 'Completed', 'Drop when done']].map(([s, label, empty]) => (
                <tr key={s}>
                  <th className="sticky left-0 z-[1] border-r border-slate-300 bg-white p-2.5 text-left align-top text-sm font-medium text-slate-500 dark:border-slate-700 dark:bg-slate-800">{label}</th>
                  {active.map((m) => (
                    <td key={m.id} className="border-r border-slate-300 p-2.5 align-top last:border-r-0 dark:border-slate-700">
                      <Zone items={by(m.id, s)} m={m.id} s={s} drop={drop} act={act} empty={leader ? empty : '—'} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <p className="text-slate-500">No active members yet.{leader && <> <button className={btn} onClick={() => setView('team')}>Go to Team</button></>}</p>}
    </>
  );

  const section = (key, title) => {
    const list = tasks.filter((t) => statusKey(t) === key && (leader || t.assigneeId === me.id));
    return (
      <div key={key} className="mb-6">
        <h2 className="mb-2 text-lg font-bold">{title} <span className="ml-1 text-sm font-medium text-slate-500">{list.length}</span></h2>
        {list.length ? list.map((t) => (
          <div key={t.id} className={`${box} mb-1.5 flex flex-wrap items-center gap-x-4 gap-y-2 border-l-4 px-3 py-2 ${EDGE[key]}`}>
            <div className="min-w-0 flex-1 basis-52">
              <b>{t.label}</b>
              <small className="block break-words text-slate-500">{t.note || (t.status === 'completed' ? `Completed ${ft(t.completedAt)}` : t.assignedAt ? `Assigned ${ft(t.assignedAt)}` : `Created ${ft(t.createdAt)}`)}</small>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {leader && (
                <select aria-label={`Assignee for ${t.label}`} className={`${inp} !w-auto`} value={t.assigneeId || ''}
                  onChange={(e) => patchTask(t, { assigneeId: e.target.value || null })}>
                  <option value="">Unassigned</option>
                  {active.map((m) => <option key={m.id} value={m.id}>{m.displayName}</option>)}
                </select>
              )}
              {act.canStatus(t) && t.status === 'pending' && <button className={pri} onClick={() => act.setStatus(t, 'completed')}>Mark completed</button>}
              {act.canStatus(t) && t.status === 'completed' && <button className={btn} onClick={() => act.setStatus(t, 'pending')}>Reopen</button>}
              {(leader || t.assigneeId === me.id) && <button className={btn} onClick={() => act.edit(t)}>{leader ? 'Edit' : 'Add note'}</button>}
              {leader && <button className={btn + danger} onClick={() => delTask(t)}>Delete</button>}
            </div>
          </div>
        )) : <p className="text-sm text-slate-500">Nothing here.</p>}
      </div>
    );
  };

  const teamView = (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <h2 className="mr-auto text-lg font-bold">Members <span className="ml-1 text-sm font-medium text-slate-500">{active.length}</span></h2>
        {leader && <button className={pri} onClick={() => setModal('add')}>Add member</button>}
      </div>
      {members.map((m) => {
        const self = m.id === me.id;
        return (
          <div key={m.id} className={`${box} mb-1.5 flex flex-wrap items-center gap-x-4 gap-y-2 border-l-4 px-3 py-2 ${m.isActive ? 'border-l-emerald-600' : 'border-l-slate-400 opacity-80'}`}>
            <div className="min-w-0 flex-1 basis-52">
              <b className="break-words">{m.displayName}</b>{self && <span className="ml-1.5 text-xs text-cyan-700 dark:text-cyan-400">you</span>}
              <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                <Badge tone={m.role === 'leader' ? 'cyan' : 'slate'}>{ROLE_LABEL[m.role]}</Badge>
                {!m.isActive && <Badge tone="red">Access disabled</Badge>}
                {leader && m.managed && <Badge>Team login</Badge>}
                <small className="text-slate-500">{leader && <>@{m.username} · </>}{m.pending} pending · {m.completed} completed</small>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {leader && m.managed && !self && <button className={btn} onClick={() => setModal({ reset: m })}>Reset password</button>}
              {leader && m.isActive && <button className={btn} onClick={() => patchMember(m, { role: m.role === 'leader' ? 'member' : 'leader' }, `${m.displayName} is now ${m.role === 'leader' ? 'a member' : 'a team leader'}.`)}>{m.role === 'leader' ? 'Make member' : 'Make leader'}</button>}
              {leader && <button className={btn} onClick={() => patchMember(m, { isActive: !m.isActive }, m.isActive ? `${m.displayName}’s access disabled.` : `${m.displayName}’s access restored.`)}>{m.isActive ? 'Disable access' : 'Restore access'}</button>}
              {(leader || self) && <button className={btn + danger} onClick={() => removeMember(m)}>{self ? 'Leave team' : 'Remove'}</button>}
            </div>
          </div>
        );
      })}

      <h2 className="mb-2 mt-8 text-lg font-bold">Team login</h2>
      <div className={`${box} grid gap-3 p-4`}>
        <p className="text-sm text-slate-500">Members use <b>Login to a Team</b> with this code, plus their own username and password.</p>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded bg-slate-100 px-3 py-1.5 font-mono text-lg tracking-wider dark:bg-slate-900">{fmtCode(team.code)}</span>
          <button className={btn} onClick={() => { copy(fmtCode(team.code)); say('Team code copied.'); }}>Copy</button>
          {leader && <button className={btn} onClick={() => confirm('Generate a new code? The old code stops working for team login.') && saveTeam({ regenerateCode: true }, 'New team code generated.')}>Regenerate</button>}
        </div>
        {leader && (
          <form onSubmit={(e) => { e.preventDefault(); saveTeam({ name: teamName }, 'Team renamed.'); }} className="flex flex-wrap items-end gap-2">
            <label className={`${lbl} w-full sm:w-72`}>Team name<input value={teamName} onChange={(e) => setTeamName(e.target.value)} minLength={2} maxLength={60} required className={inp} /></label>
            <button className={btn} disabled={teamName.trim() === team.name}>Rename</button>
          </form>
        )}
        {leader && <div><button className={btn + danger} onClick={() => setModal('delete')}>Delete team…</button></div>}
      </div>
    </>
  );

  const tabs = [['board', 'Board'], ['tasks', leader ? 'Tasks' : 'My tasks'], ['team', 'Team'], ['activity', 'Activity']];
  return (
    <>
      <Header title={team.name} subtitle={`${ROLE_LABEL[team.role]} · ${scope === 'team' ? 'Team login' : 'Account login'}`}
        right={<>
          <span className="truncate">{me.displayName}</span>
          {scope === 'account' && <button className={btn} onClick={() => router.push('/account')}>My account</button>}
          <button className={btn} onClick={signOut}>Sign out</button>
        </>}
        nav={tabs.map(([k, l]) => <NavButton key={k} active={view === k} onClick={() => { setView(k); setFlash(''); }}>{l}</NavButton>)} />
      <main className="mx-auto max-w-[1500px] px-4 pb-12 pt-5 sm:px-8">
        {flash && <div className="mb-4"><Msg /></div>}
        {view === 'board' && board}
        {view === 'tasks' && (leader ? [['unassigned', 'Unassigned tasks'], ['pending', 'Pending'], ['completed', 'Completed']] : [['pending', 'Pending'], ['completed', 'Completed']]).map(([k, l]) => section(k, l))}
        {view === 'team' && teamView}
        {view === 'activity' && <ActivityPanel fixedTeamId={teamId} />}
      </main>

      {edit && (
        <Modal onClose={() => setEdit(null)}>
          <form onSubmit={saveEdit} className="grid gap-3">
            <h2 className="text-lg font-bold">Update {edit.label}</h2>
            <label className={lbl}>Task name<input value={edit.label} disabled={!leader} onChange={(e) => setEdit({ ...edit, label: e.target.value })} maxLength={60} required className={inp} /></label>
            <label className={lbl}>Notes<textarea value={edit.note} onChange={(e) => setEdit({ ...edit, note: e.target.value })} rows={3} maxLength={500} className={inp} /></label>
            {leader && (
              <label className={lbl}>Assigned to
                <select className={inp} value={edit.assigneeId || ''} onChange={(e) => setEdit({ ...edit, assigneeId: e.target.value || null, status: 'pending' })}>
                  <option value="">Unassigned</option>
                  {active.map((m) => <option key={m.id} value={m.id}>{m.displayName}</option>)}
                </select>
              </label>
            )}
            {edit.assigneeId && (leader || edit.assigneeId === me.id) && (
              <label className={lbl}>Status
                <select className={inp} value={edit.status} onChange={(e) => setEdit({ ...edit, status: e.target.value })}>
                  <option value="pending">Pending</option>
                  <option value="completed">Completed</option>
                </select>
              </label>
            )}
            <div className="flex justify-end gap-2">
              <button type="button" className={btn} onClick={() => setEdit(null)}>Cancel</button>
              <button className={pri}>Save changes</button>
            </div>
          </form>
        </Modal>
      )}
      {modal === 'add' && leader && <AddMemberModal team={team} onClose={() => setModal(null)} onDone={load} />}
      {modal?.reset && leader && <ResetModal team={team} member={modal.reset} onClose={() => setModal(null)} onDone={load} />}
      {modal === 'delete' && leader && <DeleteTeamModal team={team} onClose={() => setModal(null)} onDone={() => router.replace(scope === 'team' ? '/' : '/account')} />}
    </>
  );
}
