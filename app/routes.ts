import { type RouteConfig, index, layout, route } from "@react-router/dev/routes";

export default [
  // Hero Landing Page
  index("routes/home.tsx"),

  // Login Page
  route("login", "routes/login.tsx"),

  // Mahasiswa (Student) Role Pages
  route("mahasiswa", "routes/layout.tsx", [
    index("routes/dashboard.tsx"),
    route("logs", "routes/logs.tsx"),
    route("scanner", "routes/scanner.tsx"),
    route("profile", "routes/profile.tsx"),
  ]),

  // Dosen (Lecturer) Role Pages
  route("dosen", "routes/dosen/layout.tsx", [
    index("routes/dosen/dashboard.tsx"),
    route("attendance", "routes/dosen/attendance-index.tsx"),
    route("attendance/:jadwal_id", "routes/dosen/attendance.tsx"),
    route("attendance/:jadwal_id/sessions", "routes/dosen/sessions.tsx"),
    route("attendance/correction/:jadwal_id", "routes/dosen/correction.tsx"),
    route("report", "routes/dosen/report.tsx"),
    route("account-settings", "routes/dosen/account-settings.tsx"),
  ]),

  // Admin (Administrator) Role Pages
  route("admin", "routes/admin/layout.tsx", [
    index("routes/admin/dashboard.tsx"),
    route("master-data", "routes/admin/master-data.tsx"),
    route("attendance", "routes/admin/attendance.tsx"),
    route("attendance/:jadwal_id", "routes/admin/attendance-live.tsx"),
    route("attendance/:jadwal_id/sessions", "routes/admin/attendance-history.tsx"),
    route("attendance/correction/:jadwal_id", "routes/admin/attendance-correction.tsx"),
    route("schedule", "routes/admin/schedule.tsx"),
    route("audit-logs", "routes/admin/audit-logs.tsx"),
  ])
] satisfies RouteConfig;
