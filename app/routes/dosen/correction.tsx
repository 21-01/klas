import { useState, useEffect } from "react";
import { Link, useParams, useNavigate } from "react-router";
import {
  ArrowLeft, Search, Check, AlertCircle, Save, RotateCcw,
  CheckCircle, XCircle, HelpCircle, ChevronDown, Loader2
} from "lucide-react";
import { cn } from "~/lib/utils";
import { api } from "~/lib/api";
import { useToast } from "~/components/Toast";

export function meta() {
  return [
    { title: "Manual Attendance Correction - Klas." },
  ];
}

export default function DosenCorrection() {
  const { jadwal_id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [courses, setCourses] = useState<any[]>([]);
  const [selectedJadwalId, setSelectedJadwalId] = useState("");
  const [sessions, setSessions] = useState<any[]>([]);
  const [selectedSesiId, setSelectedSesiId] = useState("");
  const [students, setStudents] = useState<any[]>([]);
  const [originalStudents, setOriginalStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    api.getDosenDashboard()
      .then((data) => {
        setCourses(data.courses);
        const matching = data.courses.find((c: any) => c.jadwal_id === jadwal_id);
        if (matching) {
          setSelectedJadwalId(matching.jadwal_id);
        } else if (data.courses.length > 0) {
          setSelectedJadwalId(data.courses[0].jadwal_id);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [jadwal_id]);

  useEffect(() => {
    if (!selectedJadwalId) return;
    setSelectedSesiId("");
    setStudents([]);
    setOriginalStudents([]);
    api.listSessions(selectedJadwalId, 1, 100)
      .then((data) => {
        setSessions(data.sessions);
        if (data.sessions.length > 0) {
          setSelectedSesiId(data.sessions[0].sesi_id);
        }
      })
      .catch(() => setSessions([]));
  }, [selectedJadwalId]);

  useEffect(() => {
    if (!selectedJadwalId) return;
    setLoading(true);
    api.getCourseStudents({ jadwal_id: selectedJadwalId, limit: 100, sesi_id: selectedSesiId || undefined })
      .then((data) => {
        const mapped = data.students.map((s: any) => ({
          id: s.mahasiswa_id,
          presensiId: s.attendance?.presensi_id || null,
          name: s.nama,
          nim: s.nim,
          status: s.attendance?.status || "absent",
          initials: s.nama.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2),
        }));
        setStudents(mapped);
        setOriginalStudents(JSON.parse(JSON.stringify(mapped)));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [selectedJadwalId, selectedSesiId]);

  const handleStatusChange = (id: string, newStatus: string) => {
    setStudents((prev) =>
      prev.map((s) => s.id === id ? { ...s, status: newStatus } : s)
    );
  };

  const hasChanges = JSON.stringify(students) !== JSON.stringify(originalStudents);

  const handleReset = () => {
    setStudents(JSON.parse(JSON.stringify(originalStudents)));
    toast.info("Changes reset");
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const changed = students.filter((s) => {
        const orig = originalStudents.find((o) => o.id === s.id);
        return orig && orig.status !== s.status;
      });
      const toCorrect = changed.filter((s) => s.presensiId);
      const toCreate = changed.filter((s) => !s.presensiId);
      for (const s of toCorrect) {
        await api.correctAttendance(s.presensiId, s.status, "Manual correction by dosen");
      }
      if (toCreate.length > 0 && selectedSesiId) {
        for (const s of toCreate) {
          await api.bulkMarkPresent(selectedSesiId, [s.id], s.status);
        }
      }
      setOriginalStudents(JSON.parse(JSON.stringify(students)));
      toast.success("Corrections saved");
    } catch (err: any) {
      toast.error(err.message || "Failed to save corrections");
    } finally {
      setSaving(false);
    }
  };

  const handleMarkAllPresent = () => {
    const filteredIds = filteredStudents.map((s) => s.id);
    setStudents((prev) =>
      prev.map((s) => filteredIds.includes(s.id) ? { ...s, status: "present" } : s)
    );
    toast.success(`Marked ${filteredIds.length} students as present`);
  };

  const filteredStudents = students.filter((s) => {
    const matchesSearch = s.name.toLowerCase().includes(searchQuery.toLowerCase()) || s.nim.includes(searchQuery);
    const matchesStatus = statusFilter === "all" || s.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const total = students.length;
  const present = students.filter((s) => s.status === "present").length;
  const absent = students.filter((s) => s.status === "absent").length;
  const excused = students.filter((s) => s.status === "excused").length;
  const late = students.filter((s) => s.status === "late").length;

  if (loading && !students.length) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="animate-spin text-brand-secondary" size={32} /></div>;
  }

  return (
    <div className="flex flex-col gap-[32px] w-full">

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-[24px]">
        <div className="flex items-center gap-[16px]">
          <Link to={`/dosen/attendance/${jadwal_id}`} className="p-2 border border-brand-border hover:bg-slate-100 rounded-[10px] text-brand-primary transition-colors cursor-pointer shrink-0">
            <ArrowLeft size={20} />
          </Link>
          <div className="flex flex-col items-start">
            <span className="font-semibold text-brand-text-dim text-[11px] tracking-[1px] uppercase">
              ADMINISTRATIVE TOOL
            </span>
            <h1 className="font-bold text-brand-primary text-[28px] tracking-[-0.5px]">
              Manual Attendance Correction
            </h1>
          </div>
        </div>

        <div className="relative shrink-0 w-full sm:w-[320px]">
          <select
            value={selectedJadwalId}
            onChange={(e) => {
              setSelectedJadwalId(e.target.value);
              navigate(`/dosen/attendance/correction/${e.target.value}`);
            }}
            className="w-full bg-white border border-brand-border text-brand-text rounded-[10px] px-[16px] py-[10px] font-bold text-[13px] appearance-none focus:outline-none focus:border-brand-secondary cursor-pointer"
          >
            {courses.map((c) => (
              <option key={c.jadwal_id} value={c.jadwal_id}>
                {c.mata_kuliah.kode_mk} - {c.mata_kuliah.nama_mk}
              </option>
            ))}
          </select>
          <div className="absolute top-1/2 right-[16px] -translate-y-1/2 pointer-events-none text-brand-text-dim">
            <ChevronDown size={18} />
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center gap-[12px]">
        <span className="text-brand-text-dim text-[11px] font-bold tracking-[0.5px] uppercase">SESSION:</span>
        <div className="relative shrink-0 w-full sm:w-[320px]">
          <select
            value={selectedSesiId}
            onChange={(e) => setSelectedSesiId(e.target.value)}
            disabled={sessions.length === 0}
            className="w-full bg-white border border-brand-border text-brand-text rounded-[10px] px-[16px] py-[10px] font-bold text-[13px] appearance-none focus:outline-none focus:border-brand-secondary cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {sessions.length === 0 ? (
              <option>No sessions found</option>
            ) : (
              sessions.map((s) => (
                <option key={s.sesi_id} value={s.sesi_id}>
                  {s.tanggal} — {s.status}
                </option>
              ))
            )}
          </select>
          <div className="absolute top-1/2 right-[16px] -translate-y-1/2 pointer-events-none text-brand-text-dim">
            <ChevronDown size={18} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-[16px] w-full">
        <div className="bg-white border border-brand-border rounded-[16px] p-[20px] flex flex-col gap-[6px] shadow-sm">
          <span className="text-brand-text-dim text-[11px] font-bold tracking-[0.5px] uppercase">TOTAL CLASS SIZE</span>
          <span className="font-extrabold text-brand-primary text-[28px]">{total} Students</span>
        </div>
        <div className="bg-white border border-brand-border rounded-[16px] p-[20px] flex flex-col gap-[6px] shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-brand-text-dim text-[11px] font-bold tracking-[0.5px] uppercase">PRESENT & LATE</span>
            <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-[6px] py-[2px] rounded">
              {total > 0 ? Math.round(((present + late) / total) * 100) : 0}%
            </span>
          </div>
          <span className="font-extrabold text-emerald-600 text-[28px]">{present + late} <span className="text-orange-500">({late})</span></span>
        </div>
        <div className="bg-white border border-brand-border rounded-[16px] p-[20px] flex flex-col gap-[6px] shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-brand-text-dim text-[11px] font-bold tracking-[0.5px] uppercase">ABSENT</span>
            <span className="bg-red-100 text-red-800 text-[10px] font-bold px-[6px] py-[2px] rounded">
              {total > 0 ? Math.round((absent / total) * 100) : 0}%
            </span>
          </div>
          <span className="font-extrabold text-red-600 text-[28px]">{absent}</span>
        </div>
        <div className="bg-white border border-brand-border rounded-[16px] p-[20px] flex flex-col gap-[6px] shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-brand-text-dim text-[11px] font-bold tracking-[0.5px] uppercase">EXCUSED</span>
            <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-[6px] py-[2px] rounded">
              {total > 0 ? Math.round((excused / total) * 100) : 0}%
            </span>
          </div>
          <span className="font-extrabold text-amber-600 text-[28px]">{excused}</span>
        </div>
      </div>

      <div className="bg-white border border-brand-border rounded-[16px] shadow-sm overflow-hidden flex flex-col w-full">
        <div className="p-[20px] border-b border-brand-border bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-[12px] w-full sm:w-auto">
            <div className="relative w-full sm:w-[240px]">
              <Search className="absolute left-[12px] top-1/2 -translate-y-1/2 text-brand-text-dim" size={16} />
              <input type="text" placeholder="Search name or NIM..." value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white border border-brand-border text-brand-text placeholder-brand-text-dim/60 rounded-[8px] pl-[36px] pr-[12px] py-[8px] text-[13px] focus:outline-none focus:border-brand-secondary" />
            </div>
            <div className="flex p-[3px] bg-slate-100 rounded-[8px] border border-brand-border/40">
              {["all", "present", "absent", "excused", "late"].map((f) => (
                <button key={f} onClick={() => setStatusFilter(f)}
                  className={cn("px-[12px] py-[6px] text-[11px] font-bold uppercase rounded-[6px] cursor-pointer transition-all",
                    statusFilter === f ? "bg-white text-brand-primary shadow-sm" : "text-brand-text-dim hover:text-brand-text"
                  )}>
                  {f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-[8px] items-center shrink-0">
            <button onClick={handleMarkAllPresent} disabled={filteredStudents.length === 0}
              className="bg-white border border-brand-border hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none text-brand-primary font-bold text-[11px] tracking-[0.5px] uppercase px-[16px] py-[8px] rounded-[8px] cursor-pointer transition-all">
              Mark Filtered Present
            </button>
          </div>
        </div>

        <div className="w-full overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="bg-slate-50 border-b border-brand-border text-brand-text-dim text-[11px] font-bold uppercase tracking-[1px]">
                <th className="px-[24px] py-[16px] w-[100px]">Status Check</th>
                <th className="px-[24px] py-[16px]">Student Name</th>
                <th className="px-[24px] py-[16px]">NIM / ID</th>
                <th className="px-[24px] py-[16px] text-right">Attendance Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredStudents.length > 0 ? filteredStudents.map((student, idx) => {
                const orig = originalStudents.find((o) => o.id === student.id);
                const isModified = orig && orig.status !== student.status;
                return (
                  <tr key={student.id} className={cn("border-b border-brand-border/40 hover:bg-slate-50/50 transition-colors", idx % 2 === 1 ? "bg-slate-50/20" : "bg-white")}>
                    <td className="px-[24px] py-[18px]">
                      {isModified ? (
                        <span className="bg-brand-secondary/10 text-brand-secondary border border-brand-secondary/30 text-[9px] font-extrabold px-[8px] py-[3px] rounded-full uppercase tracking-[0.5px]">Modified</span>
                      ) : (
                        <span className="text-brand-text-dim/40 text-[11px] font-medium pl-[8px]">-</span>
                      )}
                    </td>
                    <td className="px-[24px] py-[18px]">
                      <div className="flex items-center gap-[12px] min-w-0">
                        <div className="size-[32px] bg-slate-100 border border-brand-border/60 text-brand-primary text-[12px] font-extrabold flex items-center justify-center rounded-[8px] shrink-0">{student.initials}</div>
                        <span className="font-bold text-[14px] text-brand-primary truncate">{student.name}</span>
                      </div>
                    </td>
                    <td className="px-[24px] py-[18px]">
                      <span className="font-mono text-brand-text-dim text-[13px]">{student.nim}</span>
                    </td>
                    <td className="px-[24px] py-[18px]">
                      <div className="flex justify-end items-center">
                        <div className="inline-flex p-[3px] bg-slate-100 rounded-[10px] border border-brand-border/30">
                          {["present", "absent", "excused", "late"].map((status) => (
                            <button key={status} onClick={() => handleStatusChange(student.id, status)}
                              className={cn("px-[12px] py-[6px] text-[11px] font-bold uppercase rounded-[8px] cursor-pointer transition-all flex items-center gap-[4px]",
                                student.status === status
                                  ? status === "present" ? "bg-emerald-600 text-white shadow-sm"
                                    : status === "absent" ? "bg-red-600 text-white shadow-sm"
                                      : status === "late" ? "bg-orange-600 text-white shadow-sm"
                                        : "bg-amber-600 text-white shadow-sm"
                                  : "text-brand-text-dim hover:bg-white/50"
                              )}>
                              {status === "present" ? <CheckCircle size={12} /> : status === "absent" ? <XCircle size={12} /> : <AlertCircle size={12} />}
                              <span>{status.charAt(0).toUpperCase() + status.slice(1)}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              }) : (
                <tr><td colSpan={4} className="px-[24px] py-[48px] text-center text-brand-text-dim italic">No students match the selected search filters.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="p-[20px] bg-slate-50 border-t border-brand-border flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-brand-text-dim text-[12px]">
            <HelpCircle size={16} />
            <span>Updates will instantly adjust student check-in telemetry records.</span>
          </div>
          <div className="flex gap-[12px] items-center shrink-0">
            {hasChanges && (
              <button onClick={handleReset} className="bg-white border border-brand-border hover:bg-slate-100 text-brand-text font-bold text-[12px] uppercase tracking-[0.5px] px-[16px] py-[10px] rounded-[8px] transition-all flex items-center gap-[8px] cursor-pointer">
                <RotateCcw size={14} />
                <span>Discard Changes</span>
              </button>
            )}
            <button onClick={handleSave} disabled={!hasChanges || saving}
              className={cn("font-bold text-[12px] uppercase tracking-[0.5px] px-[20px] py-[10px] rounded-[8px] transition-all flex items-center gap-[8px] shadow-sm",
                hasChanges && !saving ? "bg-brand-secondary hover:bg-brand-primary text-white cursor-pointer" : "bg-slate-200 text-slate-400 cursor-not-allowed")}>
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              <span>{saving ? "Saving..." : "Save Modifications"}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
