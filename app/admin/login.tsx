import { useEffect } from 'react';
import { useRouter } from 'expo-router';

/** Personel/admin girişi artık tek giriş modülü (/auth) üzerinden. */
export default function AdminLoginRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/auth');
  }, [router]);
  return null;
}
