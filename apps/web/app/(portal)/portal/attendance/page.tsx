"use client";

import { useCallback, useEffect, useState } from 'react';
import { api, type ApiResponse } from '../../../../lib/api';
import { EmptyState, ErrorState, LoadingState } from '../../../../components/ui';
type Summary = { byStudent: Array<{ studentId: string; status: string; _count: { _all: number } }> };
export default function AttendanceSummaryPage() {
  const [loading, setLoading] = useState(true); const [error, setError] = useState<string | null>(null); const [summary, setSummary] = useState<Summary | null>(null);
  const load = useCallback(async () => { setLoading(true); setError(null); try { setSummary((await api<ApiResponse<Summary>>('/attendance/my-summary')).data); } catch (err) { setError(err instanceof Error ? err.message : 'Unable to load attendance summary.'); } finally { setLoading(false); } }, []);
  useEffect(() => { void load(); }, [load]); const totals = summary?.byStudent.reduce<Record<string, number>>((result, item) => ({ ...result, [item.status]: (result[item.status] || 0) + item._count._all }), {}) || {};
  return <div className="mx-auto max-w-2xl space-y-6"><header><p className="eyebrow">Attendance</p><h1 className="page-title">Attendance summary</h1><p className="mt-2 text-sm text-slate-600">View attendance totals for your linked student record.</p></header>{loading ? <LoadingState label="Loading attendance summary…" /> : null}{error ? <ErrorState message={error} onRetry={() => void load()} /> : null}{summary && !summary.byStudent.length ? <EmptyState title="No attendance has been recorded yet." /> : null}{Object.keys(totals).length ? <section className="grid grid-cols-2 gap-4 sm:grid-cols-4">{Object.entries(totals).map(([status, count]) => <article key={status} className="panel text-center"><p className="text-sm capitalize text-slate-600">{status}</p><p className="mt-2 text-3xl font-bold">{count}</p></article>)}</section> : null}</div>;
}
