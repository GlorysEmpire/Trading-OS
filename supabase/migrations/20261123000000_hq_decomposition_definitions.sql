-- M1 (Market Decomposition): allow the 'decomposition_definitions' Trading HQ
-- category. Definitions are versioned like every other HQ category: a save
-- deactivates the old row and inserts the next version through
-- trading_os_replace_hq_category, so older versions stay readable.
-- Only the category check changes; no data is touched.

ALTER TABLE public.trading_hq_configs DROP CONSTRAINT IF EXISTS trading_hq_configs_category_check;

ALTER TABLE public.trading_hq_configs ADD CONSTRAINT trading_hq_configs_category_check
  CHECK (category = ANY (ARRAY[
    'risk'::text,
    'setup_quality'::text,
    'execution_model'::text,
    'session'::text,
    'research_framework'::text,
    'mistake_code'::text,
    'process_score'::text,
    'focus_rotation'::text,
    'decomposition_definitions'::text
  ]));
