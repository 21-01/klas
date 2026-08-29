import { useState, useEffect } from "react";
import { Link } from "react-router";
import {
  TrendingUp, BookOpen, Clock, Search, Download, ExternalLink, Calendar,
  AlertCircle, CheckCircle, FileText, BarChart3, Users, Loader2
} from "lucide-react";
import { cn } from "~/lib/utils";
import { api } from "~/lib/api";
import { useToast } from "~/components/Toast";

export function meta() {
  return [
    { title: "Academic Dashboard & Reports - Klas." },
  ];
}

export default function DosenReport() {
  const toast = useToast();
  const [courses, setCourses] = useState<any[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    api.getDosenDashboard()
      .then((data) => {
        setCourses(data.courses);
        if (data.courses.length > 0) {
          setSelectedCourseId(data.courses[0].jadwal_id);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedCourseId) return;
    setLoading(true);
    api.getDosenReport(selectedCourseId)
      .then(setReport)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [selectedCourseId]);

  const handleExport = async () => {
    if (!selectedCourseId) return;
    setExporting(true);
    try {
      const csv = await api.exportReport(selectedCourseId);
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `report-${selectedCourseId}.csv`;
      a.click(); URL.revokeObjectURL(url);
      toast.success("Report exported");
    } catch (err: any) {
      toast.error(err.message || "Failed to export report");
    } finally {
      setExporting(false);
    }
  };

  const filteredCourses = courses.filter((c) => {
    const matchesSearch = c.mata_kuliah.nama_mk.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.mata_kuliah.kode_mk.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = activeTab === "all" ||
      (activeTab === "in-session" && c.latest_session?.status === "live") ||
      (activeTab === "completed" && c.latest_session?.status === "completed");
    return matchesSearch && matchesStatus;
  });

  if (loading && !report) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="animate-spin text-brand-secondary" size={32} /></div>;
  }

  return (
    <div className="flex flex-col gap-[40px] w-full">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 w-full pb-2 border-b border-brand-border/40">
        <div className="flex flex-col items-start gap-[4px]">
          <span className="font-semibold text-brand-text-dim text-[12px] tracking-[1.2px] uppercase">
            ANALYTICS & ARCHIVES
          </span>
          <h1 className="font-bold text-brand-primary text-[32px] tracking-[-0.64px] leading-tight">
            Academic Dashboard
          </h1>
        </div>

        <div className="flex gap-[12px] items-center shrink-0">
          <select value={selectedCourseId} onChange={(e) => setSelectedCourseId(e.target.value)}
            className="bg-white border border-brand-border text-brand-text rounded-[10px] px-[16px] py-[10px] font-bold text-[13px] focus:outline-none focus:border-brand-secondary cursor-pointer">
            {courses.map((c) => (
              <option key={c.jadwal_id} value={c.jadwal_id}>
                {c.mata_kuliah.kode_mk} - {c.mata_kuliah.nama_mk}
              </option>
            ))}
          </select>
          <button onClick={handleExport} disabled={exporting}
            className="bg-white border border-brand-border hover:bg-slate-50 text-brand-primary font-bold text-[13px] tracking-[0.6px] px-[20px] py-[10px] rounded-[10px] shadow-sm transition-all flex items-center gap-[8px] cursor-pointer shrink-0">
            {exporting ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {report && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-[24px] w-full">
            <div className="bg-white border border-brand-border rounded-[16px] p-[24px] flex flex-col gap-[12px] shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-brand-text-dim text-[11px] font-bold tracking-[0.5px] uppercase">Course</span>
                <div className="p-2 bg-slate-100 rounded-[8px] text-brand-primary"><BookOpen size={16} /></div>
              </div>
              <div className="flex items-baseline gap-[8px]">
                <span className="font-extrabold text-brand-primary text-[36px] leading-none">{report.course.kode_mk}</span>
                <span className="text-brand-text-dim text-[13px] font-semibold">{report.course.nama_mk}</span>
              </div>
            </div>
            <div className="bg-white border border-brand-border rounded-[16px] p-[24px] flex flex-col gap-[12px] shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-brand-text-dim text-[11px] font-bold tracking-[0.5px] uppercase">Attendance Rate</span>
                <div className="p-2 bg-slate-100 rounded-[8px] text-brand-primary"><TrendingUp size={16} /></div>
              </div>
              <div className="flex items-baseline gap-[8px]">
                <span className="font-extrabold text-brand-primary text-[36px] leading-none">{report.overall_attendance_rate}%</span>
              </div>
            </div>
            <div className="bg-white border border-brand-border rounded-[16px] p-[24px] flex flex-col gap-[12px] shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-brand-text-dim text-[11px] font-bold tracking-[0.5px] uppercase">Total Sessions</span>
                <div className="p-2 bg-slate-100 rounded-[8px] text-brand-primary"><Clock size={16} /></div>
              </div>
              <div className="flex items-baseline gap-[8px]">
                <span className="font-extrabold text-brand-primary text-[36px] leading-none">{report.total_sessions}</span>
                <span className="text-brand-text-dim text-[13px] font-semibold">{report.total_students} students</span>
              </div>
            </div>
          </div>

          <div className="bg-white border border-brand-border rounded-[16px] shadow-sm overflow-hidden flex flex-col w-full">
            <div className="p-[20px] border-b border-brand-border bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <h3 className="font-bold text-brand-primary text-[18px]">Course Management History</h3>
              <div className="relative w-full sm:w-[240px]">
                <Search className="absolute left-[12px] top-1/2 -translate-y-1/2 text-brand-text-dim" size={16} />
                <input type="text" placeholder="Search code or title..." value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-white border border-brand-border text-brand-text placeholder-brand-text-dim/60 rounded-[8px] pl-[36px] pr-[12px] py-[8px] text-[13px] focus:outline-none focus:border-brand-secondary" />
              </div>
            </div>
            <div className="w-full overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="bg-slate-50 border-b border-brand-border text-brand-text-dim text-[11px] font-bold uppercase tracking-[1px]">
                    <th className="px-[24px] py-[16px]">Student</th>
                    <th className="px-[24px] py-[16px]">NIM</th>
                    <th className="px-[24px] py-[16px]">GPA</th>
                    <th className="px-[24px] py-[16px]">Present</th>
                    <th className="px-[24px] py-[16px]">Absent</th>
                    <th className="px-[24px] py-[16px]">Excused</th>
                    <th className="px-[24px] py-[16px]">Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {report.students.map((s: any, idx: number) => (
                    <tr key={s.nim} className={cn("border-b border-brand-border/40 hover:bg-slate-50/50 transition-colors", idx % 2 === 1 ? "bg-slate-50/20" : "bg-white")}>
                      <td className="px-[24px] py-[16px]"><span className="font-bold text-[14px] text-brand-primary">{s.nama}</span></td>
                      <td className="px-[24px] py-[16px] font-mono text-brand-text-dim text-[13px]">{s.nim}</td>
                      <td className="px-[24px] py-[16px] text-brand-text text-[13px]">{s.gpa}</td>
                      <td className="px-[24px] py-[16px] text-emerald-600 font-bold">{s.attendance.present}</td>
                      <td className="px-[24px] py-[16px] text-red-600 font-bold">{s.attendance.absent}</td>
                      <td className="px-[24px] py-[16px] text-amber-600 font-bold">{s.attendance.excused}</td>
                      <td className="px-[24px] py-[16px] font-extrabold text-brand-primary">{s.rate}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
