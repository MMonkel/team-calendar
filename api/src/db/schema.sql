-- Eén tabel voor alle drie de aanvraagtypes (absence/move/revert): ze delen
-- vrijwel alle kolommen en worden altijd samen als tijdlijn getoond.
create table if not exists requests (
  id            text primary key,
  type          text not null check (type in ('absence', 'move', 'revert')),
  kind          text check (kind in ('day', 'vacation')),
  person        text not null,
  target_id     text references requests(id),
  orig_from     date,
  orig_to       date,
  from_date     date not null,
  to_date       date not null,
  replacements  jsonb not null default '{}'::jsonb,
  note          text not null default '',
  status        text not null default 'draft'
                  check (status in ('draft', 'approved', 'rejected', 'cancelled')),
  short_notice  boolean not null default false,
  created_at    timestamptz not null default now(),
  reviewed_by   text,
  reviewed_at   timestamptz,
  comment       text
);

create index if not exists requests_person_idx on requests (person);
create index if not exists requests_status_idx on requests (status);
create index if not exists requests_range_idx on requests (from_date, to_date);

-- Activiteiten die een admin op een hele dag plant (teamuitje, training, ...),
-- zodat iedereen in de kalender ziet dat er die dag iets is. Los van het
-- rooster: ze veranderen niets aan wie er staat.
create table if not exists activities (
  id          text primary key,
  date        date not null,
  title       text not null,
  note        text not null default '',
  created_by  text not null,
  created_at  timestamptz not null default now()
);

create index if not exists activities_date_idx on activities (date);
