-- Story begeni/yanit akisini misafir hesaplari icin ac.

ALTER TABLE public.feed_story_reactions
  ADD COLUMN IF NOT EXISTS guest_id UUID NULL REFERENCES public.guests(id) ON DELETE CASCADE;

ALTER TABLE public.feed_story_reactions
  ALTER COLUMN staff_id DROP NOT NULL;

ALTER TABLE public.feed_story_reactions
  DROP CONSTRAINT IF EXISTS feed_story_reactions_story_id_staff_id_key;

ALTER TABLE public.feed_story_reactions
  DROP CONSTRAINT IF EXISTS feed_story_reactions_single_actor_chk;

ALTER TABLE public.feed_story_reactions
  ADD CONSTRAINT feed_story_reactions_single_actor_chk
  CHECK (num_nonnulls(staff_id, guest_id) = 1);

CREATE UNIQUE INDEX IF NOT EXISTS uq_feed_story_reactions_story_staff
  ON public.feed_story_reactions(story_id, staff_id)
  WHERE staff_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_feed_story_reactions_story_guest
  ON public.feed_story_reactions(story_id, guest_id)
  WHERE guest_id IS NOT NULL;

ALTER TABLE public.feed_story_replies
  ADD COLUMN IF NOT EXISTS guest_id UUID NULL REFERENCES public.guests(id) ON DELETE CASCADE;

ALTER TABLE public.feed_story_replies
  ALTER COLUMN staff_id DROP NOT NULL;

ALTER TABLE public.feed_story_replies
  DROP CONSTRAINT IF EXISTS feed_story_replies_single_actor_chk;

ALTER TABLE public.feed_story_replies
  ADD CONSTRAINT feed_story_replies_single_actor_chk
  CHECK (num_nonnulls(staff_id, guest_id) = 1);

DROP POLICY IF EXISTS "feed_story_reactions_staff_insert_own" ON public.feed_story_reactions;
CREATE POLICY "feed_story_reactions_staff_insert_own"
  ON public.feed_story_reactions
  FOR INSERT TO authenticated
  WITH CHECK (
    (
      staff_id IN (SELECT id FROM public.staff WHERE auth_id = auth.uid())
      AND guest_id IS NULL
    )
    OR (
      guest_id IS NOT NULL
      AND staff_id IS NULL
      AND EXISTS (
        SELECT 1
        FROM public.guests g
        WHERE g.id = guest_id
          AND (
            ((auth.jwt()->>'email') IS NOT NULL AND lower(trim(g.email)) = lower(trim(auth.jwt()->>'email')))
            OR g.auth_user_id = auth.uid()
          )
      )
    )
    AND EXISTS (SELECT 1 FROM public.feed_stories fs WHERE fs.id = story_id AND fs.deleted_at IS NULL AND fs.expires_at > now())
  );

DROP POLICY IF EXISTS "feed_story_reactions_staff_select" ON public.feed_story_reactions;
CREATE POLICY "feed_story_reactions_staff_select"
  ON public.feed_story_reactions
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.staff s WHERE s.auth_id = auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.guests g
      WHERE ((auth.jwt()->>'email') IS NOT NULL AND lower(trim(g.email)) = lower(trim(auth.jwt()->>'email')))
         OR g.auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "feed_story_reactions_staff_delete_own" ON public.feed_story_reactions;
CREATE POLICY "feed_story_reactions_staff_delete_own"
  ON public.feed_story_reactions
  FOR DELETE TO authenticated
  USING (
    staff_id IN (SELECT id FROM public.staff WHERE auth_id = auth.uid())
    OR (
      guest_id IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM public.guests g
        WHERE g.id = guest_id
          AND (
            ((auth.jwt()->>'email') IS NOT NULL AND lower(trim(g.email)) = lower(trim(auth.jwt()->>'email')))
            OR g.auth_user_id = auth.uid()
          )
      )
    )
  );

DROP POLICY IF EXISTS "feed_story_replies_staff_insert_own" ON public.feed_story_replies;
CREATE POLICY "feed_story_replies_staff_insert_own"
  ON public.feed_story_replies
  FOR INSERT TO authenticated
  WITH CHECK (
    (
      staff_id IN (SELECT id FROM public.staff WHERE auth_id = auth.uid())
      AND guest_id IS NULL
    )
    OR (
      guest_id IS NOT NULL
      AND staff_id IS NULL
      AND EXISTS (
        SELECT 1
        FROM public.guests g
        WHERE g.id = guest_id
          AND (
            ((auth.jwt()->>'email') IS NOT NULL AND lower(trim(g.email)) = lower(trim(auth.jwt()->>'email')))
            OR g.auth_user_id = auth.uid()
          )
      )
    )
    AND EXISTS (SELECT 1 FROM public.feed_stories fs WHERE fs.id = story_id AND fs.deleted_at IS NULL AND fs.expires_at > now())
  );

DROP POLICY IF EXISTS "feed_story_replies_staff_select" ON public.feed_story_replies;
CREATE POLICY "feed_story_replies_staff_select"
  ON public.feed_story_replies
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.staff s WHERE s.auth_id = auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.guests g
      WHERE ((auth.jwt()->>'email') IS NOT NULL AND lower(trim(g.email)) = lower(trim(auth.jwt()->>'email')))
         OR g.auth_user_id = auth.uid()
    )
  );
