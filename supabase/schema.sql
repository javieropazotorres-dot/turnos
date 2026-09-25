-- Esquema de Turnos para Supabase. Pegar completo en SQL Editor → Run.
-- Cada fila pertenece a un usuario (user_id) y RLS impide ver o tocar filas ajenas.

create table if not exists public.places (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  id text not null,
  name text not null check (length(name) between 1 and 120),
  rate integer not null default 0 check (rate >= 0),
  color smallint not null default 0,
  sort integer not null default 0,
  primary key (user_id, id)
);

-- Valor hora de noche (0 = igual al de día). Agregado después; seguro de ejecutar de nuevo.
alter table public.places add column if not exists rate_noche integer not null default 0 check (rate_noche >= 0);

-- Feriados: el turno se marca como feriado y cada lugar define si ese día se paga todo como noche.
alter table public.places add column if not exists feriado_noche boolean not null default false;
alter table public.shifts add column if not exists feriado boolean not null default false;

create table if not exists public.shifts (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  id text not null,
  date date not null,
  start text not null check (start ~ '^\d{2}:\d{2}$'),
  hours numeric not null check (hours > 0 and hours <= 48),
  place_id text not null,
  place_name text not null default '',
  created_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table if not exists public.perfil (
  user_id uuid primary key default auth.uid() references auth.users on delete cascade,
  nombre text not null default '',
  titulo text not null default 'doctora' check (titulo in ('doctora', 'Dra.'))
);

alter table public.places enable row level security;
alter table public.shifts enable row level security;
alter table public.perfil enable row level security;

drop policy if exists "places propios" on public.places;
create policy "places propios" on public.places for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy if exists "shifts propios" on public.shifts;
create policy "shifts propios" on public.shifts for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy if exists "perfil propio" on public.perfil;
create policy "perfil propio" on public.perfil for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
