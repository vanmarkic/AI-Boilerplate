import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { PageLayout, PageHeader, TabNav, TabLink } from '@aspect/react-ui';

export default function AdminLayout() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const activeTab = pathname.startsWith('/admin/users') ? 'users' : 'permissions';

  return (
    <PageLayout
      header={
        <PageHeader title="Administration" subtitle="Manage users and permissions" />
      }
    >
      <TabNav value={activeTab} onValueChange={(v) => void navigate(`/admin/${v}`)}>
        <TabLink value="permissions">Permissions</TabLink>
        <TabLink value="users">Users</TabLink>
      </TabNav>
      <div className="p-lg">
        <Outlet />
      </div>
    </PageLayout>
  );
}
