-- Feed paylaşımları: sadece metin (medya olmadan) da paylaşılabilsin
ALTER TABLE public.feed_posts DROP CONSTRAINT IF EXISTS feed_posts_media_type_check;
ALTER TABLE public.feed_posts ADD CONSTRAINT feed_posts_media_type_check
  CHECK (media_type IN ('image', 'video', 'text'));

ALTER TABLE public.feed_posts ALTER COLUMN media_url DROP NOT NULL;

COMMENT ON COLUMN public.feed_posts.media_type IS 'image, video veya text (sadece metin paylaşımı)';
