import { useLoaderData } from "react-router";
import { Award } from "lucide-react";
import TopAppBar from "~/components/TopAppBar";
import { api, clearProfileCache } from "~/lib/api";
import { supabase } from "~/lib/supabase";
import type { Route } from "./+types/profile";

export function meta() {
  return [
    { title: "Profile - Klas." },
  ];
}

export async function clientLoader({}: Route.ClientLoaderArgs) {
  const profile = await api.getMyProfile();
  if (profile.role !== "mahasiswa") {
    throw new Response("Unauthorized", { status: 403 });
  }
  const initials = profile.nama.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
  return {
    initials,
    name: profile.nama,
    classInfo: `${profile.prodi.nama_prodi} • Class of ${profile.angkatan}`,
    gpa: (profile.gpa ?? 0).toString(),
    studentId: profile.nim,
    email: profile.email ?? "-",
    advisor: profile.pembimbing_akademik ?? "Unassigned",
  };
}

export default function Profile() {
  const profile = useLoaderData<typeof clientLoader>();

  return (
    <div className="bg-brand-bg min-h-full flex flex-col items-start relative w-full text-brand-text">
      <TopAppBar />

      <div className="flex flex-col gap-[24px] items-start pb-[128px] pt-[32px] px-[24px] w-full">

        <div className="bg-white border border-brand-border flex flex-col p-[20px] rounded-[10px] shadow-sm w-full gap-[16px]">
          <div className="flex items-center gap-[16px]">
            <div className="size-[64px] bg-brand-secondary text-white flex items-center justify-center rounded-full font-bold text-[24px] tracking-tight shrink-0">
              {profile.initials}
            </div>
            <div className="flex flex-col">
              <h2 className="font-bold text-[18px]">{profile.name}</h2>
              <span className="text-brand-text-dim text-[12px] font-medium tracking-[0.4px]">
                {profile.classInfo}
              </span>
            </div>
          </div>

          <div className="bg-brand-surface rounded-[6px] p-[12px] flex items-center gap-[12px]">
            <Award size={18} className="text-brand-secondary" />
            <span className="text-brand-text-muted text-[12px] font-semibold">GPA: {profile.gpa} / 4.0</span>
          </div>
        </div>

        <div className="flex flex-col gap-[12px] w-full">
          <h3 className="font-semibold text-brand-text text-[16px] px-[4px]">
            Student Information
          </h3>

          <div className="bg-white border border-brand-border rounded-[10px] p-[16px] w-full flex flex-col gap-[12px] text-[13px] text-brand-text-muted">
            <div className="flex flex-col gap-[2px]">
              <span className="text-[11px] text-brand-text-dim font-semibold uppercase tracking-[0.4px]">Student ID</span>
              <span className="font-bold text-brand-text">{profile.studentId}</span>
            </div>

            <div className="flex flex-col gap-[2px] border-t border-brand-surface pt-[12px]">
              <span className="text-[11px] text-brand-text-dim font-semibold uppercase tracking-[0.4px]">Email</span>
              <span className="font-bold text-brand-text">{profile.email}</span>
            </div>

            <div className="flex flex-col gap-[2px] border-t border-brand-surface pt-[12px]">
              <span className="text-[11px] text-brand-text-dim font-semibold uppercase tracking-[0.4px]">Academic Advisor</span>
              <span className="font-bold text-brand-text">{profile.advisor}</span>
            </div>
          </div>
        </div>

        <button
          onClick={() => { clearProfileCache(); localStorage.clear(); window.location.href = "/login"; }}
          className="bg-white border border-status-error hover:bg-red-50 text-status-error active:scale-[0.98] transition-all font-semibold text-[12px] tracking-[1.2px] uppercase py-[14px] w-full rounded mt-4 cursor-pointer text-center"
        >
          Sign Out
        </button>

      </div>
    </div>
  );
}
