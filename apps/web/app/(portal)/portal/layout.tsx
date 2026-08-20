import { PortalLayout } from '../../../components/portal-layout';

export default function AcademicPortalLayout({ children }: { children: React.ReactNode }) {
  return <PortalLayout title="Academic portal" roles={['parent', 'student', 'school-admin']} links={[{ href: '/portal', label: 'Overview' }, { href: '/portal/attendance', label: 'Attendance' }, { href: '/portal/results', label: 'Results' }]}>{children}</PortalLayout>;
}
