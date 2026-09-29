CREATE TABLE public.lab_modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch text NOT NULL,
  semester int NOT NULL,
  title text NOT NULL,
  description text,
  source_url text UNIQUE,
  sim_type text,
  is_official boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.lab_modules TO anon, authenticated;
GRANT ALL ON public.lab_modules TO service_role;
ALTER TABLE public.lab_modules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view lab modules" ON public.lab_modules FOR SELECT TO anon, authenticated USING (true);

CREATE TABLE public.lab_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  module_id uuid NOT NULL REFERENCES public.lab_modules(id) ON DELETE CASCADE,
  score int NOT NULL,
  mistakes jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.lab_attempts TO authenticated;
GRANT ALL ON public.lab_attempts TO service_role;
ALTER TABLE public.lab_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own attempts" ON public.lab_attempts FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own attempts" ON public.lab_attempts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.lab_sync_state (
  id int PRIMARY KEY DEFAULT 1,
  locked_until timestamptz,
  last_run_at timestamptz,
  last_added int NOT NULL DEFAULT 0,
  last_error text
);
GRANT SELECT ON public.lab_sync_state TO anon, authenticated;
GRANT ALL ON public.lab_sync_state TO service_role;
ALTER TABLE public.lab_sync_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view sync state" ON public.lab_sync_state FOR SELECT TO anon, authenticated USING (true);
INSERT INTO public.lab_sync_state (id) VALUES (1);

INSERT INTO public.lab_modules (branch, semester, title, description, sim_type) VALUES
('Electrical', 3, 'Verification of Ohm''s Law', 'Measure current for different voltages across a fixed resistor and verify V = IR.', 'ohms_law'),
('Electrical', 3, 'Series and Parallel Resistors', 'Find the equivalent resistance of resistors in series and in parallel.', 'series_parallel'),
('Electrical', 4, 'Wheatstone Bridge', 'Balance the bridge to find an unknown resistance.', 'wheatstone'),
('Electronics', 3, 'Verification of Ohm''s Law', 'Measure current for different voltages and verify V = IR.', 'ohms_law'),
('Common (1st Year)', 1, 'Verification of Ohm''s Law (Physics Lab)', 'Engineering Physics practical: verify Ohm''s law.', 'ohms_law'),
('Common (1st Year)', 2, 'Series and Parallel Resistors (Physics Lab)', 'Engineering Physics practical: combination of resistances.', 'series_parallel');