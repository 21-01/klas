import { useState, useEffect } from "react";
import { Search, Filter, Calendar, FileClock, CheckCircle, XCircle, Download, Info, Loader2 } from "lucide-react";
import { cn } from "~/lib/utils";
import { api } from "~/lib/api";
import { useToast } from "~/components/Toast";

export function meta() {
  return [
    { title: "System Audit Logs - Admin Console - Klas." },
  ];
}

export default function AdminAuditLogs() {
  const toast = useToast();
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [timeFilter, setTimeFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchLogs = async (p: number = page) => {
    setLoading(true);
    try {
      const params: any = { page: p, limit: 50 };
      if (categoryFilter !== "all") params.kategori = categoryFilter;
      if (timeFilter === "today") {
        const d = new Date().toISOString().split("T")[0];
        params.from_date = d;
        params.to_date = d;
      }
      const data = await api.getAuditLogs(params);
      setLogs(data.logs);
      setTotalPages(data.pagination.total_pages);
    } catch { /* ignore */ }
    setLoading(false);
  };

  useEffect(() => { fetchLogs(1); }, [categoryFilter, timeFilter]);

  const filteredLogs = logs.filter((log) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (log.users?.name || "").toLowerCase().includes(q) ||
      log.aksi?.toLowerCase().includes(q) ||
      log.ip_address?.toLowerCase().includes(q);
  });

  const handleExportLogs = async () => {
    try {
      const data = await api.getAuditLogs({ format: "csv", limit: 5000 });
      if (typeof data === "string") {
        const blob = new Blob([data], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = "audit-logs.csv";
        a.click(); URL.revokeObjectURL(url);
        toast.success("Audit logs exported");
      }
    } catch {
      toast.error("Failed to export audit logs");
    }
  };

  return (
    <div className="flex flex-col gap-[32px] w-full">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 w-full pb-2 border-b border-brand-border/40">
        <div className="flex flex-col items-start gap-[4px]">
          <span className="font-semibold text-brand-text-dim text-[11px] tracking-[1.2px] uppercase">SECURITY TRACEABILITY</span>
          <h1 className="font-bold text-brand-primary text-[32px] tracking-[-0.64px] leading-tight">System Audit Logs</h1>
        </div>
        <button onClick={handleExportLogs}
          className="bg-white border border-brand-border hover:bg-slate-50 text-brand-primary font-bold text-[13px] tracking-[0.5px] uppercase px-[16px] py-[10px] rounded-[8px] transition-all flex items-center gap-[8px] cursor-pointer shrink-0">
          <Download size={16} /><span>Export CSV</span>
        </button>
      </div>

      <div className="bg-white border border-brand-border rounded-[16px] shadow-sm overflow-hidden flex flex-col w-full">
        <div className="p-[20px] border-b border-brand-border bg-slate-50/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-[12px] w-full md:w-auto">
            <div className="relative w-full sm:w-[280px]">
              <Search className="absolute left-[12px] top-1/2 -translate-y-1/2 text-brand-text-dim" size={16} />
              <input type="text" placeholder="Search by action, user, or IP..." value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white border border-brand-border text-brand-text placeholder-brand-text-dim/60 rounded-[8px] pl-[36px] pr-[12px] py-[8px] text-[13px] focus:outline-none focus:border-brand-secondary" />
            </div>
            <div className="relative">
              <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}
                className="bg-white border border-brand-border text-brand-text rounded-[8px] pl-[12px] pr-[32px] py-[8px] text-[13px] focus:outline-none cursor-pointer appearance-none font-bold">
                <option value="all">All Categories</option>
                <option value="Master Data">Master Data</option>
                <option value="Schedule Plotting">Schedule Plotting</option>
                <option value="Security Policies">Security Policies</option>
                <option value="Attendance Overrides">Attendance Overrides</option>
              </select>
              <div className="absolute right-[12px] top-1/2 -translate-y-1/2 pointer-events-none text-brand-text-dim"><Filter size={14} /></div>
            </div>
            <div className="relative">
              <select value={timeFilter} onChange={(e) => setTimeFilter(e.target.value)}
                className="bg-white border border-brand-border text-brand-text rounded-[8px] pl-[12px] pr-[32px] py-[8px] text-[13px] focus:outline-none cursor-pointer appearance-none font-bold">
                <option value="all">All Dates</option>
                <option value="today">Today</option>
              </select>
              <div className="absolute right-[12px] top-1/2 -translate-y-1/2 pointer-events-none text-brand-text-dim"><Calendar size={14} /></div>
            </div>
          </div>
        </div>

        <div className="w-full overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="bg-slate-50 border-b border-brand-border text-brand-text-dim text-[11px] font-bold uppercase tracking-[1px]">
                <th className="px-[24px] py-[16px] w-[180px]">Timestamp</th>
                <th className="px-[24px] py-[16px] w-[180px]">User</th>
                <th className="px-[24px] py-[16px] w-[160px]">Category</th>
                <th className="px-[24px] py-[16px]">Action</th>
                <th className="px-[24px] py-[16px] w-[140px]">IP Address</th>
                <th className="px-[24px] py-[16px] w-[120px] text-right">Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="px-[24px] py-[48px] text-center"><Loader2 className="animate-spin text-brand-secondary inline" size={24} /></td></tr>
              ) : filteredLogs.length > 0 ? filteredLogs.map((log, idx) => (
                <tr key={log.log_id || idx}
                  className={cn("border-b border-brand-border/40 hover:bg-slate-50/50 transition-colors", idx % 2 === 1 ? "bg-slate-50/10" : "bg-white", log.status === "failed" && "bg-red-50/10 hover:bg-red-50/20")}>
                  <td className="px-[24px] py-[16px] text-brand-text-dim text-[12px] font-mono whitespace-nowrap">{log.timestamp || log.created_at}</td>
                  <td className="px-[24px] py-[16px]">
                    <div className="flex flex-col">
                      <span className="font-bold text-brand-primary text-[13px]">{log.users?.name || "System"}</span>
                      <span className="text-brand-text-dim text-[11px] font-semibold">{log.users?.email || ""}</span>
                    </div>
                  </td>
                  <td className="px-[24px] py-[16px]">
                    <span className={cn("text-[10px] font-bold px-[8px] py-[3.5px] rounded border uppercase tracking-[0.5px] whitespace-nowrap",
                      log.kategori === "Security Policies" && "bg-purple-50 text-purple-700 border-purple-200",
                      log.kategori === "Schedule Plotting" && "bg-blue-50 text-blue-700 border-blue-200",
                      log.kategori === "Master Data" && "bg-slate-100 text-slate-700 border-slate-300",
                      log.kategori === "Attendance Overrides" && "bg-amber-50 text-amber-700 border-amber-200")}>
                      {log.kategori}
                    </span>
                  </td>
                  <td className="px-[24px] py-[16px] text-brand-text font-medium text-[13px]">{log.aksi}</td>
                  <td className="px-[24px] py-[16px] text-brand-text-dim text-[12px] font-mono">{log.ip_address}</td>
                  <td className="px-[24px] py-[16px] text-right">
                    {log.status === "success" ? (
                      <span className="inline-flex items-center gap-[4px] bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold px-[8px] py-[3px] rounded uppercase tracking-[0.5px]">
                        <CheckCircle size={10} /><span>Success</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-[4px] bg-red-50 text-red-700 border border-red-200 text-[10px] font-bold px-[8px] py-[3px] rounded uppercase tracking-[0.5px]">
                        <XCircle size={10} /><span>Failed</span>
                      </span>
                    )}
                  </td>
                </tr>
              )) : (
                <tr><td colSpan={6} className="px-[24px] py-[48px] text-center text-brand-text-dim italic">No audit records match the selected filters.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="p-[20px] bg-slate-50 border-t border-brand-border flex items-center justify-between">
          <div className="flex items-center gap-[12px] text-brand-text-dim text-[12px]">
            <Info size={16} className="text-brand-secondary" />
            <span>Audit logs are read-only and cryptographically secured.</span>
          </div>
          {totalPages > 1 && (
            <div className="flex gap-[8px] items-center">
              <button onClick={() => { setPage((p) => Math.max(1, p - 1)); fetchLogs(page - 1); }}
                disabled={page <= 1}
                className="bg-white border border-brand-border rounded-[6px] px-[12px] py-[6px] text-[12px] font-bold cursor-pointer disabled:opacity-40">Prev</button>
              <span className="text-[12px] text-brand-text-dim">{page} / {totalPages}</span>
              <button onClick={() => { setPage((p) => Math.min(totalPages, p + 1)); fetchLogs(page + 1); }}
                disabled={page >= totalPages}
                className="bg-white border border-brand-border rounded-[6px] px-[12px] py-[6px] text-[12px] font-bold cursor-pointer disabled:opacity-40">Next</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
