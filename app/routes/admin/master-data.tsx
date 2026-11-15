import { useState, useEffect } from "react";
import { Plus, Search, Filter, Edit2, Trash2, RotateCcw, ChevronLeft, ChevronRight, UserPlus, BookOpen, UserCheck, X, Loader2 } from "lucide-react";
import ClickAwayListener from "~/components/ClickAwayListener";
import { cn } from "~/lib/utils";
import { api } from "~/lib/api";
import { useToast } from "~/components/Toast";

export function meta() {
  return [
    { title: "Master Data Management - Admin Console - Klas." },
  ];
}

export default function AdminMasterData() {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<"mahasiswa" | "dosen" | "matakuliah">("mahasiswa");
  const [searchQuery, setSearchQuery] = useState("");
  const [prodiFilter, setProdiFilter] = useState("all");
  const [yearFilter, setYearFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [genderFilter, setGenderFilter] = useState("all");
  const [showFilterCard, setShowFilterCard] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const [students, setStudents] = useState<any[]>([]);
  const [lecturers, setLecturers] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [prodiList, setProdiList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [formName, setFormName] = useState("");
  const [formCode, setFormCode] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [formProdi, setFormProdi] = useState("");
  const [formStatus, setFormStatus] = useState("active");
  const [formSks, setFormSks] = useState(3);
  const [formLecturer, setFormLecturer] = useState("");
  const [formYear, setFormYear] = useState("2024");
  const [formGender, setFormGender] = useState("Male");
  const [selectedEditId, setSelectedEditId] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [s, d, c, p] = await Promise.all([
        api.crudMahasiswa("list", { limit: 100 }),
        api.crudDosen("list", { limit: 100 }),
        api.crudMataKuliah("list", { limit: 100 }),
        api.crudProdi("list"),
      ]);
      setStudents(Array.isArray(s?.data) ? s.data : Array.isArray(s?.mahasiswa) ? s.mahasiswa : []);
      setLecturers(Array.isArray(d?.data) ? d.data : []);
      setCourses(Array.isArray(c?.data) ? c.data : []);
      setProdiList(Array.isArray(p?.data) ? p.data : []);
    } catch { /* ignore */ }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const handleTabChange = (tab: "mahasiswa" | "dosen" | "matakuliah") => {
    setActiveTab(tab);
    setSearchQuery("");
    setProdiFilter("all");
    setYearFilter("all");
    setStatusFilter("all");
    setGenderFilter("all");
    setShowFilterCard(false);
  };

  const getFilteredData = () => {
    const q = searchQuery.toLowerCase();
    if (activeTab === "mahasiswa") {
      return students.filter((s: any) =>
        (s.nama?.toLowerCase().includes(q) || s.nim?.includes(q)) &&
        (prodiFilter === "all" || s.prodi_id?.toString() === prodiFilter) &&
        (yearFilter === "all" || s.angkatan === yearFilter) &&
        (statusFilter === "all" || (statusFilter === "active" ? s.is_active !== false : s.is_active === false)) &&
        (genderFilter === "all" || s.jenis_kelamin === (genderFilter === "Male" ? "L" : "P"))
      );
    } else if (activeTab === "dosen") {
      return lecturers.filter((d: any) =>
        (d.nama?.toLowerCase().includes(q) || d.nip?.includes(q) || d.nidn?.includes(q)) &&
        (prodiFilter === "all" || d.prodi_id?.toString() === prodiFilter) &&
        (statusFilter === "all" || (statusFilter === "active" ? d.is_active !== false : d.is_active === false)) &&
        (genderFilter === "all" || d.jenis_kelamin === (genderFilter === "Male" ? "L" : "P"))
      );
    } else {
      return courses.filter((c: any) =>
        (c.nama_mk?.toLowerCase().includes(q) || c.kode_mk?.toLowerCase().includes(q)) &&
        (statusFilter === "all" || (statusFilter === "active" ? c.is_active !== false : c.is_active === false))
      );
    }
  };

  const filteredData = getFilteredData();

  const toggleStatus = async (id: string, type: "student" | "lecturer" | "course") => {
    const label = type === "student" ? "Student" : type === "lecturer" ? "Lecturer" : "Course";
    try {
      if (type === "student") {
        await api.crudMahasiswa("update", { mahasiswa_id: id, is_active: !students.find((s: any) => s.mahasiswa_id === id)?.is_active });
      } else if (type === "lecturer") {
        await api.crudDosen("update", { dosen_id: id, is_active: !lecturers.find((d: any) => d.dosen_id === id)?.is_active });
      } else {
        await api.crudMataKuliah("update", { mk_id: id, is_active: !courses.find((c: any) => c.mk_id === id)?.is_active });
      }
      await fetchData();
      toast.success(`${label} status updated`);
    } catch (err: any) {
      toast.error(err.message || `Failed to update ${label.toLowerCase()} status`);
    }
  };

  const handleDelete = async (id: string, type: "student" | "lecturer" | "course") => {
    const label = type === "student" ? "Student" : type === "lecturer" ? "Lecturer" : "Course";
    try {
      if (type === "student") await api.crudMahasiswa("update", { mahasiswa_id: id, is_active: false });
      else if (type === "lecturer") await api.crudDosen("update", { dosen_id: id, is_active: false });
      else await api.crudMataKuliah("update", { mk_id: id, is_active: false });
      await fetchData();
      toast.warning(`${label} deactivated`);
    } catch (err: any) {
      toast.error(err.message || `Failed to deactivate ${label.toLowerCase()}`);
    }
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (activeTab === "mahasiswa") {
        await api.crudMahasiswa("create", { nama: formName, nim: formCode, prodi_id: Number(formProdi) || 1, angkatan: formYear, jenis_kelamin: formGender === "Male" ? "L" : "P", email: formEmail || undefined, password: formPassword || undefined });
      } else if (activeTab === "dosen") {
        await api.crudDosen("create", { nama: formName, nip: formCode, prodi_id: Number(formProdi) || 1, jenis_kelamin: formGender === "Male" ? "L" : "P", email: formEmail || undefined, password: formPassword || undefined });
      } else {
        await api.crudMataKuliah("create", { kode_mk: formCode, nama_mk: formName, sks: formSks, prodi_id: Number(formProdi) || 1 });
      }
      await fetchData();
      resetForm();
      setShowAddModal(false);
      toast.success(`${activeTab === "mahasiswa" ? "Student" : activeTab === "dosen" ? "Lecturer" : "Course"} created`);
    } catch (err: any) {
      toast.error(err.message || "Failed to create record");
    }
    setSaving(false);
  };

  const handleEditClick = (id: string) => {
    setSelectedEditId(id);
    let item: any;
    if (activeTab === "mahasiswa") item = students.find((x: any) => x.mahasiswa_id === id);
    else if (activeTab === "dosen") item = lecturers.find((x: any) => x.dosen_id === id);
    else item = courses.find((x: any) => x.mk_id === id);
    if (!item) return;
    setFormName(item.nama || item.nama_mk || "");
    setFormCode(item.nim || item.nip || item.nidn || item.kode_mk || "");
    setFormProdi(item.prodi_id?.toString() || "");
    setFormEmail(item.users?.email || "");
    setFormPassword("");
    setFormStatus(item.is_active !== false ? "active" : "inactive");
    setFormYear(item.angkatan || "2024");
    setFormGender(item.jenis_kelamin === "L" ? "Male" : "Female");
    setFormSks(item.sks || 3);
    setFormLecturer(item.dosen?.nama || "");
    setShowEditModal(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEditId) return;
    setSaving(true);
    try {
      if (activeTab === "mahasiswa") {
        await api.crudMahasiswa("update", { mahasiswa_id: selectedEditId, nama: formName, nim: formCode, prodi_id: Number(formProdi) || 1, angkatan: formYear, jenis_kelamin: formGender === "Male" ? "L" : "P", email: formEmail || undefined, password: formPassword || undefined });
      } else if (activeTab === "dosen") {
        await api.crudDosen("update", { dosen_id: selectedEditId, nama: formName, nip: formCode, prodi_id: Number(formProdi) || 1, jenis_kelamin: formGender === "Male" ? "L" : "P", email: formEmail || undefined, password: formPassword || undefined });
      } else {
        await api.crudMataKuliah("update", { mk_id: selectedEditId, kode_mk: formCode, nama_mk: formName, sks: formSks, prodi_id: Number(formProdi) || 1 });
      }
      await fetchData();
      resetForm();
      setShowEditModal(false);
      toast.success(`${activeTab === "mahasiswa" ? "Student" : activeTab === "dosen" ? "Lecturer" : "Course"} updated`);
    } catch (err: any) {
      toast.error(err.message || "Failed to update record");
    }
    setSaving(false);
  };

  const resetForm = () => {
    setFormName(""); setFormCode(""); setFormEmail(""); setFormPassword(""); setFormProdi("1"); setFormStatus("active");
    setFormSks(3); setFormLecturer(""); setFormYear("2024"); setFormGender("Male");
    setSelectedEditId(null);
  };

  const prodiMap = Object.fromEntries(prodiList.map((p: any) => [p.prodi_id, p.nama_prodi]));

  const renderInitials = (name: string) =>
    name?.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2) || "?";

  if (loading && !students.length && !lecturers.length && !courses.length) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="animate-spin text-brand-secondary" size={32} /></div>;
  }

  return (
    <div className="flex flex-col gap-[20px] sm:gap-[24px] lg:gap-[32px] w-full">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 w-full pb-2 border-b border-brand-border/40">
        <div className="flex flex-col items-start gap-[4px]">
          <h1 className="font-bold text-brand-primary text-[22px] sm:text-[26px] lg:text-[32px] tracking-[-0.4px] sm:tracking-[-0.64px] leading-tight">Master Data Management</h1>
        </div>
      </div>

      <div className="bg-white border border-brand-border rounded-[16px] shadow-sm flex flex-col w-full">
        <div className="overflow-hidden rounded-t-[16px]">
          <div className="border-b border-brand-border">
            <div className="flex bg-slate-50/50 overflow-x-auto">
              {(["mahasiswa", "dosen", "matakuliah"] as const).map((tab) => (
                <button key={tab} onClick={() => handleTabChange(tab)}
                  className={cn("px-[20px] sm:px-[32px] py-[14px] sm:py-[16px] font-bold text-[12px] sm:text-[13px] uppercase tracking-[0.5px] border-b-2 transition-all cursor-pointer whitespace-nowrap",
                    activeTab === tab ? "border-brand-primary text-brand-primary bg-white" : "border-transparent text-brand-text-dim hover:text-brand-text")}>
                  {tab === "mahasiswa" ? "Students" : tab === "dosen" ? "Lecturers" : "Courses"}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="p-[16px] sm:p-[20px] border-b border-brand-border bg-slate-50/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
          <div className="flex items-center gap-[10px] sm:gap-[12px] flex-1 min-w-0">
            <div className="relative flex-1 sm:max-w-[280px]">
              <Search className="absolute left-[12px] top-1/2 -translate-y-1/2 text-brand-text-dim" size={16} />
              <input type="text" placeholder={`Search ${activeTab === "mahasiswa" ? "name or NIM" : activeTab === "dosen" ? "name or NIDN" : "title or code"}...`}
                value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white border border-brand-border text-brand-text placeholder-brand-text-dim/60 rounded-[8px] pl-[36px] pr-[12px] py-[8px] text-[13px] focus:outline-none focus:border-brand-secondary" />
            </div>

            <div className="relative shrink-0">
              <button onClick={() => setShowFilterCard(!showFilterCard)}
                className={cn("border border-brand-border text-brand-text font-bold text-[13px] px-[16px] py-[8px] rounded-[8px] transition-all flex items-center gap-[8px] cursor-pointer bg-white hover:bg-slate-50",
                  showFilterCard && "border-brand-secondary bg-slate-50")}>
                <Filter size={14} /><span>Filter</span>
              </button>
              {showFilterCard && (
                <ClickAwayListener onClickAway={() => setShowFilterCard(false)} className="absolute left-0 mt-2 w-[320px] bg-white border border-brand-border rounded-[12px] shadow-xl p-[24px] z-50 flex flex-col gap-[16px]">
                  <div className="flex items-center justify-between border-b border-brand-border/40 pb-[12px]">
                    <span className="font-bold text-brand-primary text-[16px]">Filters</span>
                    <button onClick={() => { setProdiFilter("all"); setYearFilter("all"); setGenderFilter("all"); setStatusFilter("all"); }}
                      className="text-brand-secondary hover:underline text-[12px] font-bold">Reset</button>
                  </div>
                  {activeTab !== "matakuliah" && (
                    <div className="flex flex-col gap-[4px]">
                      <label className="text-[10px] font-bold uppercase text-brand-text-dim">Department</label>
                      <select value={prodiFilter} onChange={(e) => setProdiFilter(e.target.value)}
                        className="w-full bg-slate-50 border border-brand-border text-brand-text rounded-[6px] px-[10px] py-[6px] text-[12px] focus:outline-none cursor-pointer font-semibold">
                        <option value="all">All</option>
                        {prodiList.map((p: any) => (
                          <option key={p.prodi_id} value={String(p.prodi_id)}>{p.nama_prodi}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  {activeTab === "mahasiswa" && (
                    <div className="flex flex-col gap-[4px]">
                      <label className="text-[10px] font-bold uppercase text-brand-text-dim">Year</label>
                      <select value={yearFilter} onChange={(e) => setYearFilter(e.target.value)}
                        className="w-full bg-slate-50 border border-brand-border text-brand-text rounded-[6px] px-[10px] py-[6px] text-[12px] focus:outline-none cursor-pointer font-semibold">
                        <option value="all">All</option>
                        {Array.from(new Set(students.map((s: any) => s.angkatan))).filter(Boolean).map((y) => (
                          <option key={String(y)} value={String(y)}>{y}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  {activeTab !== "matakuliah" && (
                    <div className="flex flex-col gap-[4px]">
                      <label className="text-[10px] font-bold uppercase text-brand-text-dim">Gender</label>
                      <select value={genderFilter} onChange={(e) => setGenderFilter(e.target.value)}
                        className="w-full bg-slate-50 border border-brand-border text-brand-text rounded-[6px] px-[10px] py-[6px] text-[12px] focus:outline-none cursor-pointer font-semibold">
                        <option value="all">All</option><option value="Male">Male</option><option value="Female">Female</option>
                      </select>
                    </div>
                  )}
                  <div className="flex flex-col gap-[4px]">
                    <label className="text-[10px] font-bold uppercase text-brand-text-dim">Status</label>
                    <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
                      className="w-full bg-slate-50 border border-brand-border text-brand-text rounded-[6px] px-[10px] py-[6px] text-[12px] focus:outline-none cursor-pointer font-semibold">
                      <option value="all">All</option><option value="active">Active</option><option value="inactive">Inactive</option>
                    </select>
                  </div>
                </ClickAwayListener>
              )}
            </div>
          </div>

          <button onClick={() => { resetForm(); setShowAddModal(true); }}
            aria-label={`Add New ${activeTab === "mahasiswa" ? "Student" : activeTab === "dosen" ? "Lecturer" : "Course"}`}
            title={`Add New ${activeTab === "mahasiswa" ? "Student" : activeTab === "dosen" ? "Lecturer" : "Course"}`}
            className="bg-brand-secondary hover:bg-brand-primary text-white font-bold text-[12px] tracking-[0.5px] uppercase px-[14px] xl:px-[20px] py-[10px] rounded-[8px] transition-all flex items-center justify-center gap-[8px] shadow-sm cursor-pointer shrink-0 self-start sm:self-auto">
            <Plus size={16} />
            <span className="hidden xl:inline">Add New {activeTab === "mahasiswa" ? "Student" : activeTab === "dosen" ? "Lecturer" : "Course"}</span>
          </button>
        </div>

        <div className="w-full overflow-hidden rounded-b-[16px]">
          {/* Below md: Card pattern */}
          <div className="md:hidden flex flex-col gap-[10px] p-[12px] bg-slate-50/20">
            {filteredData.length > 0 ? filteredData.map((row: any, idx: number) => (
              <div key={row.mahasiswa_id || row.dosen_id || row.mk_id || idx}
                className="bg-white border border-brand-border/60 rounded-[12px] p-[14px] flex flex-col gap-[10px] shadow-sm">
                <div className="flex items-center justify-between gap-[8px]">
                  <div className="flex items-center gap-[10px] min-w-0">
                    <div className={cn("size-[32px] text-[12px] font-extrabold flex items-center justify-center rounded-[8px] shrink-0 border",
                      activeTab === "dosen" ? "bg-brand-secondary/10 border-brand-secondary/20 text-brand-secondary" : "bg-slate-100 border-brand-border/60 text-brand-primary")}>
                      {renderInitials(activeTab === "matakuliah" ? row.nama_mk : row.nama)}
                    </div>
                    <span className="font-bold text-[14px] text-brand-primary truncate whitespace-nowrap">
                      {activeTab === "matakuliah" ? row.nama_mk : row.nama}
                    </span>
                  </div>
                  <button onClick={() => toggleStatus(row.mahasiswa_id || row.dosen_id || row.mk_id, activeTab === "mahasiswa" ? "student" : activeTab === "dosen" ? "lecturer" : "course")}
                    className={cn("text-[10px] font-bold px-[8px] py-[3px] rounded-full uppercase tracking-[0.5px] border cursor-pointer shrink-0",
                      row.is_active !== false ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-slate-100 text-slate-600 border-slate-200")}>
                    {row.is_active !== false ? "Active" : "Inactive"}
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[12px] text-brand-text-dim pt-2 border-t border-brand-border/30">
                  {activeTab === "mahasiswa" && (
                    <>
                      <div><span className="font-semibold text-brand-text">NIM:</span> <span className="font-mono">{row.nim}</span></div>
                      <div><span className="font-semibold text-brand-text">Year:</span> {row.angkatan}</div>
                      <div className="col-span-2 truncate"><span className="font-semibold text-brand-text">Prodi:</span> {row.program_studi?.nama_prodi || prodiMap[row.prodi_id] || row.prodi_id}</div>
                      <div><span className="font-semibold text-brand-text">Gender:</span> {row.jenis_kelamin === "L" ? "Male" : "Female"}</div>
                    </>
                  )}
                  {activeTab === "dosen" && (
                    <>
                      <div className="col-span-2"><span className="font-semibold text-brand-text">NIP/NIDN:</span> <span className="font-mono">{row.nip || row.nidn || "-"}</span></div>
                      <div className="col-span-2 truncate"><span className="font-semibold text-brand-text">Prodi:</span> {row.program_studi?.nama_prodi || prodiMap[row.prodi_id] || row.prodi_id}</div>
                      <div><span className="font-semibold text-brand-text">Gender:</span> {row.jenis_kelamin === "L" ? "Male" : "Female"}</div>
                    </>
                  )}
                  {activeTab === "matakuliah" && (
                    <>
                      <div><span className="font-semibold text-brand-text">Code:</span> <span className="font-mono">{row.kode_mk}</span></div>
                      <div><span className="font-semibold text-brand-text">SKS:</span> {row.sks} SKS</div>
                    </>
                  )}
                </div>

                <div className="flex items-center justify-end gap-[8px] pt-1 border-t border-brand-border/30">
                  <button onClick={() => handleEditClick(row.mahasiswa_id || row.dosen_id || row.mk_id)}
                    className="p-1.5 text-brand-text-dim hover:text-brand-text hover:bg-slate-100 rounded-[6px] transition-colors cursor-pointer flex items-center gap-1 text-[12px]">
                    <Edit2 size={14} /><span>Edit</span>
                  </button>
                  {row.is_active === false ? (
                    <button onClick={() => toggleStatus(row.mahasiswa_id || row.dosen_id || row.mk_id, activeTab === "mahasiswa" ? "student" : activeTab === "dosen" ? "lecturer" : "course")}
                      className="p-1.5 text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 rounded-[6px] transition-colors cursor-pointer flex items-center gap-1 text-[12px]">
                      <RotateCcw size={14} /><span>Activate</span>
                    </button>
                  ) : (
                    <button onClick={() => handleDelete(row.mahasiswa_id || row.dosen_id || row.mk_id, activeTab === "mahasiswa" ? "student" : activeTab === "dosen" ? "lecturer" : "course")}
                      className="p-1.5 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-[6px] transition-colors cursor-pointer flex items-center gap-1 text-[12px]">
                      <Trash2 size={14} /><span>Delete</span>
                    </button>
                  )}
                </div>
              </div>
            )) : (
              <div className="p-8 text-center text-brand-text-dim italic bg-white rounded-[12px] border border-brand-border/40">No records found.</div>
            )}
          </div>

          {/* md and above: Table */}
          <div className="hidden md:block overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="bg-slate-50 border-b border-brand-border text-brand-text-dim text-[11px] font-bold uppercase tracking-[1px]">
                {activeTab === "mahasiswa" && <><th className="px-[24px] py-[16px]">Name</th><th className="px-[24px] py-[16px]">NIM</th><th className="px-[24px] py-[16px]">Prodi</th><th className="px-[24px] py-[16px]">Year</th><th className="px-[24px] py-[16px]">Gender</th><th className="px-[24px] py-[16px]">Status</th></>}
                {activeTab === "dosen" && <><th className="px-[24px] py-[16px]">Name</th><th className="px-[24px] py-[16px]">NIP/NIDN</th><th className="px-[24px] py-[16px]">Prodi</th><th className="px-[24px] py-[16px]">Gender</th><th className="px-[24px] py-[16px]">Status</th></>}
                {activeTab === "matakuliah" && <><th className="px-[24px] py-[16px]">Name</th><th className="px-[24px] py-[16px]">Code</th><th className="px-[24px] py-[16px]">SKS</th><th className="px-[24px] py-[16px]">Status</th></>}
                <th className="px-[24px] py-[16px] text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredData.length > 0 ? filteredData.map((row: any, idx: number) => (
                <tr key={row.mahasiswa_id || row.dosen_id || row.mk_id || idx}
                  className={cn("border-b border-brand-border/40 hover:bg-slate-50/50 transition-colors", idx % 2 === 1 ? "bg-slate-50/10" : "bg-white")}>
                  {activeTab === "mahasiswa" && (
                    <>
                      <td className="px-[24px] py-[16px]">
                        <div className="flex items-center gap-[12px] min-w-0">
                          <div className="size-[32px] bg-slate-100 border border-brand-border/60 text-brand-primary text-[12px] font-extrabold flex items-center justify-center rounded-[8px] shrink-0">
                            {renderInitials(row.nama)}
                          </div>
                          <span className="font-bold text-[14px] text-brand-primary truncate whitespace-nowrap max-w-[200px] xl:max-w-[300px]">{row.nama}</span>
                        </div>
                      </td>
                      <td className="font-mono text-[13px] text-brand-text-dim px-[24px] whitespace-nowrap">{row.nim}</td>
                      <td className="text-brand-text-dim text-[13px] px-[24px] whitespace-nowrap">{row.program_studi?.nama_prodi || prodiMap[row.prodi_id] || row.prodi_id}</td>
                      <td className="text-brand-text font-semibold text-[13px] px-[24px] whitespace-nowrap">{row.angkatan}</td>
                      <td className="text-brand-text-dim text-[13px] px-[24px] whitespace-nowrap">{row.jenis_kelamin === "L" ? "Male" : "Female"}</td>
                      <td className="px-[24px] whitespace-nowrap">
                        <button onClick={() => toggleStatus(row.mahasiswa_id, "student")}
                          className={cn("text-[10px] font-bold px-[10px] py-[4px] rounded-full uppercase tracking-[0.5px] border cursor-pointer",
                            row.is_active !== false ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-slate-100 text-slate-600 border-slate-200")}>
                          {row.is_active !== false ? "Active" : "Inactive"}
                        </button>
                      </td>
                    </>
                  )}
                  {activeTab === "dosen" && (
                    <>
                      <td className="px-[24px] py-[16px]">
                        <div className="flex items-center gap-[12px] min-w-0">
                          <div className="size-[32px] bg-brand-secondary/10 border border-brand-secondary/20 text-brand-secondary text-[12px] font-extrabold flex items-center justify-center rounded-[8px] shrink-0">{renderInitials(row.nama)}</div>
                          <span className="font-bold text-[14px] text-brand-primary truncate whitespace-nowrap max-w-[200px] xl:max-w-[300px]">{row.nama}</span>
                        </div>
                      </td>
                      <td className="font-mono text-[13px] text-brand-text-dim px-[24px] whitespace-nowrap">{row.nip || row.nidn || "-"}</td>
                      <td className="text-brand-text-dim text-[13px] px-[24px] whitespace-nowrap">{row.program_studi?.nama_prodi || prodiMap[row.prodi_id] || row.prodi_id}</td>
                      <td className="text-brand-text-dim text-[13px] px-[24px] whitespace-nowrap">{row.jenis_kelamin === "L" ? "Male" : "Female"}</td>
                      <td className="px-[24px] whitespace-nowrap">
                        <button onClick={() => toggleStatus(row.dosen_id, "lecturer")}
                          className={cn("text-[10px] font-bold px-[10px] py-[4px] rounded-full uppercase tracking-[0.5px] border cursor-pointer",
                            row.is_active !== false ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-slate-100 text-slate-600 border-slate-200")}>
                          {row.is_active !== false ? "Active" : "Inactive"}
                        </button>
                      </td>
                    </>
                  )}
                  {activeTab === "matakuliah" && (
                    <>
                      <td className="px-[24px] py-[16px]">
                        <span className="font-bold text-[14px] text-brand-primary truncate whitespace-nowrap max-w-[200px] xl:max-w-[300px] block">{row.nama_mk}</span>
                      </td>
                      <td className="font-mono text-[13px] text-brand-text-dim px-[24px] whitespace-nowrap">{row.kode_mk}</td>
                      <td className="text-brand-text-dim text-[13px] px-[24px] whitespace-nowrap">{row.sks} SKS</td>
                      <td className="px-[24px] whitespace-nowrap">
                        <button onClick={() => toggleStatus(row.mk_id, "course")}
                          className={cn("text-[10px] font-bold px-[10px] py-[4px] rounded-full uppercase tracking-[0.5px] border cursor-pointer",
                            row.is_active !== false ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-slate-100 text-slate-600 border-slate-200")}>
                          {row.is_active !== false ? "Active" : "Inactive"}
                        </button>
                      </td>
                    </>
                  )}
                  <td className="px-[24px] py-[16px]">
                    <div className="flex items-center justify-end gap-[8px]">
                      <button onClick={() => handleEditClick(row.mahasiswa_id || row.dosen_id || row.mk_id)}
                        className="p-2 text-brand-text-dim hover:text-brand-text hover:bg-slate-100 rounded-[6px] transition-colors cursor-pointer"><Edit2 size={16} /></button>
                      {row.is_active === false ? (
                        <button onClick={() => toggleStatus(row.mahasiswa_id || row.dosen_id || row.mk_id, activeTab === "mahasiswa" ? "student" : activeTab === "dosen" ? "lecturer" : "course")}
                          className="p-2 text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 rounded-[6px] transition-colors cursor-pointer"><RotateCcw size={16} /></button>
                      ) : (
                        <button onClick={() => handleDelete(row.mahasiswa_id || row.dosen_id || row.mk_id, activeTab === "mahasiswa" ? "student" : activeTab === "dosen" ? "lecturer" : "course")}
                          className="p-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-[6px] transition-colors cursor-pointer"><Trash2 size={16} /></button>
                      )}
                    </div>
                  </td>
                </tr>
              )) : (
                <tr><td colSpan={6} className="px-[24px] py-[48px] text-center text-brand-text-dim italic">No records found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        </div>
      </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-brand-primary/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-brand-border rounded-[16px] shadow-2xl max-w-[500px] w-full flex flex-col overflow-hidden">
            <div className="px-[24px] py-[16px] bg-slate-50 border-b border-brand-border flex items-center justify-between">
              <h3 className="font-bold text-brand-primary text-[16px]">Add New {activeTab === "mahasiswa" ? "Student" : activeTab === "dosen" ? "Lecturer" : "Course"}</h3>
              <button onClick={() => setShowAddModal(false)} className="p-1 hover:bg-slate-200 text-brand-text-dim hover:text-brand-text rounded-full transition-colors cursor-pointer"><X size={18} /></button>
            </div>
            <form onSubmit={handleAddSubmit} className="p-[24px] flex flex-col gap-[16px]">
              <div className="flex flex-col gap-[6px]">
                <label className="text-[11px] font-bold uppercase text-brand-text-dim">Name / Title</label>
                <input type="text" required placeholder="e.g. John Doe" value={formName} onChange={(e) => setFormName(e.target.value)}
                  className="w-full bg-white border border-brand-border text-brand-text rounded-[8px] px-[12px] py-[8px] text-[13px] focus:outline-none focus:border-brand-secondary" />
              </div>
              <div className="flex flex-col gap-[6px]">
                <label className="text-[11px] font-bold uppercase text-brand-text-dim">{activeTab === "mahasiswa" ? "NIM" : activeTab === "dosen" ? "NIP/NIDN" : "Code"}</label>
                <input type="text" required value={formCode} onChange={(e) => setFormCode(e.target.value)}
                  className="w-full bg-white border border-brand-border text-brand-text rounded-[8px] px-[12px] py-[8px] text-[13px] focus:outline-none font-mono" />
              </div>
              {activeTab !== "matakuliah" && (
                <>
                  <div className="flex flex-col gap-[6px]">
                    <label className="text-[11px] font-bold uppercase text-brand-text-dim">Program Studi</label>
                    <select value={formProdi} onChange={(e) => setFormProdi(e.target.value)}
                      className="w-full bg-white border border-brand-border text-brand-text rounded-[8px] px-[12px] py-[8px] text-[13px] focus:outline-none cursor-pointer font-semibold">
                      {prodiList.map((p: any) => <option key={p.prodi_id} value={p.prodi_id}>{p.nama_prodi}</option>)}
                    </select>
                  </div>
                  <div className="flex flex-col gap-[6px]">
                    <label className="text-[11px] font-bold uppercase text-brand-text-dim">Gender</label>
                    <select value={formGender} onChange={(e) => setFormGender(e.target.value)}
                      className="w-full bg-white border border-brand-border text-brand-text rounded-[8px] px-[12px] py-[8px] text-[13px] focus:outline-none cursor-pointer font-semibold">
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                    </select>
                  </div>
                </>
              )}
              {activeTab !== "matakuliah" && (
                <>
                  <div className="flex flex-col gap-[6px]">
                    <label className="text-[11px] font-bold uppercase text-brand-text-dim">Email (for login)</label>
                    <input type="email" placeholder="user@example.com" value={formEmail} onChange={(e) => setFormEmail(e.target.value)}
                      className="w-full bg-white border border-brand-border text-brand-text rounded-[8px] px-[12px] py-[8px] text-[13px] focus:outline-none" />
                  </div>
                  <div className="flex flex-col gap-[6px]">
                    <label className="text-[11px] font-bold uppercase text-brand-text-dim">Password (for login)</label>
                    <input type="password" placeholder="Min. 6 characters" value={formPassword} onChange={(e) => setFormPassword(e.target.value)}
                      className="w-full bg-white border border-brand-border text-brand-text rounded-[8px] px-[12px] py-[8px] text-[13px] focus:outline-none" />
                  </div>
                </>
              )}
              {activeTab === "mahasiswa" && (
                <div className="flex flex-col gap-[6px]">
                  <label className="text-[11px] font-bold uppercase text-brand-text-dim">Year</label>
                  <select value={formYear} onChange={(e) => setFormYear(e.target.value)}
                    className="w-full bg-white border border-brand-border text-brand-text rounded-[8px] px-[12px] py-[8px] text-[13px] focus:outline-none cursor-pointer font-semibold">
                    {["2021","2022","2023","2024","2025"].map((y) => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
              )}
              {activeTab === "matakuliah" && (
                <div className="flex flex-col gap-[6px]">
                  <label className="text-[11px] font-bold uppercase text-brand-text-dim">SKS</label>
                  <input type="number" min="1" max="6" value={formSks} onChange={(e) => setFormSks(Number(e.target.value))}
                    className="w-full bg-white border border-brand-border text-brand-text rounded-[8px] px-[12px] py-[8px] text-[13px] focus:outline-none" />
                </div>
              )}
              <div className="flex justify-end gap-[12px] mt-4">
                <button type="button" onClick={() => setShowAddModal(false)}
                  className="bg-white border border-brand-border hover:bg-slate-100 text-brand-text font-bold text-[12px] uppercase tracking-[0.5px] px-[16px] py-[10px] rounded-[8px] cursor-pointer">Cancel</button>
                <button type="submit" disabled={saving}
                  className="bg-brand-secondary hover:bg-brand-primary text-white font-bold text-[12px] uppercase tracking-[0.5px] px-[20px] py-[10px] rounded-[8px] cursor-pointer shadow-sm flex items-center gap-2">
                  {saving && <Loader2 size={14} className="animate-spin" />}
                  <span>{saving ? "Saving..." : "Add Record"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showEditModal && (
        <div className="fixed inset-0 bg-brand-primary/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-brand-border rounded-[16px] shadow-2xl max-w-[500px] w-full flex flex-col overflow-hidden">
            <div className="px-[24px] py-[16px] bg-slate-50 border-b border-brand-border flex items-center justify-between">
              <h3 className="font-bold text-brand-primary text-[16px]">Edit {activeTab === "mahasiswa" ? "Student" : activeTab === "dosen" ? "Lecturer" : "Course"}</h3>
              <button onClick={() => setShowEditModal(false)} className="p-1 hover:bg-slate-200 text-brand-text-dim hover:text-brand-text rounded-full transition-colors cursor-pointer"><X size={18} /></button>
            </div>
            <form onSubmit={handleEditSubmit} className="p-[24px] flex flex-col gap-[16px]">
              <div className="flex flex-col gap-[6px]">
                <label className="text-[11px] font-bold uppercase text-brand-text-dim">Name / Title</label>
                <input type="text" required value={formName} onChange={(e) => setFormName(e.target.value)}
                  className="w-full bg-white border border-brand-border text-brand-text rounded-[8px] px-[12px] py-[8px] text-[13px] focus:outline-none focus:border-brand-secondary" />
              </div>
              <div className="flex flex-col gap-[6px]">
                <label className="text-[11px] font-bold uppercase text-brand-text-dim">{activeTab === "mahasiswa" ? "NIM" : activeTab === "dosen" ? "NIP/NIDN" : "Code"}</label>
                <input type="text" required value={formCode} onChange={(e) => setFormCode(e.target.value)}
                  className="w-full bg-white border border-brand-border text-brand-text rounded-[8px] px-[12px] py-[8px] text-[13px] focus:outline-none font-mono" />
              </div>
              {activeTab !== "matakuliah" && (
                <>
                  <div className="flex flex-col gap-[6px]">
                    <label className="text-[11px] font-bold uppercase text-brand-text-dim">Program Studi</label>
                    <select value={formProdi} onChange={(e) => setFormProdi(e.target.value)}
                      className="w-full bg-white border border-brand-border text-brand-text rounded-[8px] px-[12px] py-[8px] text-[13px] focus:outline-none cursor-pointer font-semibold">
                      {prodiList.map((p: any) => <option key={p.prodi_id} value={p.prodi_id}>{p.nama_prodi}</option>)}
                    </select>
                  </div>
                  <div className="flex flex-col gap-[6px]">
                    <label className="text-[11px] font-bold uppercase text-brand-text-dim">Gender</label>
                    <select value={formGender} onChange={(e) => setFormGender(e.target.value)}
                      className="w-full bg-white border border-brand-border text-brand-text rounded-[8px] px-[12px] py-[8px] text-[13px] focus:outline-none cursor-pointer font-semibold">
                      <option value="Male">Laki-laki (Male)</option>
                      <option value="Female">Perempuan (Female)</option>
                    </select>
                  </div>
                </>
              )}
              {activeTab !== "matakuliah" && (
                <>
                  <div className="flex flex-col gap-[6px]">
                    <label className="text-[11px] font-bold uppercase text-brand-text-dim">Email (for login)</label>
                    <input type="email" placeholder="user@example.com" value={formEmail} onChange={(e) => setFormEmail(e.target.value)}
                      className="w-full bg-white border border-brand-border text-brand-text rounded-[8px] px-[12px] py-[8px] text-[13px] focus:outline-none" />
                  </div>
                  <div className="flex flex-col gap-[6px]">
                    <label className="text-[11px] font-bold uppercase text-brand-text-dim">Password (for login)</label>
                    <input type="password" placeholder="Min. 6 characters" value={formPassword} onChange={(e) => setFormPassword(e.target.value)}
                      className="w-full bg-white border border-brand-border text-brand-text rounded-[8px] px-[12px] py-[8px] text-[13px] focus:outline-none" />
                  </div>
                </>
              )}
              {activeTab === "mahasiswa" && (
                <div className="flex flex-col gap-[6px]">
                  <label className="text-[11px] font-bold uppercase text-brand-text-dim">Year</label>
                  <select value={formYear} onChange={(e) => setFormYear(e.target.value)}
                    className="w-full bg-white border border-brand-border text-brand-text rounded-[8px] px-[12px] py-[8px] text-[13px] focus:outline-none cursor-pointer font-semibold">
                    {["2021","2022","2023","2024","2025"].map((y) => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
              )}
              <div className="flex justify-end gap-[12px] mt-4">
                <button type="button" onClick={() => setShowEditModal(false)}
                  className="bg-white border border-brand-border hover:bg-slate-100 text-brand-text font-bold text-[12px] uppercase tracking-[0.5px] px-[16px] py-[10px] rounded-[8px] cursor-pointer">Cancel</button>
                <button type="submit" disabled={saving}
                  className="bg-brand-secondary hover:bg-brand-primary text-white font-bold text-[12px] uppercase tracking-[0.5px] px-[20px] py-[10px] rounded-[8px] cursor-pointer shadow-sm flex items-center gap-2">
                  {saving && <Loader2 size={14} className="animate-spin" />}
                  <span>{saving ? "Saving..." : "Save Changes"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
