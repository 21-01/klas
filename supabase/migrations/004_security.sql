-- 004_security.sql
-- Security, audit, and configuration tables

-- ============================================================
-- AUDIT_LOG
-- ============================================================
create type kategori_audit_enum as enum (
  'Master Data', 'Schedule Plotting', 'Security Policies',
  'Attendance Overrides', 'Authentication', 'Geofence', 'System'
);
create type status_audit_enum as enum ('success', 'failed');

create table if not exists audit_log (
  log_id        uuid primary key default uuid_generate_v4(),
  user_id       uuid references users(user_id),
  timestamp     timestamptz not null default now(),
  kategori      kategori_audit_enum not null,
  aksi          text not null,
  ip_address    inet,
  status        status_audit_enum not null default 'success',
  metadata      jsonb,
  created_at    timestamptz not null default now()
);

comment on table audit_log is 'Append-only audit trail for compliance and traceability';

-- ============================================================
-- NOTIFIKASI (Notifications)
-- ============================================================
create type tipe_notifikasi_enum as enum (
  'geofence_flag', 'session_closed', 'new_account',
  'scheduler_run', 'system', 'checkin_success', 'brute_force'
);

create table if not exists notifikasi (
  notifikasi_id uuid primary key default uuid_generate_v4(),
  user_id       uuid not null references users(user_id),
  tipe          tipe_notifikasi_enum not null,
  judul         varchar(200) not null,
  pesan         text,
  is_read       boolean not null default false,
  created_at    timestamptz not null default now()
);

comment on table notifikasi is 'In-app notifications per user';

-- ============================================================
-- ROLE_PERMISSIONS (RBAC Matrix)
-- ============================================================
create type role_enum as enum ('super_admin', 'admin_prodi', 'dosen', 'mahasiswa');

create table if not exists role_permissions (
  role_permission_id       uuid primary key default uuid_generate_v4(),
  role                     role_enum not null unique,
  can_read                 boolean not null default true,
  can_write                boolean not null default false,
  can_moderate_attendance  boolean not null default false,
  can_configure_system     boolean not null default false,
  is_locked                boolean not null default false,
  updated_by               uuid references users(user_id),
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

comment on table role_permissions is 'Granular permission matrix per system role';

-- ============================================================
-- KONFIGURASI_SISTEM (System Configuration)
-- ============================================================
create table if not exists konfigurasi_sistem (
  config_id     uuid primary key default uuid_generate_v4(),
  key           varchar(100) not null unique,
  value         jsonb not null,
  updated_by    uuid references users(user_id),
  updated_at    timestamptz not null default now()
);

comment on table konfigurasi_sistem is 'Key-value system configuration store';

-- Default configurations
insert into konfigurasi_sistem (key, value) values
  ('tfa_enabled', 'true'::jsonb),
  ('session_timeout_minutes', '30'::jsonb),
  ('min_password_length', '12'::jsonb),
  ('require_special_char', 'true'::jsonb),
  ('strict_geofence', 'true'::jsonb),
  ('qr_ttl_seconds', '15'::jsonb)
on conflict (key) do nothing;

-- ============================================================
-- IP_WHITELIST (Campus Network Subnets)
-- ============================================================
create table if not exists ip_whitelist (
  whitelist_id  uuid primary key default uuid_generate_v4(),
  cidr          varchar(45) not null unique,
  label         varchar(100),
  created_at    timestamptz not null default now()
);

comment on table ip_whitelist is 'Campus network CIDR whitelist for IP filtering';

-- Default campus subnets (development)
insert into ip_whitelist (cidr, label) values
  ('127.0.0.1/32', 'Localhost'),
  ('192.168.0.0/16', 'Private LAN'),
  ('10.0.0.0/8', 'Private LAN'),
  ('172.16.0.0/12', 'Private LAN')
on conflict (cidr) do nothing;

-- ============================================================
-- FAILED_LOGIN_ATTEMPTS (Brute-force Protection)
-- ============================================================
create table if not exists failed_login_attempts (
  attempt_id    uuid primary key default uuid_generate_v4(),
  ip_address    inet not null,
  email         varchar(255) not null,
  attempted_at  timestamptz not null default now()
);

comment on table failed_login_attempts is 'Records failed login attempts for rate-limiting';

create index if not exists idx_failed_login_ip on failed_login_attempts(ip_address);
create index if not exists idx_failed_login_time on failed_login_attempts(attempted_at);

-- ============================================================
-- INDEXES
-- ============================================================
create index if not exists idx_audit_log_user on audit_log(user_id);
create index if not exists idx_audit_log_kategori on audit_log(kategori);
create index if not exists idx_audit_log_timestamp on audit_log(timestamp);
create index if not exists idx_notifikasi_user on notifikasi(user_id);
create index if not exists idx_notifikasi_read on notifikasi(user_id, is_read);

-- ============================================================
-- TRIGGERS: updated_at
-- ============================================================
create trigger set_updated_at_role_permissions
  before update on role_permissions for each row execute function trigger_set_updated_at();
