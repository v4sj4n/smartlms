-- Run this in Supabase SQL editor after applying Drizzle migrations.

create extension if not exists vector;

-- Vector and text indexes for hybrid retrieval
create index if not exists idx_file_chunks_embedding
on file_chunks using ivfflat (embedding vector_cosine_ops) with (lists = 100);

create index if not exists idx_file_chunks_tsv
on file_chunks using gin (to_tsvector('english', chunk_text));

-- Realtime-focused indexes
create index if not exists idx_club_messages_club_created_desc
on club_messages (club_id, created_at desc)
where deleted_at is null;

create index if not exists idx_club_message_reads_message
on club_message_reads (message_id, user_id);

-- Enable RLS
alter table clubs enable row level security;
alter table club_members enable row level security;
alter table club_messages enable row level security;
alter table club_message_reactions enable row level security;
alter table club_message_reads enable row level security;
alter table files enable row level security;
alter table file_chunks enable row level security;
alter table chatbots enable row level security;
alter table chatbot_conversations enable row level security;
alter table chatbot_messages enable row level security;

-- NOTE: These policies assume auth.uid() maps to users.id UUIDs.

drop policy if exists "club_members_can_select_club_messages" on club_messages;
create policy "club_members_can_select_club_messages"
on club_messages for select
using (
  exists (
    select 1 from club_members cm
    where cm.club_id = club_messages.club_id
      and cm.user_id = auth.uid()
  )
);

drop policy if exists "club_members_can_insert_club_messages" on club_messages;
create policy "club_members_can_insert_club_messages"
on club_messages for insert
with check (
  author_id = auth.uid()
  and exists (
    select 1 from club_members cm
    where cm.club_id = club_messages.club_id
      and cm.user_id = auth.uid()
  )
);

drop policy if exists "members_can_react" on club_message_reactions;
create policy "members_can_react"
on club_message_reactions for all
using (
  user_id = auth.uid()
)
with check (
  user_id = auth.uid()
);

drop policy if exists "subject_members_can_read_files" on files;
create policy "subject_members_can_read_files"
on files for select
using (
  deleted_at is null
  and (
    uploaded_by = auth.uid()
    or exists (
      select 1 from course_enrollments ce
      where ce.course_id = files.subject_id
        and ce.student_id = auth.uid()
    )
  )
);

drop policy if exists "professors_can_write_files" on files;
create policy "professors_can_write_files"
on files for insert
with check (uploaded_by = auth.uid());

drop policy if exists "users_own_conversations" on chatbot_conversations;
create policy "users_own_conversations"
on chatbot_conversations for all
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "users_own_messages" on chatbot_messages;
create policy "users_own_messages"
on chatbot_messages for all
using (
  exists (
    select 1 from chatbot_conversations cc
    where cc.id = chatbot_messages.conversation_id
      and cc.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from chatbot_conversations cc
    where cc.id = chatbot_messages.conversation_id
      and cc.user_id = auth.uid()
  )
);
