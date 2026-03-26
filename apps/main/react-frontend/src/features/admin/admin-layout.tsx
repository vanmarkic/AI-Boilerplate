import { Outlet, NavLink } from 'react-router-dom';
import { PageLayout, PageHeader, TabNav } from '@aspect/react-ui';

export default function AdminLayout() {
  // TabLink from @aspect/react-ui wraps <a> — for React Router active-state
  // tracking, use NavLink directly with the same CSS classes.
  return (
    <PageLayout
      header={
        <PageHeader title="Administration" subtitle="Manage users and permissions" />
      }
    >
      <TabNav>
        <NavLink to="/admin/permissions" className={({ isActive }) => `tab-link${isActive ? ' active' : ''}`}>
          Permissions
        </NavLink>
        <NavLink to="/admin/users" className={({ isActive }) => `tab-link${isActive ? ' active' : ''}`}>
          Users
        </NavLink>
      </TabNav>
      <div className="p-lg">
        <Outlet />
      </div>
    </PageLayout>
  );
}
