-- Reconciles the canonical schema (supabase/migrations/001..004) with the
-- behaviour the API relies on. Safe to re-run.

-- 1. Role vocabulary must cover the RBAC matrix in 004_security.sql.
alter table users drop constraint if exists users_role_check;
alter table users
  add constraint users_role_check
  check (role in ('mahasiswa', 'dosen', 'admin', 'super_admin', 'admin_prodi'));

-- 2. Atomic brute-force counter used by POST /login.
create or replace function public.check_and_record_failed_login(
  p_ip_address inet,
  p_email text,
  p_window_seconds int default 60,
  p_max_attempts int default 5
) returns table (blocked boolean, attempt_count int) as $$
declare
  v_count int;
begin
  select count(*) into v_count
  from failed_login_attempts
  where ip_address = p_ip_address
    and attempted_at >= now() - (p_window_seconds || ' seconds')::interval;

  insert into failed_login_attempts (ip_address, email)
  values (p_ip_address, p_email);

  return query select (v_count + 1 >= p_max_attempts), v_count + 1;
end;
$$ language plpgsql security definer;

grant execute on function public.check_and_record_failed_login(inet, text, int, int) to public;

-- 3. Close stale live sessions (was a pg_cron job on Supabase).
create or replace function public.auto_close_stale_sessions()
returns int as $$
declare
  v_closed int;
begin
  update sesi_kehadiran
     set status = 'completed',
         waktu_selesai = coalesce(waktu_selesai, now())
   where status = 'live'
     and waktu_mulai < now() - interval '4 hours';
  get diagnostics v_closed = row_count;
  return v_closed;
end;
$$ language plpgsql security definer;

-- 4. Expired QR cleanup (was a pg_cron job on Supabase).
create or replace function public.cleanup_expired_qr_codes()
returns int as $$
declare
  v_deleted int;
begin
  delete from qr_code where expired_at < now();
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$ language plpgsql security definer;
