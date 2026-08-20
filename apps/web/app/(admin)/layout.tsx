"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { userRole } from '../../lib/api';

const links = [
  { href: '/dashboard', label: 'Dashboard', roles: ['school-admin', 'teacher'] },
  { href: '/setup', label: 'School setup', roles: ['school-admin'] },
  { href: '/students', label: 'Students', roles: ['school-admin', 'teacher'] },
  { href: '/guardians', label: 'Guardians', roles: ['school-admin'] },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const visibleLinks = links.filter((link) => link.roles.includes(userRole));
  const navigation = <nav className="space-y-1" aria-label="Admin navigation">{visibleLinks.map((link) => {
    const active = pathname === link.href || (link.href === '/students' && pathname.startsWith('/students'));
    return <Link onClick={() => setOpen(false)} key={link.href} href={link.href} className={`block rounded-xl px-3 py-2.5 text-sm font-medium transition ${active ? 'bg-sky-50 text-sky-800' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}>{link.label}</Link>;
  })}</nav>;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 lg:hidden">
        <span className="font-bold text-sky-700">SchoolPilot</span>
        <button type="button" aria-expanded={open} aria-controls="mobile-navigation" onClick={() => setOpen(!open)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold">Menu</button>
      </header>
      {open ? <div id="mobile-navigation" className="border-b border-slate-200 bg-white p-4 lg:hidden">{navigation}</div> : null}
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-slate-200 bg-white px-5 py-7 lg:block">
        <div className="mb-9 px-3"><p className="text-sm font-bold tracking-wide text-sky-700">SCHOOLPILOT</p><h1 className="mt-2 text-lg font-semibold">School admin</h1><p className="mt-1 text-sm text-slate-500">{userRole.replace('-', ' ')}</p></div>
        {navigation}
      </aside>
      <main className="mx-auto max-w-7xl p-4 sm:p-6 lg:ml-64 lg:p-8">{children}</main>
    </div>
  );
}
