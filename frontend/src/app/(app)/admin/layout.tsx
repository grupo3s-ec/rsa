import { RoleGuard } from '@/components/auth/RoleGuard';
import { AdminNav } from '@/components/admin/AdminNav';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <RoleGuard allowedRoles={['admin', 'operator']}>
      <div className="flex h-full flex-col">
        <AdminNav />
        <div className="min-h-0 flex-1 overflow-y-auto p-6">
          {children}
        </div>
      </div>
    </RoleGuard>
  );
}
