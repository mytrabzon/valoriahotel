-- Feed yorumlari icin tek seviye reply destegi (V1)

ALTER TABLE public.feed_post_comments
  ADD COLUMN IF NOT EXISTS parent_comment_id UUID NULL REFERENCES public.feed_post_comments(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS is_edited BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'feed_post_comments_status_check'
  ) THEN
    ALTER TABLE public.feed_post_comments
      ADD CONSTRAINT feed_post_comments_status_check
      CHECK (status IN ('active', 'hidden', 'deleted'));
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS idx_feed_comments_post_parent_created
  ON public.feed_post_comments(post_id, parent_comment_id, created_at);

CREATE INDEX IF NOT EXISTS idx_feed_comments_parent
  ON public.feed_post_comments(parent_comment_id);

CREATE OR REPLACE FUNCTION public.enforce_feed_comment_reply_rules()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  parent_row public.feed_post_comments%ROWTYPE;
BEGIN
  IF NEW.parent_comment_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT *
  INTO parent_row
  FROM public.feed_post_comments
  WHERE id = NEW.parent_comment_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Parent comment not found';
  END IF;

  IF parent_row.post_id <> NEW.post_id THEN
    RAISE EXCEPTION 'Reply post_id mismatch';
  END IF;

  IF parent_row.parent_comment_id IS NOT NULL THEN
    RAISE EXCEPTION 'Only one-level replies are allowed';
  END IF;

  IF parent_row.status <> 'active' THEN
    RAISE EXCEPTION 'Parent comment is not active';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_feed_comment_reply_rules ON public.feed_post_comments;
CREATE TRIGGER trg_feed_comment_reply_rules
BEFORE INSERT OR UPDATE OF parent_comment_id, post_id
ON public.feed_post_comments
FOR EACH ROW
EXECUTE FUNCTION public.enforce_feed_comment_reply_rules();
