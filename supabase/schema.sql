-- Kill the Santa ranking. Run once in Supabase Dashboard -> SQL Editor.
create table if not exists public.scores (
  id         bigint generated always as identity primary key,
  name       text    not null check (char_length(name) between 1 and 8),
  score      integer not null check (score between 0 and 500000),
  time       integer not null default 0 check (time between 0 and 36000),
  cleared    boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists scores_rank_idx on public.scores (score desc, time asc);

alter table public.scores enable row level security;

-- anyone may read the ranking and add an entry; nobody may edit or delete from the browser
drop policy if exists "read scores"   on public.scores;
drop policy if exists "insert scores" on public.scores;
create policy "read scores"   on public.scores for select to anon using (true);
create policy "insert scores" on public.scores for insert to anon with check (true);
grant select, insert on public.scores to anon;

-- simple flood guard: max 1 insert per 3 seconds overall per name
create or replace function public.scores_guard() returns trigger language plpgsql as $$
begin
  new.name := left(regexp_replace(new.name, '[<>&"''`]', '', 'g'), 8);
  if exists (select 1 from public.scores where name = new.name and created_at > now() - interval '3 seconds') then
    raise exception 'too fast';
  end if;
  return new;
end $$;
drop trigger if exists scores_guard on public.scores;
create trigger scores_guard before insert on public.scores for each row execute function public.scores_guard();
