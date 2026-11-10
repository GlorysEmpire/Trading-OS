-- Internal event-trigger function: the database trigger can continue to call
-- it, but app API roles must not be able to invoke it directly as an RPC.
revoke all on function public.rls_auto_enable() from public, anon, authenticated;
