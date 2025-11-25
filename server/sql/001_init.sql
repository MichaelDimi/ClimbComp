create extension if not exists "uuid-ossp";

create table if not exists users (
    id            uuid primary key default gen_random_uuid(),
    display_name  text not null,
    email         text not null unique,
    password_hash text not null,
    created_at    timestamptz default now()
);

create table if not exists venues (
  id        uuid primary key default gen_random_uuid(),
  name      text not null,
  latitude   double precision not null,
  longitude  double precision not null,
  created_at timestamptz default now()
);

create table if not exists competitions (
  id uuid      primary key default gen_random_uuid(),
  title        text not null,
  description  text,
  is_public    boolean not null default true,
  venue_id     uuid references venues(id) on delete set null,
  starts_at    timestamptz,
  ends_at      timestamptz,
  show_grades  boolean not null default false,
  scoring_mode text not null default 'TOPS_ATTEMPTS',
  rules        text[] not null default '{}',
  created_by   uuid references users(id) on delete set null,
  created_at   timestamptz default now()
);

-- Link competitions to their admins (can be multiple admins per comp)
create table if not exists competition_admins (
  competition_id uuid not null references competitions(id) on delete cascade,
  user_id        uuid not null references users(id) on delete cascade,
  primary key (competition_id, user_id)
);

-- Divisions/categories within a competition (Beginner, Advanced, Open, etc.)
create table if not exists divisions (
  id             uuid primary key default gen_random_uuid(),
  competition_id uuid not null references competitions(id) on delete cascade,
  name           text not null,
  sort_order     integer,
  created_at     timestamptz default now(),
  unique (competition_id, name)
);

-- People registered in a competition, in some division
create table if not exists competition_participants (
  competition_id uuid not null references competitions(id) on delete cascade,
  user_id        uuid not null references users(id) on delete cascade,
  division_id    uuid references divisions(id) on delete set null,
  joined_at      timestamptz not null default now(),
  primary key (competition_id, user_id)
);

-- Problems/routes in a competition
create table if not exists problems (
  id             uuid primary key default gen_random_uuid(),
  competition_id uuid not null references competitions(id) on delete cascade,
  division_id    uuid references divisions(id) on delete set null,
  code           text not null,           -- e.g. B1, R3, etc.
  discipline     text not null,           -- e.g. 'boulder', 'lead'
  grade          text,                    -- e.g. V4, 5.12a
  image_url      text,
  created_at     timestamptz default now(),
  unique (competition_id, code)
);

-- One row per climber per problem, with scoreboard-style summary
create table if not exists ascents (
  problem_id    uuid not null references problems(id) on delete cascade,
  user_id       uuid not null references users(id) on delete cascade,
  topped        boolean not null default false,
  top_attempts  integer,   -- attempts to top (null/0 if never topped)
  zone          boolean not null default false,
  zone_attempts integer,   -- attempts to zone (null/0 if never zoned)
  primary key (problem_id, user_id)
);

-- Indexes ====================================

create index if not exists idx_users_email 
  on users (email);

-- Helpful for filter venues near me
create index if not exists idx_venues_latlon 
  on venues (latitude, longitude); 

create index if not exists idx_divisions_competition
  on divisions (competition_id);

create index if not exists idx_comp_participants_division
  on competition_participants (division_id);

create index if not exists idx_problems_competition
  on problems (competition_id);

create index if not exists idx_ascents_user
  on ascents (user_id);

-- Helpful for date/venue filtering in reports & queries
create index if not exists idx_competitions_venue_start
  on competitions (venue_id, starts_at);


-- Stored Procedures ===============================

-- Function: competition_division_podiums
-- Returns per-division podium (top N climbers) for a competition.
create or replace function competition_division_podiums(
  _competition_id uuid,
  _max_rank integer default 3
)
returns table (
  competition_id uuid,
  division_id uuid,
  division_name text,
  user_id uuid,
  user_display_name text,
  rank integer,
  total_tops integer,
  total_zones integer,
  total_top_attempts integer,
  total_zone_attempts integer
)
language sql
as $$
  with division_problems as (
    select
      p.id as problem_id,
      p.division_id,
      d.name as division_name
    from problems p
    join divisions d on d.id = p.division_id
    where p.competition_id = _competition_id
  ),
  per_user as (
    select
      dp.division_id,
      dp.division_name,
      a.user_id,
      count(*) filter (where a.topped) as total_tops,
      count(*) filter (where a.zone)   as total_zones,
      coalesce(sum(a.top_attempts), 0)  as total_top_attempts,
      coalesce(sum(a.zone_attempts), 0) as total_zone_attempts
    from division_problems dp
    join ascents a on a.problem_id = dp.problem_id
    group by dp.division_id, dp.division_name, a.user_id
  ),
  ranked as (
    select
      _competition_id as competition_id,
      u.id as user_id,
      u.display_name as user_display_name,
      p.division_id,
      p.division_name,
      p.total_tops,
      p.total_zones,
      p.total_top_attempts,
      p.total_zone_attempts,
      dense_rank() over (
        partition by p.division_id
        order by
          p.total_tops desc,
          p.total_zones desc,
          p.total_top_attempts asc,
          p.total_zone_attempts asc,
          u.display_name asc
      ) as rnk
    from per_user p
    join users u on u.id = p.user_id
  )
  select
    competition_id,
    division_id,
    division_name,
    user_id,
    user_display_name,
    rnk as rank,
    total_tops,
    total_zones,
    total_top_attempts,
    total_zone_attempts
  from ranked
  where rnk <= _max_rank
  order by division_name, rank, user_display_name;
$$;