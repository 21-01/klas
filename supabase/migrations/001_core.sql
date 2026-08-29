-- 001_core.sql
-- Core entity tables: program_studi, users, mahasiswa, dosen

-- Enable required extensions
create extension if not exists "uuid-ossp";
create extension if not exists "postgis";

-- ============================================================
-- PROGRAM STUDI
-- ============================================================
create table if not exists program_studi (
  prodi_id      int primary key generated always as identity,
  kode_prodi    varchar(20) not null unique,
  nama_prodi    varchar(150) not null,
  created_at    timestamptz not null default now()
);

comment on table program_studi is 'Study programs (e.g. Teknik Informatika, Sistem Informasi)';

-- ============================================================
-- USERS
-- ============================================================
create table if not exists users (
  user_id       uuid primary key default uuid_generate_v4(),
  email         varchar(255) not null unique,
  name          varchar(150) not null,
  role          varchar(20) not null check (role in ('mahasiswa', 'dosen', 'admin')),
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table users is 'User profiles linked to Supabase Auth UID';

-- ============================================================
-- MAHASISWA
-- ============================================================
create table if not exists mahasiswa (
  mahasiswa_id          uuid primary key default uuid_generate_v4(),
  user_id               uuid not null unique references users(user_id) on delete cascade,
  nim                   varchar(30) not null unique,
  nama                  varchar(150) not null,
  prodi_id              int not null references program_studi(prodi_id),
  angkatan              varchar(4),
  jenis_kelamin         varchar(1) check (jenis_kelamin in ('L', 'P')),
  gpa                   decimal(3,2),
  pembimbing_akademik   varchar(150),
  is_active             boolean not null default true,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

comment on table mahasiswa is 'Student profiles';

-- ============================================================
-- DOSEN
-- ============================================================
create table if not exists dosen (
  dosen_id      uuid primary key default uuid_generate_v4(),
  user_id       uuid not null unique references users(user_id) on delete cascade,
  nip           varchar(30) unique,
  nidn          varchar(30) unique,
  nama          varchar(150) not null,
  prodi_id      int not null references program_studi(prodi_id),
  jenis_kelamin varchar(1) check (jenis_kelamin in ('L', 'P')),
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table dosen is 'Lecturer profiles';

-- ============================================================
-- INDEXES
-- ============================================================
create index if not exists idx_mahasiswa_user_id on mahasiswa(user_id);
create index if not exists idx_mahasiswa_nim on mahasiswa(nim);
create index if not exists idx_mahasiswa_prodi on mahasiswa(prodi_id);
create index if not exists idx_dosen_user_id on dosen(user_id);
create index if not exists idx_dosen_nip on dosen(nip);
create index if not exists idx_dosen_nidn on dosen(nidn);
create index if not exists idx_dosen_prodi on dosen(prodi_id);
create index if not exists idx_users_role on users(role);
create index if not exists idx_users_email on users(email);

-- ============================================================
-- TRIGGER: updated_at
-- ============================================================
create or replace function trigger_set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger set_updated_at_users
  before update on users for each row execute function trigger_set_updated_at();

create trigger set_updated_at_mahasiswa
  before update on mahasiswa for each row execute function trigger_set_updated_at();

create trigger set_updated_at_dosen
  before update on dosen for each row execute function trigger_set_updated_at();
