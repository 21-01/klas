import { useState, useEffect, useRef } from "react";
import { MapPin, Clock, HelpCircle, Search, ChevronDown, User, Users, X, Loader2, UserPlus, UserMinus } from "lucide-react";
import { cn } from "~/lib/utils";
import { api } from "~/lib/api";

export function meta() {
  return [
    { title: "Course Schedule Plotting - Admin Console - Klas." },
  ];
}

export default function AdminSchedule() {
  const [schedule, setSchedule] = useState<any[]>([]);
  const [lecturers, setLecturers] = useState<any[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [enrolledCounts, setEnrolledCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [selectedSemester, setSelectedSemester] = useState("Ganjil 2025/2026");
  const [selectedProdi, setSelectedProdi] = useState("1");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedJadwalId, setExpandedJadwalId] = useState<string | null>(null);
  const [enrolledStudents, setEnrolledStudents] = useState<any[]>([]);
  const [enrolledLoading, setEnrolledLoading] = useState(false);
  const [allStudents, setAllStudents] = useState<any[]>([]);
  const [studentSearch, setStudentSearch] = useState("");
  const [dropdownInfo, setDropdownInfo] = useState<{
    type: "lecturer" | "room";
    jadwalId: string;
    top: number;
    left: number;
  } | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [jadwalData, dosenData, ruanganData] = await Promise.all([
        api.crudJadwal("list", { limit: 100 }),
        api.crudDosen("list", { limit: 100 }),
        api.crudRuangan("list", { per_page: 100 }),
      ]);
      const jadwalList = Array.isArray(jadwalData?.jadwal) ? jadwalData.jadwal : [];
      setSchedule(jadwalList);
      setLecturers(Array.isArray(dosenData?.data) ? dosenData.data : []);
      setRooms(Array.isArray(ruanganData?.data) ? ruanganData.data : []);

      const counts: Record<string, number> = {};
      await Promise.all(
        jadwalList.map(async (j: any) => {
          const res = await api.crudJadwal("list-enrolled", { jadwal_id: j.jadwal_id });
          counts[j.jadwal_id] = res?.enrolled?.length || 0;
        })
      );
      setEnrolledCounts(counts);
    } catch (err) {
      console.error("Failed to fetch schedule data:", err);
    }
    setLoading(false);
  };

  const fetchEnrolled = async (jadwalId: string) => {
    setEnrolledLoading(true);
    try {
      const res = await api.crudJadwal("list-enrolled", { jadwal_id: jadwalId });
      setEnrolledStudents(res?.enrolled || []);
    } catch (err) {
      console.error("Failed to fetch enrolled students:", err);
    }
    setEnrolledLoading(false);
  };

  const fetchAllStudents = async () => {
    try {
      const res = await api.crudMahasiswa("list", { limit: 100 });
      setAllStudents(res?.mahasiswa || []);
    } catch (err) {
      console.error("Failed to fetch students:", err);
    }
  };

  const handleToggleExpand = async (jadwalId: string) => {
    if (expandedJadwalId === jadwalId) {
      setExpandedJadwalId(null);
      return;
    }
    setExpandedJadwalId(jadwalId);
    setStudentSearch("");
    await Promise.all([fetchEnrolled(jadwalId), fetchAllStudents()]);
  };

  const handleToggleEnroll = async (jadwalId: string, mahasiswaId: string) => {
    try {
      await api.crudJadwal("toggle-enroll", { jadwal_id: jadwalId, mahasiswa_id: mahasiswaId });
      await fetchEnrolled(jadwalId);
      const res = await api.crudJadwal("list-enrolled", { jadwal_id: jadwalId });
      setEnrolledCounts((prev) => ({ ...prev, [jadwalId]: res?.enrolled?.length || 0 }));
    } catch (err) {
      console.error("Failed to toggle enrollment:", err);
    }
  };

  useEffect(() => { fetchData(); }, []);

  useEffect(() => {
    if (!dropdownInfo) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownInfo(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [dropdownInfo]);

  const filteredSchedule = schedule.filter((item) =>
    (item.mata_kuliah?.nama_mk || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
    (item.mata_kuliah?.kode_mk || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
    (item.dosen?.nama || "").toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalSlots = schedule.length;
  const assignedSlots = schedule.filter((x) => x.status === "assigned").length;
  const unassignedSlots = schedule.filter((x) => x.status === "unassigned").length;
  const roomMissingSlots = schedule.filter((x) => x.status === "room-missing").length;

  const handleDropdownClick = (type: "lecturer" | "room", jadwalId: string, e: React.MouseEvent) => {
    if (dropdownInfo?.jadwalId === jadwalId && dropdownInfo?.type === type) {
      setDropdownInfo(null);
      return;
    }
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const itemCount = type === "lecturer" ? lecturers.length : rooms.length;
    const estimatedHeight = Math.min(itemCount * 36 + 8, 280);
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const top = spaceBelow < estimatedHeight && spaceAbove > estimatedHeight
      ? rect.top - estimatedHeight - 4
      : rect.bottom + 4;
    const left = rect.left + 200 > window.innerWidth ? window.innerWidth - 210 : rect.left;
    setDropdownInfo({ type, jadwalId, top, left });
  };

  const handleAssignLecturer = async (id: string, dosenId: string) => {
    try {
      await api.crudJadwal("update", { jadwal_id: id, dosen_id: dosenId });
      await fetchData();
    } catch (err) {
      console.error("Failed to assign lecturer:", err);
    }
    setDropdownInfo(null);
  };

  const handleAssignRoom = async (id: string, ruanganId: string) => {
    try {
      await api.crudJadwal("update", { jadwal_id: id, ruangan_id: ruanganId });
      await fetchData();
    } catch (err) {
      console.error("Failed to assign room:", err);
    }
    setDropdownInfo(null);
  };

  if (loading && !schedule.length) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="animate-spin text-brand-secondary" size={32} /></div>;
  }

  return (
    <div className="flex flex-col gap-[32px] w-full">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 w-full pb-2 border-b border-brand-border/40">
        <div className="flex flex-col items-start gap-[4px]">
          <span className="font-semibold text-brand-text-dim text-[11px] tracking-[1.2px] uppercase">CURRICULUM PLANNING</span>
          <h1 className="font-bold text-brand-primary text-[32px] tracking-[-0.64px] leading-tight">Course Schedule Plotting</h1>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-[24px] w-full items-start">
        <div className="lg:col-span-9 bg-white border border-brand-border rounded-[16px] shadow-sm overflow-hidden flex flex-col w-full">
          <div className="p-[20px] border-b border-brand-border bg-slate-50/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-[12px] w-full md:w-auto">
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold text-brand-text-dim uppercase tracking-[0.5px]">Semester</span>
                <select value={selectedSemester} onChange={(e) => setSelectedSemester(e.target.value)}
                  className="bg-white border border-brand-border text-brand-text rounded-[8px] px-[12px] py-[6px] text-[13px] focus:outline-none font-semibold cursor-pointer">
                  <option value="Ganjil 2025/2026">Ganjil 2025/2026</option>
                  <option value="Genap 2024/2025">Genap 2024/2025</option>
                </select>
              </div>
              <div className="relative w-full md:w-[240px] mt-auto">
                <Search className="absolute left-[12px] top-1/2 -translate-y-1/2 text-brand-text-dim" size={16} />
                <input type="text" placeholder="Search course or lecturer..." value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-white border border-brand-border text-brand-text placeholder-brand-text-dim/60 rounded-[8px] pl-[36px] pr-[12px] py-[8px] text-[13px] focus:outline-none focus:border-brand-secondary" />
              </div>
            </div>
          </div>

          <div className="w-full overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="bg-slate-50 border-b border-brand-border text-brand-text-dim text-[11px] font-bold uppercase tracking-[1px]">
                  <th className="px-[24px] py-[16px]">Course</th>
                  <th className="px-[24px] py-[16px]">Students</th>
                  <th className="px-[24px] py-[16px]">Lecturer</th>
                  <th className="px-[24px] py-[16px]">Time</th>
                  <th className="px-[24px] py-[16px]">Room</th>
                  <th className="px-[24px] py-[16px]">Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredSchedule.length > 0 ? filteredSchedule.map((item, idx) => [
                  <tr key={item.jadwal_id} className={cn("border-b border-brand-border/40 hover:bg-slate-50/50 transition-colors", idx % 2 === 1 ? "bg-slate-50/10" : "bg-white")}>
                    <td className="px-[24px] py-[18px]">
                      <div className="flex flex-col">
                        <span className="font-bold text-[14px] text-brand-primary leading-tight">{item.mata_kuliah?.nama_mk}</span>
                        <span className="font-mono text-brand-text-dim text-[11px] uppercase mt-0.5">{item.mata_kuliah?.kode_mk} &bull; {item.mata_kuliah?.sks} SKS</span>
                      </div>
                    </td>
                    <td className="px-[24px] py-[18px]">
                      <button onClick={() => handleToggleExpand(item.jadwal_id)}
                        className="flex items-center gap-[6px] font-semibold text-brand-text text-[13px] hover:text-brand-primary cursor-pointer group">
                        <Users size={14} className="text-slate-400 group-hover:text-brand-primary" />
                        <span>{enrolledCounts[item.jadwal_id] ?? "—"}</span>
                        <span className="text-brand-text-dim text-[11px]">Enrolled</span>
                        <ChevronDown size={12} className={cn("text-brand-text-dim transition-transform", expandedJadwalId === item.jadwal_id && "rotate-180")} />
                      </button>
                    </td>
                    <td className="px-[24px] py-[18px]">
                      <div className="flex items-center gap-[8px]">
                        <span className="font-bold text-brand-text text-[13px]">{item.dosen?.nama || "Unassigned"}</span>
                        <button onClick={(e) => handleDropdownClick("lecturer", item.jadwal_id, e)}
                          className="p-1 hover:bg-slate-100 rounded text-brand-text-dim hover:text-brand-text cursor-pointer"><ChevronDown size={14} /></button>
                      </div>
                    </td>
                    <td className="px-[24px] py-[18px] text-brand-text-dim text-[12px] font-medium">
                      <div className="flex items-center gap-[6px]">
                        <Clock size={12} className="text-slate-400" />
                        <span>{item.hari}, {item.waktu_mulai} - {item.waktu_selesai}</span>
                      </div>
                    </td>
                    <td className="px-[24px] py-[18px]">
                      <div className="flex items-center gap-[8px]">
                        <div className="flex items-center gap-[6px] text-brand-text font-semibold text-[13px]">
                          <MapPin size={12} className="text-slate-400" />
                          <span>{item.ruangan?.nama_ruangan || "Unassigned"}</span>
                        </div>
                        <button onClick={(e) => handleDropdownClick("room", item.jadwal_id, e)}
                          className="p-1 hover:bg-slate-100 rounded text-brand-text-dim hover:text-brand-text cursor-pointer"><ChevronDown size={14} /></button>
                      </div>
                    </td>
                    <td className="px-[24px] py-[18px]">
                      {item.status === "assigned" && <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold px-[8px] py-[4px] rounded-full uppercase tracking-[0.5px]">Assigned</span>}
                      {item.status === "unassigned" && <span className="bg-red-50 text-red-700 border border-red-200 text-[10px] font-bold px-[8px] py-[4px] rounded-full uppercase tracking-[0.5px]">Lec Missing</span>}
                      {item.status === "room-missing" && <span className="bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-bold px-[8px] py-[4px] rounded-full uppercase tracking-[0.5px]">Room Missing</span>}
                      {!item.status && <span className="text-brand-text-dim/40 text-[11px]">-</span>}
                    </td>
                  </tr>,
                  expandedJadwalId === item.jadwal_id && (
                    <tr key={`${item.jadwal_id}-panel`}>
                      <td colSpan={6} className="px-[24px] py-[16px] bg-slate-50/80">
                        <div className="flex flex-col gap-[12px]">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-brand-primary text-[13px]">Enrolled Students</span>
                            <div className="relative w-[220px]">
                              <Search className="absolute left-[8px] top-1/2 -translate-y-1/2 text-brand-text-dim" size={14} />
                              <input type="text" placeholder="Search NIM or name..." value={studentSearch}
                                onChange={(e) => setStudentSearch(e.target.value)}
                                className="w-full bg-white border border-brand-border text-brand-text placeholder-brand-text-dim/60 rounded-[8px] pl-[30px] pr-[10px] py-[6px] text-[12px] focus:outline-none focus:border-brand-secondary" />
                            </div>
                          </div>
                          {enrolledLoading ? (
                            <div className="flex items-center justify-center py-4"><Loader2 className="animate-spin text-brand-secondary" size={20} /></div>
                          ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-[8px] max-h-[240px] overflow-y-auto">
                              {enrolledStudents.length > 0 ? enrolledStudents.map((e: any) => (
                                <div key={e.pendaftaran_id} className="flex items-center justify-between bg-white border border-brand-border/40 rounded-[8px] px-[12px] py-[8px]">
                                  <div className="flex items-center gap-[8px]">
                                    <User size={14} className="text-brand-text-dim" />
                                    <div className="flex flex-col">
                                      <span className="font-semibold text-brand-text text-[12px]">{e.mahasiswa?.nama}</span>
                                      <span className="font-mono text-brand-text-dim text-[10px]">{e.mahasiswa?.nim}</span>
                                    </div>
                                  </div>
                                  <button onClick={() => handleToggleEnroll(item.jadwal_id, e.mahasiswa_id)}
                                    className="p-1 hover:bg-red-50 rounded text-red-400 hover:text-red-600 cursor-pointer" title="Unenroll">
                                    <UserMinus size={14} />
                                  </button>
                                </div>
                              )) : (
                                <span className="text-brand-text-dim text-[12px] italic">No students enrolled</span>
                              )}
                            </div>
                          )}
                          <div className="border-t border-brand-border/40 pt-[12px]">
                            <span className="font-bold text-brand-primary text-[11px] tracking-[0.5px] uppercase mb-[8px] block">Add Students</span>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-[6px] max-h-[180px] overflow-y-auto">
                              {allStudents
                                .filter((s: any) => s.is_active !== false)
                                .filter((s: any) => !enrolledStudents.some((e: any) => e.mahasiswa_id === s.mahasiswa_id))
                                .filter((s: any) => !studentSearch || s.nama?.toLowerCase().includes(studentSearch.toLowerCase()) || s.nim?.toLowerCase().includes(studentSearch.toLowerCase()))
                                .map((s: any) => (
                                  <div key={s.mahasiswa_id} className="flex items-center justify-between bg-white border border-brand-border/40 rounded-[8px] px-[12px] py-[8px]">
                                    <div className="flex items-center gap-[8px]">
                                      <User size={14} className="text-slate-400" />
                                      <div className="flex flex-col">
                                        <span className="font-medium text-brand-text text-[12px]">{s.nama}</span>
                                        <span className="font-mono text-brand-text-dim text-[10px]">{s.nim}</span>
                                      </div>
                                    </div>
                                    <button onClick={() => handleToggleEnroll(item.jadwal_id, s.mahasiswa_id)}
                                      className="p-1 hover:bg-emerald-50 rounded text-emerald-400 hover:text-emerald-600 cursor-pointer" title="Enroll">
                                      <UserPlus size={14} />
                                    </button>
                                  </div>
                                ))}
                              {allStudents.filter((s: any) => !enrolledStudents.some((e: any) => e.mahasiswa_id === s.mahasiswa_id)).length === 0 && (
                                <span className="text-brand-text-dim text-[12px] italic">All students enrolled</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ),
                ])
                : (
                  <tr><td colSpan={6} className="px-[24px] py-[48px] text-center text-brand-text-dim italic">No schedule elements match search filter.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="lg:col-span-3 flex flex-col gap-[24px] w-full">
          <div className="bg-white border border-brand-border rounded-[16px] p-[24px] flex flex-col gap-[20px] shadow-sm">
            <h3 className="font-bold text-brand-primary text-[14px] tracking-[1px] uppercase">Scheduling Summary</h3>
            <div className="flex flex-col gap-[16px]">
              <div className="flex justify-between items-center border-b border-brand-border/40 pb-3">
                <span className="text-[13px] text-brand-text-dim font-medium">Total Course Slots</span>
                <span className="font-extrabold text-brand-primary text-[18px]">{totalSlots}</span>
              </div>
              <div className="flex justify-between items-center border-b border-brand-border/40 pb-3">
                <span className="text-[13px] text-brand-text-dim font-medium">Assigned Slots</span>
                <span className="font-extrabold text-emerald-600 text-[18px]">{assignedSlots}</span>
              </div>
              <div className="flex justify-between items-center border-b border-brand-border/40 pb-3">
                <span className="text-[13px] text-brand-text-dim font-medium">Unassigned Lecturer</span>
                <span className="font-extrabold text-red-600 text-[18px]">{unassignedSlots}</span>
              </div>
              <div className="flex justify-between items-center pb-1">
                <span className="text-[13px] text-brand-text-dim font-medium">Unassigned Room</span>
                <span className="font-extrabold text-amber-600 text-[18px]">{roomMissingSlots}</span>
              </div>
            </div>
            <div className="flex flex-col gap-[8px] mt-2">
              <div className="flex justify-between text-[11px] font-bold text-brand-primary">
                <span>ALLOCATION PROGRESS</span>
                <span>{totalSlots > 0 ? Math.round((assignedSlots / totalSlots) * 100) : 0}%</span>
              </div>
              <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden border border-brand-border/30">
                <div className="h-full bg-brand-primary rounded-full transition-all duration-500"
                  style={{ width: `${totalSlots > 0 ? (assignedSlots / totalSlots) * 100 : 0}%` }} />
              </div>
            </div>
          </div>
          <div className="bg-brand-surface border border-brand-border rounded-[16px] p-[20px] flex items-start gap-[12px]">
            <HelpCircle className="text-brand-secondary shrink-0 mt-0.5" size={18} />
            <div className="flex flex-col gap-[4px] text-[12px] text-brand-text-dim leading-relaxed">
              <span className="font-bold text-brand-primary">Tip</span>
              <span>Click dropdown fields in the table to assign lecturers and rooms.</span>
            </div>
          </div>
        </div>
      </div>

      {dropdownInfo && (
        <div
          ref={dropdownRef}
          className="fixed z-50 bg-white border border-brand-border rounded-[8px] shadow-lg py-1 w-[200px]"
          style={{ top: dropdownInfo.top, left: dropdownInfo.left }}
        >
          {dropdownInfo.type === "lecturer"
            ? lecturers.map((d: any) => (
                <button key={d.dosen_id} onClick={() => handleAssignLecturer(dropdownInfo.jadwalId, d.dosen_id)}
                  className="w-full text-left px-[16px] py-[8px] text-[12px] font-medium hover:bg-slate-50 text-brand-primary">{d.nama}</button>
              ))
            : rooms.map((r: any) => (
                <button key={r.ruangan_id} onClick={() => handleAssignRoom(dropdownInfo.jadwalId, r.ruangan_id)}
                  className="w-full text-left px-[16px] py-[8px] text-[12px] font-medium hover:bg-slate-50 text-brand-primary">{r.nama_ruangan}</button>
              ))}
        </div>
      )}
    </div>
  );
}
