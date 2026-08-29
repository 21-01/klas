-- MATA KULIAH
create table if not exists mata_kuliah (
  mk_id         uuid primary key default uuid_generate_v4(),
  kode_mk       varchar(20) not null unique,
  nama_mk       varchar(200) not null,
  sks           int not null check (sks between 1 and 6),
  prodi_id      int not null references program_studi(prodi_id),
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- RUANGAN
create table if not exists ruangan (
  ruangan_id          uuid primary key default uuid_generate_v4(),
  kode_ruangan        varchar(30) not null unique,
  nama_ruangan        varchar(150) not null,
  kapasitas           int,
  latitude            decimal(10,7),
  longitude           decimal(10,7),
  geofence_radius_m   int not null default 50,
  is_active           boolean not null default true,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- JADWAL_KELAS
do $$ begin
  create type hari_enum as enum ('Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu');
exception when duplicate_object then null;
end $$;
do $$ begin
  create type status_jadwal_enum as enum ('assigned', 'unassigned', 'room-missing');
exception when duplicate_object then null;
end $$;

create table if not exists jadwal_kelas (
  jadwal_id     uuid primary key default uuid_generate_v4(),
  mk_id         uuid not null references mata_kuliah(mk_id),
  dosen_id      uuid references dosen(dosen_id),
  ruangan_id    uuid references ruangan(ruangan_id),
  hari          hari_enum not null,
  waktu_mulai   time not null,
  waktu_selesai time not null,
  semester      varchar(20) not null,
  tahun_akademik varchar(9) not null,
  status        status_jadwal_enum not null default 'unassigned',
  quota         int not null default 0,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint chk_waktu check (waktu_selesai > waktu_mulai)
);

-- PENDAFTARAN_KELAS
create table if not exists pendaftaran_kelas (
  pendaftaran_id  uuid primary key default uuid_generate_v4(),
  mahasiswa_id    uuid not null references mahasiswa(mahasiswa_id) on delete cascade,
  jadwal_id       uuid not null references jadwal_kelas(jadwal_id) on delete cascade,
  created_at      timestamptz not null default now(),
  unique (mahasiswa_id, jadwal_id)
);

-- INDEXES
create index if not exists idx_mk_prodi on mata_kuliah(prodi_id);
create index if not exists idx_mk_kode on mata_kuliah(kode_mk);
create index if not exists idx_jadwal_mk on jadwal_kelas(mk_id);
create index if not exists idx_jadwal_dosen on jadwal_kelas(dosen_id);
create index if not exists idx_jadwal_ruangan on jadwal_kelas(ruangan_id);
create index if not exists idx_jadwal_semester on jadwal_kelas(semester);
create index if not exists idx_pendaftaran_mahasiswa on pendaftaran_kelas(mahasiswa_id);
create index if not exists idx_pendaftaran_jadwal on pendaftaran_kelas(jadwal_id);

-- TRIGGERS
create trigger set_updated_at_mata_kuliah
  before update on mata_kuliah for each row execute function trigger_set_updated_at();
create trigger set_updated_at_ruangan
  before update on ruangan for each row execute function trigger_set_updated_at();
create trigger set_updated_at_jadwal_kelas
  before update on jadwal_kelas for each row execute function trigger_set_updated_at();
