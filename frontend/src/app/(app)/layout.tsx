import { Toaster } from 'sonner';
import { Navbar } from '@/components/layout/Navbar';
import { AuthGuard } from '@/components/auth/AuthGuard';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <div className="flex h-dvh flex-col">
        <Navbar />
        <main className="relative min-h-0 flex-1">{children}</main>
      </div>
      <Toaster position="bottom-center" richColors closeButton duration={3000} />
    </AuthGuard>
  );
}
