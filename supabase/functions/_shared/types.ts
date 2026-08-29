export type UserRole = "mahasiswa" | "dosen" | "admin" | "super_admin" | "admin_prodi";

export interface SessionResult {
  sesi_id: string;
  status: string;
  jadwal_kelas?: {
    jadwal_id: string;
    ruangan?: {
      ruangan_id: string;
      nama_ruangan: string;
      latitude: number;
      longitude: number;
      geofence_radius_m: number;
    } | null;
    dosen_id?: string | null;
  } | null;
}

export interface MahasiswaProfile {
  mahasiswa_id: string;
  nim: string;
  nama: string;
}

export interface DosenProfile {
  dosen_id: string;
  nip?: string;
  nidn?: string;
  nama: string;
}

export interface UserProfile {
  user_id: string;
  email: string;
  name: string;
  role: UserRole;
}
