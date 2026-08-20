import { PortalLayout } from '../../../components/portal-layout';

export default function TeacherLayout({ children }: { children: React.ReactNode }) {
  return <PortalLayout title="Teacher portal" roles={['teacher', 'school-admin']} links={[{ href: '/teacher', label: 'Classes' }, { href: '/teacher/attendance', label: 'Attendance' }, { href: '/teacher/scores', label: 'Scores' }, { href: '/teacher/results', label: 'Results' }]}>{children}</PortalLayout>;
}
