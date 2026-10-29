'use client';
import { useEffect } from 'react';

export const fd = (t) => new Date(t).toLocaleDateString([], { day: 'numeric', month: 'short' });
export const ft = (t) => new Date(t).toLocaleString([], { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export const EDGE = { pending: 'border-l-amber-500', completed: 'border-l-emerald-600', unassigned: 'border-l-slate-400' };
export const LOGEDGE = {
  'task.created': 'border-l-sky-600', 'task.assigned': 'border-l-sky-600', 'task.unassigned': 'border-l-red-600',
  'task.deleted': 'border-l-red-600', 'task.updated': 'border-l-amber-500', 'task.status_changed': 'border-l-emerald-600',
  'member.added': 'border-l-sky-600', 'member.removed': 'border-l-red-600', 'member.role_changed': 'border-l-amber-500',
  'member.access_changed': 'border-l-amber-500', 'member.credentials_created': 'border-l-sky-600', 'member.password_reset': 'border-l-amber-500',
  'team.created': 'border-l-sky-600', 'team.updated': 'border-l-amber-500',
};
export const box = 'rounded-lg border border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-800';
export const btn = 'rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:border-cyan-700 disabled:opacity-60 dark:border-slate-600';
export const sm = ' !px-2 !py-0.5 !text-xs';
export const pri = 'rounded-md bg-cyan-800 px-3 py-1.5 text-sm font-semibold text-white hover:bg-cyan-900 disabled:opacity-60 dark:bg-cyan-400 dark:text-slate-900 dark:hover:bg-cyan-300';
export const danger = ' text-red-600 dark:text-red-400';
export const inp = 'w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 dark:border-slate-600 dark:bg-slate-800 disabled:opacity-60';
export const lbl = 'grid gap-1 text-sm text-slate-600 dark:text-slate-400';

export function Loading({ text = 'Loading…' }) {
  return <p className="p-8 text-slate-500" role="status">{text}</p>;
}

export function Badge({ children, tone = 'slate' }) {
  const tones = {
    slate: 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200',
    cyan: 'bg-cyan-100 text-cyan-900 dark:bg-cyan-900 dark:text-cyan-100',
    green: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900 dark:text-emerald-100',
    red: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100',
  };
  return <span className={`inline-block rounded px-1.5 py-0.5 text-xs font-medium ${tones[tone]}`}>{children}</span>;
}

export function Modal({ onClose, children, wide }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-20 grid place-items-center overflow-y-auto bg-black/50 p-3 sm:p-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}
        className={`${box} max-h-[92vh] w-full overflow-y-auto p-4 sm:p-5 ${wide ? 'max-w-lg' : 'max-w-md'}`}>
        {children}
      </div>
    </div>
  );
}

export function Notice({ children, tone = 'info' }) {
  if (!children) return null;
  const c = tone === 'error' ? 'border-red-300 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200'
    : 'border-slate-300 bg-slate-50 text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300';
  return <p role={tone === 'error' ? 'alert' : 'status'} className={`w-full rounded-md border px-3 py-2 text-sm ${c}`}>{children}</p>;
}

export function Header({ title, subtitle, nav, right }) {
  return (
    <header className="border-b border-slate-300 bg-white px-4 py-3 sm:px-8 dark:border-slate-700 dark:bg-slate-800">
      <div className="mx-auto flex max-w-[1500px] flex-wrap items-center gap-x-5 gap-y-2">
        <div className="mr-auto min-w-0">
          <h1 className="truncate text-lg font-bold sm:text-xl">{title}</h1>
          {subtitle && <p className="truncate text-xs text-slate-500">{subtitle}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500">{right}</div>
        {nav && <nav className="-mx-1 flex w-full gap-1 overflow-x-auto px-1 pb-0.5 sm:w-auto" aria-label="Sections">{nav}</nav>}
      </div>
    </header>
  );
}

export function NavButton({ active, onClick, children }) {
  return (
    <button onClick={onClick} aria-current={active ? 'page' : undefined}
      className={`shrink-0 rounded-md px-3 py-1.5 text-sm font-medium ${active ? 'bg-cyan-800 text-white dark:bg-cyan-400 dark:text-slate-900' : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-100'}`}>
      {children}
    </button>
  );
}
