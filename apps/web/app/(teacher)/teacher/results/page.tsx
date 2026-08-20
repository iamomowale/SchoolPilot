"use client";

import { useState } from 'react';
import { api } from '../../../../lib/api';
import { ErrorState } from '../../../../components/ui';
export default function SubmitResultsPage() {
  const [sheetId, setSheetId] = useState(''); const [saving, setSaving] = useState(false); const [notice, setNotice] = useState<string | null>(null); const [denied, setDenied] = useState(false);
  async function submit(event: React.FormEvent) { event.preventDefault(); setSaving(true); setNotice(null); setDenied(false); try { await api(`/results/sheets/${sheetId}/status`, { method: 'PATCH', body: JSON.stringify({ status: 'submitted' }) }); setNotice('Results submitted for school-admin approval. Scores are now read-only.'); } catch (err) { const message = err instanceof Error ? err.message : 'Unable to submit results.'; setDenied(/permission|assigned|access/i.test(message)); setNotice(message); } finally { setSaving(false); } }
  return <div className="mx-auto max-w-xl space-y-6"><header><p className="eyebrow">Results</p><h1 className="page-title">Submit results</h1><p className="mt-2 text-sm text-slate-600">Submit a completed draft result sheet for approval. Published sheets remain read-only.</p></header>{denied ? <ErrorState message="You do not have permission to submit this result sheet. Confirm that you are assigned to its class and section." /> : null}<form onSubmit={submit} className="panel space-y-4"><div><label className="label" htmlFor="sheet">Result sheet ID</label><input id="sheet" required className="field" value={sheetId} onChange={(e) => setSheetId(e.target.value)} /></div><button disabled={saving} className="button-primary">{saving ? 'Submitting…' : 'Submit for approval'}</button>{notice ? <p role="status" className="text-sm text-slate-600">{notice}</p> : null}</form></div>;
}
