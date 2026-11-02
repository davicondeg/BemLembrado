alter table public.assisted_people
  add column if not exists archived_at timestamptz;

create index if not exists assisted_people_owner_archived_idx
  on public.assisted_people (owner_id, archived_at, created_at desc);
