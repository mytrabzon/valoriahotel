ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS group_theme_color TEXT
  CHECK (
    group_theme_color IS NULL
    OR group_theme_color ~ '^#([A-Fa-f0-9]{6})$'
  );

COMMENT ON COLUMN public.conversations.group_theme_color IS
  'Grup sohbeti için seçilen tema rengi (#RRGGBB).';
