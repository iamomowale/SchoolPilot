"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { type ReactNode } from 'react';
import { userRole } from '../lib/api';
import { PermissionDenied } from './ui';

type Item = { href: string; label: string };
export function PortalLayout({ children, title, roles, links }: { children: ReactNode; title: string; roles: string[]; links: Item[] }) {
  const pathname = usePathname();
  if (!roles.includes(userRole)) return <main className="mx-auto max-w-3xl p-6"><PermissionDenied message={`This portal is available to ${roles.join(' or ')} accounts.`} /></main>;
  return <div className="min-h-screen bg-slate-50"><header className="border-b border-slate-200 bg-white"><div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6"><div><Link href={links[0]?.href || '/'} className="font-bold text-sky-700">SchoolPilot</Link><p className="text-sm text-slate-500">{title}</p></div><nav className="flex flex-wrap gap-1" aria-label={`${title} navigation`}>{links.map((link) => <Link key={link.href} href={link.href} className={`rounded-lg px-3 py-2 text-sm font-semibold ${pathname === link.href ? 'bg-sky-50 text-sky-800' : 'text-slate-600 hover:bg-slate-100'}`}>{link.label}</Link>)}</nav></div></header><main className="mx-auto max-w-7xl p-4 sm:p-6">{children}</main></div>;
}
