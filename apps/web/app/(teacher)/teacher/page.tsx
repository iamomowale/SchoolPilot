"use client";

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { api, type ApiResponse } from '../../../lib/api';
import { EmptyState, ErrorState, LoadingState } from '../../../components/ui';
type Class = { id: string; name: string; code: string };
type Section = { id: string; name: string; classId: string };

export default function TeacherClassesPage() {
  const [classes, setClasses] = useState<Class[]>([]); const [sections, setSections] = useState<Section[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => { setLoading(true); setError(null); try { const [classResponse, sectionResponse] = await Promise.all([api<ApiResponse<Class[]>>('/school-config/classes'), api<ApiResponse<Section[]>>('/school-config/sections')]); setClasses(classResponse.data); setSections(sectionResponse.data); } catch (err) { setError(err instanceof Error ? err.message : 'Unable to load assigned classes.'); } finally { setLoading(false); } }, []);
  useEffect(() => { void load(); }, [load]);
  return <div className="space-y-6"><header><p className="eyebrow">Teaching</p><h1 className="page-title">My assigned classes</h1><p className="mt-2 text-sm text-slate-600">Only classes assigned to your teacher account are shown.</p></header>{loading ? <LoadingState label="Loading your classes…" /> : null}{error ? <ErrorState message={error} onRetry={() => void load()} /> : null}{!loading && !error && !classes.length ? <EmptyState title="No classes are assigned to you yet.">Ask a school administrator to assign your class and section.</EmptyState> : null}<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{classes.map((item) => <article key={item.id} className="panel"><p className="text-xs font-bold uppercase tracking-wide text-sky-700">{item.code}</p><h2 className="mt-2 text-lg font-semibold">{item.name}</h2><p className="mt-3 text-sm text-slate-600">Sections: {sections.filter((section) => section.classId === item.id).map((section) => section.name).join(', ') || 'None assigned'}</p><div className="mt-5 flex gap-3"><Link className="text-sm font-semibold text-sky-700" href="/teacher/attendance">Take attendance</Link><Link className="text-sm font-semibold text-sky-700" href="/teacher/scores">Enter scores</Link></div></article>)}</div></div>;
}
