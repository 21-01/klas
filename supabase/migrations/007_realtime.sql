-- 007_realtime.sql
-- Enable Realtime subscriptions for attendance, sessions, and notifications

-- ============================================================
-- 1. Enable tables in the supabase_realtime publication
--    These tables are needed for:
--    - presensi:   dosen live monitor of check-ins
--    - sesi_kehadiran:  broadcast session open/close events
--    - notifikasi: in-app notification delivery
-- ============================================================
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'presensi'
  ) then
    alter publication supabase_realtime add table presensi;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'sesi_kehadiran'
  ) then
    alter publication supabase_realtime add table sesi_kehadiran;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifikasi'
  ) then
    alter publication supabase_realtime add table notifikasi;
  end if;
end $$;

-- ============================================================
-- 2. Ensure RLS policies allow realtime access
--    Realtime respects existing RLS — no additional policies needed
--    because the existing RLS policies already cover SELECT/INSERT
--    for the relevant roles on these tables.
--
--    Clients should subscribe with a filter matching their role:
--    - Dosen:   presensi:sesi_id=eq.{sesi_id}
--    - Dosen/Admin:  sesi_kehadiran:status=eq.live
--    - Any user:     notifikasi:user_id=eq.{auth.uid()}
-- ============================================================

-- ============================================================
-- 3. Helper to generate realtime channel names consistently
-- ============================================================
create or replace function public.realtime_channel(table_name text, filter_column text, filter_value text)
returns text
language sql
immutable
as $$
  select table_name || ':' || filter_column || '=eq.' || filter_value;
$$;

comment on function public.realtime_channel is 'Generates consistent Realtime channel names for client subscriptions';

-- ============================================================
-- 4. Notification trigger: automatically create notifikasi
--    for important attendance events (geofence violations, etc.)
-- ============================================================
create or replace function public.notify_geofence_violation()
returns trigger
language plpgsql
security definer
as $$
begin
  if new.geofence_flagged and old.geofence_flagged is distinct from true then
    insert into notifikasi (user_id, tipe, judul, pesan)
    select
      dosen.user_id,
      'geofence_flag',
      'Geofence Violation',
      'Student checked in outside geofence boundary'
    from sesi_kehadiran
    join jadwal_kelas on sesi_kehadiran.jadwal_id = jadwal_kelas.jadwal_id
    join dosen on jadwal_kelas.dosen_id = dosen.dosen_id
    where sesi_kehadiran.sesi_id = new.sesi_id;
  end if;
  return new;
end;
$$;

create trigger trg_notify_geofence_violation
  after insert or update of geofence_flagged on presensi
  for each row
  when (new.geofence_flagged = true)
  execute function public.notify_geofence_violation();

comment on function public.notify_geofence_violation is 'Creates notification when a geofence violation is flagged';
