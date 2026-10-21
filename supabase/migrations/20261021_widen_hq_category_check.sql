-- Fix: trading_hq_configs_category_check was deployed with only 6 of the
-- app's 7 category values, missing "process_score" (the 5-part
-- Session/Grade/Risk/Management/Structure process checklist). Every HQ
-- load was failing to seed/insert that category with a 23514 check
-- constraint violation, which TradingContext.tsx then showed as a
-- generic "Failed to load Trading HQ" (see src/lib/supabaseErrors.ts
-- for why the real message wasn't surfacing before).
--
-- Run this once in the Supabase SQL Editor against the live project.

ALTER TABLE trading_hq_configs DROP CONSTRAINT trading_hq_configs_category_check;

ALTER TABLE trading_hq_configs ADD CONSTRAINT trading_hq_configs_category_check
  CHECK (category = ANY (ARRAY[
    'risk'::text,
    'setup_quality'::text,
    'execution_model'::text,
    'session'::text,
    'research_framework'::text,
    'mistake_code'::text,
    'process_score'::text
  ]));
