-- Add club message tables to the realtime publication so Supabase emits change events.
-- Without this, INSERT/UPDATE on these tables will not be broadcast via Realtime.
alter publication supabase_realtime add table club_messages;
alter publication supabase_realtime add table club_message_reactions;
alter publication supabase_realtime add table club_message_reads;

-- The app uses NextAuth (not Supabase Auth). Browser Supabase clients connect as the
-- anon role, so for Realtime postgres_changes to deliver events, anon needs SELECT.
-- All writes happen through authenticated server actions (Drizzle), so a read-only
-- policy for anon is safe.
drop policy if exists "Allow realtime for authenticated" on club_messages;
drop policy if exists "anon_select_club_messages" on club_messages;

create policy "anon_select_club_messages"
  on club_messages
  for select
  to anon
  using (true);
