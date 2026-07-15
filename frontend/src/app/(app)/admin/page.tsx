'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/context';

export default function AdminPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading || !user) return;
    router.replace(user.role === 'admin' ? '/admin/reporteria' : '/admin/geotab');
  }, [loading, user, router]);

  return null;
}
