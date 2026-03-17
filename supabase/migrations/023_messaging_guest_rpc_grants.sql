-- Yeni sohbet: Müşteri/misafir uygulamasında personel listesi RPC'sinin anon ve authenticated ile çağrılabilmesi.
-- RPC SECURITY DEFINER olsa bile, rolün EXECUTE yetkisi olmalı; yoksa "kullanıcı bulunamadı" / boş liste görünür.

GRANT EXECUTE ON FUNCTION public.messaging_list_staff_for_guest() TO anon;
GRANT EXECUTE ON FUNCTION public.messaging_list_staff_for_guest() TO authenticated;
