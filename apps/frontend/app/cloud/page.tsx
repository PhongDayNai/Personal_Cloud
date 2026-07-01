'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function CloudRedirect(): null {
  const router = useRouter();

  useEffect(() => {
    router.replace('/cloud/all');
  }, [router]);

  return null;
}
