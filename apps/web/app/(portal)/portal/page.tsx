import Link from 'next/link';

export default function PortalHomePage() {
  return <div className="space-y-6"><header><p className="eyebrow">Academics</p><h1 className="page-title">My academic record</h1><p className="mt-2 text-sm text-slate-600">Review attendance and published term results.</p></header><div className="grid gap-4 sm:grid-cols-2"><Link href="/portal/attendance" className="action-card"><h2>Attendance summary</h2><p>View present, absent, late and excused attendance counts.</p></Link><Link href="/portal/results" className="action-card"><h2>Published results</h2><p>Review and download available report cards.</p></Link></div></div>;
}
