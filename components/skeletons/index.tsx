import { Skeleton } from '@/components/ui/skeleton';

const card = 'rounded-lg border border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-800';

/** Wraps a skeleton so screen readers announce loading once. */
function Status({ children, label = 'Loading' }: { children: React.ReactNode; label?: string }) {
  return (
    <div role="status" aria-busy="true" aria-live="polite">
      <span className="sr-only">{label}…</span>
      {children}
    </div>
  );
}

export function HeaderSkeleton({ tabs = 3 }: { tabs?: number }) {
  return (
    <header className="border-b border-slate-300 bg-white px-4 py-3 sm:px-8 dark:border-slate-700 dark:bg-slate-800">
      <div className="mx-auto flex max-w-[1500px] flex-wrap items-center gap-x-5 gap-y-2">
        <div className="mr-auto space-y-2">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-3 w-32" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="hidden h-5 w-32 sm:block" />
          <Skeleton className="h-8 w-20" />
        </div>
        <div className="flex w-full gap-1 sm:w-auto">
          {Array.from({ length: tabs }).map((_, i) => <Skeleton key={i} className="h-8 w-20" />)}
        </div>
      </div>
    </header>
  );
}

/* ---------- Login page ---------- */
export function AuthSkeleton() {
  return (
    <Status>
      <main className="mx-auto grid min-h-screen w-full max-w-md content-center gap-4 px-4 py-8">
        <div className="flex flex-col items-center gap-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-72 max-w-full" />
        </div>
        <div className={`${card} p-4 sm:p-6`}>
          <div className="mb-4 grid grid-cols-3 gap-1"><Skeleton className="h-9" /><Skeleton className="h-9" /><Skeleton className="h-9" /></div>
          <div className="grid gap-3">
            <Skeleton className="h-4 w-full" />
            {[0, 1].map((i) => (
              <div key={i} className="grid gap-1"><Skeleton className="h-4 w-20" /><Skeleton className="h-9 w-full" /></div>
            ))}
            <Skeleton className="h-9 w-full" />
          </div>
        </div>
      </main>
    </Status>
  );
}

/* ---------- Account page ---------- */
export function TeamCardsSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={`${card} flex flex-col gap-2 p-4`}>
          <div className="flex items-start justify-between gap-2"><Skeleton className="h-5 w-32" /><Skeleton className="h-5 w-14" /></div>
          <Skeleton className="h-3 w-44" />
          <Skeleton className="h-4 w-52" />
          <Skeleton className="h-2 w-full" />
          <Skeleton className="mt-2 h-8 w-full" />
        </div>
      ))}
    </div>
  );
}

export function AccountSkeleton() {
  return (
    <Status>
      <HeaderSkeleton tabs={3} />
      <main className="mx-auto max-w-[1100px] px-4 pb-12 pt-5 sm:px-8">
        <div className="mb-6 mt-3 flex flex-wrap items-end gap-2">
          <div className="grid w-full gap-1 sm:w-72"><Skeleton className="h-4 w-28" /><Skeleton className="h-9 w-full" /></div>
          <Skeleton className="h-9 w-28" />
        </div>
        <Skeleton className="mb-3 h-6 w-32" />
        <TeamCardsSkeleton />
      </main>
    </Status>
  );
}

/* ---------- Activity log (used on Account + Team pages) ---------- */
export function ActivityRowsSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div role="status" aria-busy="true">
      <span className="sr-only">Loading activity…</span>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className={`${card} mb-1.5 flex flex-wrap items-center gap-x-4 gap-y-2 border-l-4 !border-l-slate-300 px-3 py-2.5 dark:!border-l-slate-600`}>
          <Skeleton className="h-4 w-[150px]" />
          <div className="min-w-0 flex-1 basis-60 space-y-2"><Skeleton className="h-4 w-3/4" /><Skeleton className="h-3 w-1/3" /></div>
        </div>
      ))}
    </div>
  );
}

