-- Valoria Hotel - POI & Map System (Harita, restoran, eczane, hastane, jandarma vb.)
-- Karma sistem: Önce kendi DB, yoksa Overpass API'den çekilip buraya yazılır.

-- POI tipleri: restaurant, cafe, hotel, pharmacy, hospital, police (jandarma/karakol)
CREATE TABLE IF NOT EXISTS public.pois (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id TEXT UNIQUE, -- Overpass node id (örn. node/12345) - tekrar çekmeyi önler
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('restaurant', 'cafe', 'hotel', 'pharmacy', 'hospital', 'police', 'other')),
  lat DECIMAL(10, 8) NOT NULL,
  lng DECIMAL(11, 8) NOT NULL,
  address TEXT,
  phone TEXT,
  website TEXT,
  hours TEXT,
  rating DECIMAL(3, 2), -- 0-5
  reviews_count INTEGER DEFAULT 0,
  image_url TEXT,
  raw_tags JSONB, -- OSM tags (opening_hours, amenity vb.) ham saklama
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'overpass')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pois_type ON public.pois(type);
CREATE INDEX IF NOT EXISTS idx_pois_lat_lng ON public.pois(lat, lng);
CREATE INDEX IF NOT EXISTS idx_pois_external_id ON public.pois(external_id) WHERE external_id IS NOT NULL;

-- POI yorumları (uygulama içi puan/yorum - isteğe bağlı genişletilebilir)
CREATE TABLE IF NOT EXISTS public.poi_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poi_id UUID NOT NULL REFERENCES public.pois(id) ON DELETE CASCADE,
  guest_id UUID REFERENCES public.guests(id) ON DELETE SET NULL,
  author_name TEXT,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_poi_reviews_poi ON public.poi_reviews(poi_id);

-- RLS: Herkes (anon) pois ve poi_reviews okuyabilsin (müşteri uygulaması). Yazma sadece service_role veya admin.
ALTER TABLE public.pois ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poi_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pois_read_all" ON public.pois;
CREATE POLICY "pois_read_all" ON public.pois FOR SELECT USING (true);

-- INSERT/UPDATE: sadece giriş yapmış kullanıcı (müşteri uygulaması Overpass cache için) veya service_role. Prod'da Edge Function ile kısıtlanabilir.
DROP POLICY IF EXISTS "pois_insert_service" ON public.pois;
CREATE POLICY "pois_insert_service" ON public.pois FOR INSERT WITH CHECK (auth.role() = 'authenticated' OR auth.role() = 'service_role');

DROP POLICY IF EXISTS "pois_update_service" ON public.pois;
CREATE POLICY "pois_update_service" ON public.pois FOR UPDATE USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');

DROP POLICY IF EXISTS "poi_reviews_read_all" ON public.poi_reviews;
CREATE POLICY "poi_reviews_read_all" ON public.poi_reviews FOR SELECT USING (true);

DROP POLICY IF EXISTS "poi_reviews_insert_guest" ON public.poi_reviews;
CREATE POLICY "poi_reviews_insert_guest" ON public.poi_reviews FOR INSERT WITH CHECK (true);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_pois_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS pois_updated_at ON public.pois;
CREATE TRIGGER pois_updated_at
  BEFORE UPDATE ON public.pois
  FOR EACH ROW EXECUTE PROCEDURE public.set_pois_updated_at();

COMMENT ON TABLE public.pois IS 'Harita POI verileri: restoran, eczane, hastane, jandarma vb. Karma: admin/manual + Overpass API.';
COMMENT ON TABLE public.poi_reviews IS 'POI yorumları ve puanları (uygulama içi).';
