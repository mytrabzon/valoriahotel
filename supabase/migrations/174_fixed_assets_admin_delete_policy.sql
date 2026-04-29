-- Allow only organization admins to delete fixed assets.
drop policy if exists "fixed_assets_delete_admin_org" on public.fixed_assets;

create policy "fixed_assets_delete_admin_org" on public.fixed_assets
for delete to authenticated using (
  organization_id in (
    select s.organization_id
    from public.staff s
    where s.auth_id = auth.uid()
      and s.is_active = true
      and s.deleted_at is null
      and s.organization_id is not null
      and s.role = 'admin'
  )
);
