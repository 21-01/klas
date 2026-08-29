-- 008_scheduled_tasks.sql
-- Scheduled tasks via pg_cron for automated maintenance and reporting

-- ============================================================
-- 1. Enable pg_cron extension
-- ============================================================
create extension if not exists pg_cron with schema pg_catalog;

-- ============================================================
-- 2. Task: Auto-close stale sessions (runs every 5 minutes)
--    Closes sessions where scheduled end time has passed
-- ============================================================
create or replace function public.auto_close_stale_sessions()
returns void
language plpgsql
security definer
as $$
begin
  update sesi_kehadiran s
  set status = 'completed',
      waktu_selesai = now()
  from jadwal_kelas j
  where s.jadwal_id = j.jadwal_id
    and s.status = 'live'
    and ((s.tanggal + j.waktu_selesai) AT TIME ZONE 'Asia/Jakarta') < now();

  if found then
    insert into audit_log (kategori, aksi, status, metadata)
    values ('System', 'Auto-closed stale attendance sessions', 'success',
            jsonb_build_object('closed_count', (select count(*) from sesi_kehadiran where status = 'completed' and waktu_selesai = now())));
  end if;
end;
$$;

comment on function public.auto_close_stale_sessions() is 'Closes attendance sessions past their scheduled end time';

-- ============================================================
-- 3. Task: Cleanup expired QR codes (runs every 30 seconds)
-- ============================================================
create or replace function public.cleanup_expired_qr_codes()
returns void
language plpgsql
security definer
as $$
begin
  delete from qr_code where expired_at < now();
end;
$$;

comment on function public.cleanup_expired_qr_codes() is 'Deletes QR code tokens that have expired';

-- ============================================================
-- 4. Task: Daily attendance digest (runs daily at 23:00)
--    Generates notifications for students below 75% attendance
-- ============================================================
create or replace function public.generate_daily_attendance_digest()
returns void
language plpgsql
security definer
as $$
begin
  -- Notify students about their attendance rate
  insert into notifikasi (user_id, tipe, judul, pesan)
  select
    m.user_id,
    'scheduler_run',
    'Daily Attendance Report',
    format('Kehadiran: %s%% dari sesi dalam 30 hari terakhir',
           round((sum(case when pr.status in ('present', 'late') then 1 else 0 end)::numeric / nullif(count(*), 0)) * 100, 1))
  from mahasiswa m
  join presensi pr on pr.mahasiswa_id = m.mahasiswa_id
  join sesi_kehadiran sk on pr.sesi_id = sk.sesi_id
  where sk.created_at >= current_date - interval '30 days'
    and m.user_id is not null
  group by m.user_id, m.mahasiswa_id
  having (sum(case when pr.status in ('present', 'late') then 1 else 0 end)::numeric / nullif(count(*), 0)) < 0.75;

  -- Notify admins of aggregate low-attendance count
  insert into notifikasi (user_id, tipe, judul, pesan)
  select distinct on (u.user_id)
    u.user_id,
    'scheduler_run',
    'Low Attendance Alert',
    (select count(*)::text || ' mahasiswa memiliki kehadiran di bawah 75%')
  from users u
  where u.role = 'admin';

  insert into audit_log (kategori, aksi, status, metadata)
  values ('System', 'Daily attendance digest generated', 'success',
          jsonb_build_object('generated_at', now()));
end;
$$;

comment on function public.generate_daily_attendance_digest() is 'Generates daily attendance notifications for students below 75%';

-- ============================================================
-- 5. Schedule the cron jobs
-- ============================================================

-- Auto-close stale sessions every 5 minutes
select cron.schedule(
  'auto-close-stale-sessions',
  '*/5 * * * *',
  $$select public.auto_close_stale_sessions()$$
);

-- Cleanup expired QR codes every 30 seconds
select cron.schedule(
  'cleanup-expired-qr-codes',
  '*/30 * * * * *',
  $$select public.cleanup_expired_qr_codes()$$
);

-- Daily attendance digest at 23:00 (11 PM)
select cron.schedule(
  'daily-attendance-digest',
  '0 23 * * *',
  $$select public.generate_daily_attendance_digest()$$
);
