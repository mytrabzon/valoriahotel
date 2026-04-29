-- Demirbaslar (fixed assets) module
create table if not exists public.fixed_assets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  category text not null,
  name text not null,
  location text not null,
  status text not null check (status in ('yerinde', 'eksik', 'arizali', 'bakimda', 'tasindi')),
  quantity integer not null default 1 check (quantity > 0),
  note text,
  brand_model text,
  serial_no text,
  added_by uuid not null references public.staff(id),
  last_seen_location text,
  last_updated_by uuid not null references public.staff(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_fixed_assets_org on public.fixed_assets(organization_id);
create index if not exists idx_fixed_assets_category on public.fixed_assets(category);
create index if not exists idx_fixed_assets_location on public.fixed_assets(location);
create index if not exists idx_fixed_assets_status on public.fixed_assets(status);

create table if not exists public.fixed_asset_photos (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.fixed_assets(id) on delete cascade,
  photo_url text not null,
  created_by uuid not null references public.staff(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_fixed_asset_photos_asset on public.fixed_asset_photos(asset_id);

create table if not exists public.fixed_asset_history (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.fixed_assets(id) on delete cascade,
  action text not null check (action in ('created', 'updated')),
  location text not null,
  status text not null check (status in ('yerinde', 'eksik', 'arizali', 'bakimda', 'tasindi')),
  note text,
  created_by uuid not null references public.staff(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_fixed_asset_history_asset on public.fixed_asset_history(asset_id, created_at desc);

alter table public.fixed_assets enable row level security;
alter table public.fixed_asset_photos enable row level security;
alter table public.fixed_asset_history enable row level security;

drop policy if exists "fixed_assets_select_org" on public.fixed_assets;
drop policy if exists "fixed_assets_insert_org" on public.fixed_assets;
drop policy if exists "fixed_assets_update_org" on public.fixed_assets;

create policy "fixed_assets_select_org" on public.fixed_assets
for select to authenticated using (
  organization_id in (
    select s.organization_id from public.staff s
    where s.auth_id = auth.uid()
      and s.is_active = true
      and s.deleted_at is null
      and s.organization_id is not null
  )
);

create policy "fixed_assets_insert_org" on public.fixed_assets
for insert to authenticated with check (
  organization_id in (
    select s.organization_id from public.staff s
    where s.auth_id = auth.uid()
      and s.is_active = true
      and s.deleted_at is null
      and s.organization_id is not null
  )
);

create policy "fixed_assets_update_org" on public.fixed_assets
for update to authenticated using (
  organization_id in (
    select s.organization_id from public.staff s
    where s.auth_id = auth.uid()
      and s.is_active = true
      and s.deleted_at is null
      and s.organization_id is not null
  )
) with check (
  organization_id in (
    select s.organization_id from public.staff s
    where s.auth_id = auth.uid()
      and s.is_active = true
      and s.deleted_at is null
      and s.organization_id is not null
  )
);

drop policy if exists "fixed_asset_photos_select_org" on public.fixed_asset_photos;
drop policy if exists "fixed_asset_photos_insert_org" on public.fixed_asset_photos;

create policy "fixed_asset_photos_select_org" on public.fixed_asset_photos
for select to authenticated using (
  exists (
    select 1
    from public.fixed_assets fa
    join public.staff s on s.auth_id = auth.uid()
    where fa.id = asset_id
      and s.is_active = true
      and s.deleted_at is null
      and s.organization_id = fa.organization_id
  )
);

create policy "fixed_asset_photos_insert_org" on public.fixed_asset_photos
for insert to authenticated with check (
  exists (
    select 1
    from public.fixed_assets fa
    join public.staff s on s.auth_id = auth.uid()
    where fa.id = asset_id
      and s.is_active = true
      and s.deleted_at is null
      and s.organization_id = fa.organization_id
  )
);

drop policy if exists "fixed_asset_history_select_org" on public.fixed_asset_history;
drop policy if exists "fixed_asset_history_insert_org" on public.fixed_asset_history;

create policy "fixed_asset_history_select_org" on public.fixed_asset_history
for select to authenticated using (
  exists (
    select 1
    from public.fixed_assets fa
    join public.staff s on s.auth_id = auth.uid()
    where fa.id = asset_id
      and s.is_active = true
      and s.deleted_at is null
      and s.organization_id = fa.organization_id
  )
);

create policy "fixed_asset_history_insert_org" on public.fixed_asset_history
for insert to authenticated with check (
  exists (
    select 1
    from public.fixed_assets fa
    join public.staff s on s.auth_id = auth.uid()
    where fa.id = asset_id
      and s.is_active = true
      and s.deleted_at is null
      and s.organization_id = fa.organization_id
  )
);

create or replace function public.set_fixed_assets_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_fixed_assets_updated_at on public.fixed_assets;
create trigger trg_fixed_assets_updated_at
before update on public.fixed_assets
for each row execute procedure public.set_fixed_assets_updated_at();
