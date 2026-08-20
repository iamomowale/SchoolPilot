"use client";

import { useState } from 'react';
import { api, type ApiResponse } from '../../../../lib/api';

export default function CsvImportPage() {
  const [csv, setCsv] = useState('admissionNumber,firstName,lastName\nA100,Ada,Lovelace');
  const [preview, setPreview] = useState<Array<Record<string, unknown>>>([]);
  const [errors, setErrors] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  function parseRows(text: string) {
    const lines = text.trim().split(/\r?\n/).filter(Boolean);
    const [header, ...rows] = lines;
    const columns = header.split(',');
    return rows.map((row) => {
      const values = row.split(',');
      return Object.fromEntries(columns.map((column, index) => [column.trim(), values[index]?.trim() ?? '']));
    });
  }

  async function handlePreview() {
    setLoading(true);
    setMessage(null);
    try {
      const rows = parseRows(csv);
      const result = await api<ApiResponse<{ preview: Array<Record<string, unknown>>; errors: Array<Record<string, unknown>>; summary?: { totalRows?: number } }>>('/student-management/import/csv/preview', { method: 'POST', body: JSON.stringify({ rows }) });
      setPreview(result.data.preview ?? []);
      setErrors(result.data.errors ?? []);
      setMessage(`Previewed ${result.data.summary?.totalRows ?? 0} rows.`);
    } catch {
      setMessage('Unable to preview import.');
    } finally {
      setLoading(false);
    }
  }

  async function handleImport() {
    setLoading(true);
    setMessage(null);
    try {
      const rows = parseRows(csv);
      const result = await api<ApiResponse<{ preview: Array<Record<string, unknown>>; errors: Array<Record<string, unknown>>; summary?: { importedRows?: number } }>>('/student-management/import/csv', { method: 'POST', body: JSON.stringify({ rows }) });
      setPreview(result.data.preview ?? []);
      setErrors(result.data.errors ?? []);
      setMessage(`Imported ${result.data.summary?.importedRows ?? 0} rows.`);
    } catch {
      setMessage('Unable to import CSV.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-semibold uppercase tracking-[0.25em] text-sky-600">Import</p>
        <h2 className="text-2xl font-semibold text-slate-900">CSV import preview</h2>
      </header>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <label className="mb-2 block text-sm font-medium text-slate-700" htmlFor="csv-input">Paste CSV</label>
        <textarea id="csv-input" value={csv} onChange={(event) => setCsv(event.target.value)} rows={10} className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm" />
        <div className="mt-4 flex flex-wrap gap-3">
          <button type="button" onClick={handlePreview} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white" disabled={loading}>Preview</button>
          <button type="button" onClick={handleImport} className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white" disabled={loading}>Import</button>
        </div>
        {message ? <p className="mt-4 text-sm text-slate-600">{message}</p> : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900">Preview</h3>
          {preview.length === 0 ? <p className="mt-3 text-sm text-slate-500">No preview rows yet.</p> : <ul className="mt-4 space-y-2">{preview.map((item, index) => <li key={index} className="rounded-lg bg-slate-50 px-3 py-2 text-sm">{JSON.stringify(item)}</li>)}</ul>}
        </section>
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900">Validation errors</h3>
          {errors.length === 0 ? <p className="mt-3 text-sm text-slate-500">No validation errors found.</p> : <ul className="mt-4 space-y-2">{errors.map((item, index) => <li key={index} className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{JSON.stringify(item)}</li>)}</ul>}
        </section>
      </div>
    </div>
  );
}