export function ActivityFiltersSkeleton() {
  return (
    <div className={`${card} mb-4 grid gap-3 p-3 sm:grid-cols-2 lg:grid-cols-6`}>
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="grid gap-1"><Skeleton className="h-4 w-16" /><Skeleton className="h-9 w-full" /></div>
      ))}
    </div>
  );
}

/* ---------- Team page ---------- */
export function BoardSkeleton({ cols = 3 }: { cols?: number }) {
  return (
    <>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-wrap items-end gap-2">
          <div className="grid gap-1"><Skeleton className="h-4 w-24" /><Skeleton className="h-9 w-36" /></div>
          <div className="grid gap-1"><Skeleton className="h-4 w-32" /><Skeleton className="h-9 w-44" /></div>
          <Skeleton className="h-9 w-28" />
        </div>
        <div className="w-full min-w-[220px] space-y-2 sm:w-auto"><Skeleton className="h-4 w-56" /><Skeleton className="h-2 w-full" /></div>
      </div>
      <section className={`${card} mb-5 space-y-3 p-3.5`}>
        <Skeleton className="h-6 w-44" />
        <div className="flex flex-wrap gap-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14 w-40" />)}</div>
      </section>
      <Skeleton className="mb-2 h-6 w-32" />
      <div className={`${card} overflow-x-auto`}>
        <div className="grid min-w-[640px]" style={{ gridTemplateColumns: `84px repeat(${cols}, minmax(180px, 1fr))` }}>
          <div className="border-b border-r border-slate-300 p-2.5 dark:border-slate-700" />
          {Array.from({ length: cols }).map((_, i) => (
            <div key={i} className="space-y-2 border-b border-r border-slate-300 p-2.5 last:border-r-0 dark:border-slate-700"><Skeleton className="h-5 w-24" /><Skeleton className="h-3 w-36" /></div>
          ))}
          {[0, 1].map((r) => (
            <div key={r} className="contents">
              <div className="border-r border-slate-300 p-2.5 dark:border-slate-700"><Skeleton className="h-4 w-14" /></div>
              {Array.from({ length: cols }).map((_, i) => (
                <div key={i} className="space-y-2 border-r border-slate-300 p-2.5 last:border-r-0 dark:border-slate-700"><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /></div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

export function TaskListSkeleton({ sections = 2, rows = 3 }: { sections?: number; rows?: number }) {
  return (
    <>
      {Array.from({ length: sections }).map((_, s) => (
        <div key={s} className="mb-6">
          <Skeleton className="mb-2 h-6 w-40" />
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className={`${card} mb-1.5 flex flex-wrap items-center gap-x-4 gap-y-2 border-l-4 !border-l-slate-300 px-3 py-2 dark:!border-l-slate-600`}>
              <div className="min-w-0 flex-1 basis-52 space-y-2"><Skeleton className="h-4 w-20" /><Skeleton className="h-3 w-48 max-w-full" /></div>
              <div className="flex gap-1.5"><Skeleton className="h-8 w-28" /><Skeleton className="h-8 w-16" /></div>
            </div>
          ))}
        </div>
      ))}
    </>
  );
}

export function MembersSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <>
      <div className="mb-4 flex items-center gap-2"><Skeleton className="mr-auto h-6 w-32" /><Skeleton className="h-9 w-28" /></div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className={`${card} mb-1.5 flex flex-wrap items-center gap-x-4 gap-y-2 border-l-4 !border-l-slate-300 px-3 py-2 dark:!border-l-slate-600`}>
          <div className="min-w-0 flex-1 basis-52 space-y-2"><Skeleton className="h-4 w-36" /><Skeleton className="h-4 w-52 max-w-full" /></div>
          <div className="flex gap-1.5"><Skeleton className="h-8 w-28" /><Skeleton className="h-8 w-24" /></div>
        </div>
      ))}
    </>
  );
}

export function TeamSkeleton() {
  return (
    <Status>
      <HeaderSkeleton tabs={4} />
      <main className="mx-auto max-w-[1500px] px-4 pb-12 pt-5 sm:px-8"><BoardSkeleton /></main>
    </Status>
  );
}
