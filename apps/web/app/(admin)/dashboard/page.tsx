"use client";

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { api, type ApiResponse, type Student } from '../../../lib/api';
import { ErrorState, LoadingState } from '../../../components/ui';

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState({ students: 0, branches: 0, classes: 0, guardians: 0 });
  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [students, branches, classes, guardians] = await Promise.all([
        api<ApiResponse<Student[]>>('/student-management/students'), api<ApiResponse<unknown[]>>('/school-config/branches'), api<ApiResponse<unknown[]>>('/school-config/classes'), api<ApiResponse<unknown[]>>('/student-management/guardians'),
      ]);
      setSummary({ students: students.data.length, branches: branches.data.length, classes: classes.data.length, guardians: guardians.data.length });
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to load the dashboard.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const cards = [{ label: 'Students', value: summary.students, href: '/students' }, { label: 'Guardians', value: summary.guardians, href: '/guardians' }, { label: 'Classes', value: summary.classes, href: '/setup' }, { label: 'Branches', value: summary.branches, href: '/setup' }];
  return <div className="space-y-7">
    <header className="flex flex-wrap items-end justify-between gap-4"><div><p className="eyebrow">Overview</p><h2 className="page-title">Good to see you</h2><p className="mt-2 text-sm text-slate-600">Keep your school records organised from one place.</p></div><Link href="/students/enrollment" className="button-primary">Enroll a student</Link></header>
    {loading ? <LoadingState label="Loading your school overview…" /> : null}{error ? <ErrorState message={error} onRetry={() => void load()} /> : null}
    {!loading && !error ? <><section aria-label="School totals" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{cards.map((card) => <Link key={card.label} href={card.href} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-sky-200"><p className="text-sm text-slate-500">{card.label}</p><p className="mt-3 text-3xl font-bold tracking-tight">{card.value}</p><p className="mt-3 text-sm font-semibold text-sky-700">Manage →</p></Link>)}</section>
    <section className="grid gap-4 md:grid-cols-3"><Link href="/students" className="action-card"><h3>Find a student</h3><p>Search records and view profiles.</p></Link><Link href="/students/import" className="action-card"><h3>Import a CSV</h3><p>Preview student rows before import.</p></Link><Link href="/setup" className="action-card"><h3>Set up learning</h3><p>Manage classes, sections and subjects.</p></Link></section></> : null}
  </div>;
}
