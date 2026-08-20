import type { ReactNode } from 'react';

export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return <div role="status" className="rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-500">{label}</div>;
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800"><span>{message}</span>{onRetry ? <button onClick={onRetry} className="rounded-lg border border-rose-300 px-3 py-1.5 font-semibold">Try again</button> : null}</div>;
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center"><h3 className="font-semibold text-slate-800">{title}</h3>{children ? <div className="mt-2 text-sm text-slate-500">{children}</div> : null}</div>;
}

export function PermissionDenied({ message = 'You do not have permission to view this area.' }: { message?: string }) {
  return <div role="alert" className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900"><h2 className="font-semibold">Access restricted</h2><p className="mt-1">{message}</p></div>;
}

export function StatusBadge({ value }: { value?: string }) {
  const status = value || 'active';
  return <span className={status.toLowerCase() === 'active' ? 'rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold capitalize text-emerald-700' : 'rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold capitalize text-slate-600'}>{status}</span>;
}
