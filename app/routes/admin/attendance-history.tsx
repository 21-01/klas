import { useState, useEffect } from "react";
import { Link, useParams } from "react-router";
import { ArrowLeft, Calendar, Clock, Users, Trash2, RotateCcw, Edit3, ExternalLink, Loader2, ChevronDown, X } from "lucide-react";
import { cn } from "~/lib/utils";
import { api } from "~/lib/api";
import { useToast } from "~/components/Toast";
import type { SessionHistoryItem } from "~/lib/types";

export function meta() {
  return [{ title: "Session History - Admin - Klas." }];
}

export default function AdminAttendanceHistory() {
  const { jadwal_id } = useParams();
  const toast = useToast();
  const [sessions, setSessions] = useState<SessionHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [courseInfo, setCourseInfo] = useState<any>(null);

  const [editingSession, setEditingSession] = useState<SessionHistoryItem | null>(null);
  const [editTanggal, setEditTanggal] = useState("");
  const [editRadius, setEditRadius] = useState(50);
  const [editRotates, setEditRotates] = useState(15);
  const [savingEdit, setSavingEdit] = useState(false);

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<SessionHistoryItem | null>(null);

  const [reopeningId, setReopeningId] = useState<string | null>(null);
  const [confirmReopen, setConfirmReopen] = useState<SessionHistoryItem | null>(null);

  const fetchSessions = async (pageNum: number, append = false) => {
    try {
      const result = await api.listSessions(jadwal_id!, pageNum, 10);
      if (append) {
        setSessions((prev) => [...prev, ...result.sessions]);
      } else {
        setSessions(result.sessions);
      }
      setHasMore(result.pagination.page < result.pagination.total_pages);
    } catch (err: any) {
      toast.error(err.message || "Failed to load sessions");
    }
  };

  const fetchCourseInfo = async () => {
    try {
      const data = await api.getAdminAttendanceCourses();
      const course = data.courses.find((c: any) => c.jadwal_id === jadwal_id);
      if (course) setCourseInfo(course);
    } catch {}
  };

  useEffect(() => {
    Promise.all([fetchSessions(1), fetchCourseInfo()]).finally(() => setLoading(false));
  }, [jadwal_id]);

  const handleLoadMore = async () => {
    setLoadingMore(true);
    const nextPage = page + 1;
    await fetchSessions(nextPage, true);
    setPage(nextPage);
    setLoadingMore(false);
  };

  const handleEdit = (session: SessionHistoryItem) => {
    setEditingSession(session);
    setEditTanggal(session.tanggal);
    setEditRadius(session.geofence_radius_m);
    setEditRotates(session.qr_rotates_every);
  };

  const handleSaveEdit = async () => {
    if (!editingSession) return;
    setSavingEdit(true);
    try {
      await api.updateSession({
        sesi_id: editingSession.sesi_id,
        tanggal: editTanggal,
        geofence_radius_m: editRadius,
        qr_rotates_every: editRotates,
      });
      toast.success("Session updated");
      setEditingSession(null);
      await fetchSessions(1);
      setPage(1);
    } catch (err: any) {
      toast.error(err.message || "Failed to update session");
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    setDeletingId(confirmDelete.sesi_id);
    try {
      await api.deleteSession(confirmDelete.sesi_id);
      toast.success("Session deleted");
      setSessions((prev) => prev.filter((s) => s.sesi_id !== confirmDelete.sesi_id));
      setConfirmDelete(null);
    } catch (err: any) {
      toast.error(err.message || "Failed to delete session");
    } finally {
      setDeletingId(null);
    }
  };

  const handleReopen = async () => {
    if (!confirmReopen) return;
    setReopeningId(confirmReopen.sesi_id);
    try {
      await api.reopenSession({ sesi_id: confirmReopen.sesi_id });
      toast.success("Session reopened");
      setConfirmReopen(null);
      await fetchSessions(1);
      setPage(1);
    } catch (err: any) {
      toast.error(err.message || "Failed to reopen session");
    } finally {
      setReopeningId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-brand-secondary" size={32} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-[32px] w-full">
      <div className="flex items-center justify-between w-full">
        <div className="flex items-center gap-[16px]">
          <Link
            to={`/admin/attendance/${jadwal_id}`}
            className="p-2 border border-brand-border hover:bg-slate-100 rounded-[10px] text-brand-primary transition-colors cursor-pointer shrink-0"
          >
            <ArrowLeft size={20} />
          </Link>
          <div className="flex flex-col items-start">
            <span className="font-semibold text-brand-text-dim text-[11px] tracking-[1px] uppercase">
              SESSION MANAGEMENT
            </span>
            <h1 className="font-bold text-brand-primary text-[28px] tracking-[-0.5px]">
              {courseInfo ? `${courseInfo.mata_kuliah.kode_mk} — ${courseInfo.mata_kuliah.nama_mk}` : "Session History"}
            </h1>
          </div>
        </div>
      </div>

      {sessions.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <Calendar size={48} className="text-brand-text-dim" />
          <p className="text-brand-text-dim font-semibold">No sessions found for this class.</p>
          <Link to={`/admin/attendance/${jadwal_id}`} className="text-brand-secondary underline text-[14px]">
            Go to Attendance Page
          </Link>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-[16px]">
            {sessions.map((session) => {
              const isLive = session.status === "live";
              const attendanceRate = session.total_count > 0 ? Math.round((session.present_count / session.total_count) * 100) : 0;

              return (
                <div
                  key={session.sesi_id}
                  className={cn(
                    "bg-white border-2 rounded-[16px] p-[24px] flex flex-col gap-[16px] transition-all",
                    isLive ? "border-brand-secondary shadow-md" : "border-brand-border"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-[12px]">
                      <span
                        className={cn(
                          "font-bold text-[10px] tracking-[-0.3px] uppercase px-[12px] py-[4px] rounded-full text-white",
                          isLive ? "bg-brand-secondary animate-pulse" : "bg-amber-600"
                        )}
                      >
                        {isLive ? "LIVE" : "COMPLETED"}
                      </span>
                      <div className="flex items-center gap-[6px] text-brand-text-dim text-[13px] font-semibold">
                        <Calendar size={14} />
                        <span>{session.tanggal}</span>
                      </div>
                      <div className="flex items-center gap-[6px] text-brand-text-dim text-[13px] font-semibold">
                        <Clock size={14} />
                        <span>
                          {session.waktu_mulai?.substring(11, 16)}
                          {session.waktu_selesai ? ` — ${session.waktu_selesai.substring(11, 16)}` : ""}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-[24px]">
                    <div className="flex items-center gap-[6px]">
                      <Users size={14} className="text-emerald-600" />
                      <span className="text-[13px] font-bold text-emerald-600">{session.present_count} present</span>
                    </div>
                    <div className="flex items-center gap-[6px]">
                      <Users size={14} className="text-red-500" />
                      <span className="text-[13px] font-bold text-red-500">{session.absent_count} absent</span>
                    </div>
                    <div className="text-[13px] font-bold text-brand-primary">{attendanceRate}%</div>
                    <div className="text-[11px] text-brand-text-dim font-semibold">
                      {session.geofence_radius_m}m radius · {session.qr_rotates_every}s QR
                    </div>
                  </div>

                  <div className="flex gap-[8px]">
                    {isLive ? (
                      <Link
                        to={`/admin/attendance/${jadwal_id}`}
                        className="bg-brand-secondary hover:bg-brand-primary text-white text-[12px] font-bold py-[8px] px-[16px] rounded-[8px] transition-all flex items-center gap-2"
                      >
                        <ExternalLink size={14} />
                        <span>View Live</span>
                      </Link>
                    ) : (
                      <>
                        <button
                          onClick={() => handleEdit(session)}
                          className="bg-brand-surface border border-brand-border hover:bg-slate-100 text-brand-primary text-[12px] font-bold py-[8px] px-[16px] rounded-[8px] transition-all flex items-center gap-2 cursor-pointer"
                        >
                          <Edit3 size={14} />
                          <span>Edit</span>
                        </button>
                        <button
                          onClick={() => setConfirmReopen(session)}
                          className="bg-brand-surface border border-brand-border hover:bg-slate-100 text-brand-primary text-[12px] font-bold py-[8px] px-[16px] rounded-[8px] transition-all flex items-center gap-2 cursor-pointer"
                        >
                          <RotateCcw size={14} />
                          <span>Reopen</span>
                        </button>
                        <button
                          onClick={() => setConfirmDelete(session)}
                          className="bg-red-50 border border-red-200 hover:bg-red-100 text-red-600 text-[12px] font-bold py-[8px] px-[16px] rounded-[8px] transition-all flex items-center gap-2 cursor-pointer"
                        >
                          <Trash2 size={14} />
                          <span>Delete</span>
                        </button>
                      </>
                    )}
                    <Link
                      to={`/admin/attendance/correction/${jadwal_id}?sesi_id=${session.sesi_id}`}
                      className="ml-auto bg-brand-surface border border-brand-border hover:bg-slate-100 text-brand-primary text-[12px] font-bold py-[8px] px-[16px] rounded-[8px] transition-all flex items-center gap-2"
                    >
                      <span>Correction</span>
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>

          {hasMore && (
            <button
              onClick={handleLoadMore}
              disabled={loadingMore}
              className="self-center bg-brand-surface border border-brand-border hover:bg-slate-100 text-brand-primary text-[13px] font-bold py-[10px] px-[24px] rounded-[10px] transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {loadingMore ? <Loader2 size={14} className="animate-spin" /> : <ChevronDown size={14} />}
              <span>Load More</span>
            </button>
          )}
        </>
      )}

      {editingSession && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setEditingSession(null)}>
          <div className="bg-white rounded-[16px] p-[28px] w-full max-w-[420px] shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-[20px]">
              <h2 className="font-bold text-brand-primary text-[18px]">Edit Session</h2>
              <button onClick={() => setEditingSession(null)} className="text-brand-text-dim hover:text-brand-primary cursor-pointer">
                <X size={20} />
              </button>
            </div>

            <div className="flex flex-col gap-[16px]">
              <div className="flex flex-col gap-[6px]">
                <label className="text-[11px] font-bold text-brand-text-dim uppercase tracking-[0.5px]">Date</label>
                <input
                  type="date"
                  value={editTanggal}
                  onChange={(e) => setEditTanggal(e.target.value)}
                  className="w-full px-[12px] py-[8px] border border-brand-border rounded-[8px] text-[13px] font-semibold text-brand-primary focus:outline-none focus:border-brand-secondary"
                />
              </div>

              <div className="flex flex-col gap-[6px]">
                <label className="text-[11px] font-bold text-brand-text-dim uppercase tracking-[0.5px]">
                  Geofence Radius: {editRadius}m
                </label>
                <input
                  type="range"
                  min="10"
                  max="500"
                  value={editRadius}
                  onChange={(e) => setEditRadius(Number(e.target.value))}
                  className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-brand-secondary"
                />
                <div className="flex justify-between text-[10px] text-brand-text-dim font-bold">
                  <span>10m</span>
                  <span>500m</span>
                </div>
              </div>

              <div className="flex flex-col gap-[6px]">
                <label className="text-[11px] font-bold text-brand-text-dim uppercase tracking-[0.5px]">
                  QR Rotates Every: {editRotates}s
                </label>
                <input
                  type="range"
                  min="5"
                  max="60"
                  value={editRotates}
                  onChange={(e) => setEditRotates(Number(e.target.value))}
                  className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-brand-secondary"
                />
                <div className="flex justify-between text-[10px] text-brand-text-dim font-bold">
                  <span>5s</span>
                  <span>60s</span>
                </div>
              </div>

              <div className="flex gap-[8px] mt-[8px]">
                <button
                  onClick={() => setEditingSession(null)}
                  className="flex-1 bg-brand-surface border border-brand-border hover:bg-slate-100 text-brand-primary text-[13px] font-bold py-[10px] rounded-[8px] transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveEdit}
                  disabled={savingEdit}
                  className="flex-1 bg-brand-secondary hover:bg-brand-primary text-white text-[13px] font-bold py-[10px] rounded-[8px] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {savingEdit ? <Loader2 size={14} className="animate-spin" /> : null}
                  <span>Save Changes</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {confirmDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setConfirmDelete(null)}>
          <div className="bg-white rounded-[16px] p-[28px] w-full max-w-[400px] shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-bold text-brand-primary text-[18px] mb-[12px]">Delete Session</h2>
            <p className="text-brand-text-dim text-[13px] mb-[20px]">
              This will permanently delete the session on <strong>{confirmDelete.tanggal}</strong> and all its attendance records. This action cannot be undone.
            </p>
            <div className="flex gap-[8px]">
              <button
                onClick={() => setConfirmDelete(null)}
                className="flex-1 bg-brand-surface border border-brand-border hover:bg-slate-100 text-brand-primary text-[13px] font-bold py-[10px] rounded-[8px] transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={!!deletingId}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white text-[13px] font-bold py-[10px] rounded-[8px] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {deletingId ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                <span>Delete Permanently</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmReopen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setConfirmReopen(null)}>
          <div className="bg-white rounded-[16px] p-[28px] w-full max-w-[400px] shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-bold text-brand-primary text-[18px] mb-[12px]">Reopen Session</h2>
            <p className="text-brand-text-dim text-[13px] mb-[20px]">
              This will reopen the session on <strong>{confirmReopen.tanggal}</strong> and make it live again. Students will be able to check in.
            </p>
            <div className="flex gap-[8px]">
              <button
                onClick={() => setConfirmReopen(null)}
                className="flex-1 bg-brand-surface border border-brand-border hover:bg-slate-100 text-brand-primary text-[13px] font-bold py-[10px] rounded-[8px] transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleReopen}
                disabled={!!reopeningId}
                className="flex-1 bg-brand-secondary hover:bg-brand-primary text-white text-[13px] font-bold py-[10px] rounded-[8px] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {reopeningId ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />}
                <span>Reopen Session</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
