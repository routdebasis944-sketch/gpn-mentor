CREATE TABLE public.video_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  item_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, item_key)
);
GRANT SELECT, INSERT, DELETE ON public.video_progress TO authenticated;
GRANT ALL ON public.video_progress TO service_role;
ALTER TABLE public.video_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own video progress" ON public.video_progress FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users add own video progress" ON public.video_progress FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users remove own video progress" ON public.video_progress FOR DELETE TO authenticated USING (auth.uid() = user_id);