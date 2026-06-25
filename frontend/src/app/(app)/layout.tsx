import { Toaster } from 'sonner';
import { LeftSidebar } from '@/components/layout/LeftSidebar';
import { AuthGuard } from '@/components/auth/AuthGuard';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <div className="flex h-dvh overflow-hidden">
        <LeftSidebar />
        <main className="relative min-h-0 flex-1 overflow-hidden">{children}</main>
      </div>
      <Toaster position="bottom-center" richColors closeButton duration={3000} />
    </AuthGuard>
  );
}
