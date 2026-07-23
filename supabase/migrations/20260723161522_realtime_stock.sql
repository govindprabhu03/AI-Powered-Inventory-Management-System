-- Phase 3: broadcast stock level changes over Supabase Realtime.
--
-- Adding a table to the supabase_realtime publication makes Postgres emit its
-- row changes to Realtime, which forwards them to subscribed browsers over a
-- websocket. Realtime enforces RLS for postgres_changes: a subscriber only
-- receives events for rows their SELECT policies allow, so tenant isolation
-- carries through to the live stream too.
--
-- The app uses these events purely as an invalidation signal — "something
-- changed, refetch" — rather than trusting the payload to patch client state.

alter publication supabase_realtime add table public.stock_levels;
