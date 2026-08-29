# Walkthrough - Figma Implementation

I have fully built and integrated the **Hero Landing Page**, **Mahasiswa (Student)**, **Dosen (Lecturer)**, and **Admin (Administrator)** roles for the Klas application, aligning with the brand guidelines, style parameters, and Figma frames.

---

## Part 0: Hero Landing Page (Public)

The public landing page at `/` introduces KLAS with a full-screen brand hero before authentication.

### Implemented Pages & Layouts
1. **[Hero Landing Page](file:///d:/Computer%20Science/Semester%204/Rekayasa%20Perangkat%20Lunak/klas-frontend/app/routes/home.tsx)**
   - Full-screen dark brand background with radial gradients and grid overlay.
   - Large KLAS diamond logo with "Your Location, Your Attendance." tagline.
   - CTA buttons linking to `/login` (Get Started / Sign In).
   - Three feature cards highlighting Dynamic QR, GPS Geofencing, and IP Filtering.
   - Includes footer with branding.

---

## Part 1: Mahasiswa Role (Mobile-First Layout) — `/mahasiswa`

Accessible at `/mahasiswa` after login. The Mahasiswa pages are wrapped in a phone-width container centered on desktop and scale to a full screen on mobile devices.

### Implemented Pages & Layouts
1. **[Simulated Phone Layout](file:///d:/Computer%20Science/Semester%204/Rekayasa%20Perangkat%20Lunak/klas-frontend/app/routes/layout.tsx)**
   - Designed a phone-width container with a black bezel background, centered on a slate-100 desktop canvas.
   - Integrates the Figma bottom navigation (`Home`, `Logs`, `Profile`) utilizing styled active states.
2. **[Dashboard](file:///d:/Computer%20Science/Semester%204/Rekayasa%20Perangkat%20Lunak/klas-frontend/app/routes/dashboard.tsx)**
   - Displays the **IN SESSION** class (*Software Engineering*) with a functioning **SCAN QR** button.
   - Displays **CLOSED** (*Algorithms*) and **UPCOMING** (*Database Systems*) classes.
3. **[QR Scanner Page](file:///d:/Computer%20Science/Semester%204/Rekayasa%20Perangkat%20Lunak/klas-frontend/app/routes/scanner.tsx)**
   - Camera-based QR code scanner using `@yudiel/react-qr-scanner`.
   - Requests GPS coordinates via Browser Geolocation API.
   - Calls the `check-in` edge function with the scanned QR token and GPS location.
   - Displays success (CheckCircle + bounce animation) or error state, then auto-redirects to dashboard.
4. **[Class Logs](file:///d:/Computer%20Science/Semester%204/Rekayasa%20Perangkat%20Lunak/klas-frontend/app/routes/logs.tsx)**
   - Displays cumulative attendance stats (94% Present) alongside a tabular listing of historical checks.
5. **[Profile](file:///d:/Computer%20Science/Semester%204/Rekayasa%20Perangkat%20Lunak/klas-frontend/app/routes/profile.tsx)**
   - Standard mock student profile page styling.

---

## Part 2: Dosen Role (Desktop Dashboard Portal)

The Dosen pages target a large desktop viewport (1280px container layout) with custom UI interactions and real-time state simulations.

### Implemented Pages & Layouts
1. **[Desktop Header Layout Shell](file:///d:/Computer%20Science/Semester%204/Rekayasa%20Perangkat%20Lunak/klas-frontend/app/routes/dosen/layout.tsx)**
   - Persistent top navigation navbar with badge elements (`LECTURER`) and active route tracking.
   - Navigation links: **Dashboard**, **Attendance**, **Report**, **Account Settings**.
   - **Notifications dropdown** with real-time alerts (geofence violations, session closures) via Supabase Realtime.
   - **Profile dropdown** with avatar, name, NIDN, Account Settings link, and Sign Out.
2. **[Class Session Management / Dashboard](file:///d:/Computer%20Science/Semester%204/Rekayasa%20Perangkat%20Lunak/klas-frontend/app/routes/dosen/dashboard.tsx)**
   - Displays course schedule cards fetched from `get-dosen-dashboard` API.
   - Each card shows course info, schedule, enrolled count, and latest session status.
   - Links to open/live monitor, session history, manual correction, and report per course.
3. **[Attendance Course Selection](file:///d:/Computer%20Science/Semester%204/Rekayasa%20Perangkat%20Lunak/klas-frontend/app/routes/dosen/attendance-index.tsx)**
   - Lists all assigned courses with enrollment and schedule info for selecting which course to monitor.
4. **[Real-Time QR Monitor](file:///d:/Computer%20Science/Semester%204/Rekayasa%20Perangkat%20Lunak/klas-frontend/app/routes/dosen/attendance.tsx)**
   - Displays rotating QR code (via `react-qr-code`) with batch-generated tokens.
   - Session settings accordion: geofence radius slider (10m–500m) and QR rotation interval slider (5s–60s).
   - Real-time check-in feed via Supabase Realtime subscription on `presensi` table.
   - Session timer, attendance counts (present/absent), and recent check-in activity.
5. **[Session History](file:///d:/Computer%20Science/Semester%204/Rekayasa%20Perangkat%20Lunak/klas-frontend/app/routes/dosen/sessions.tsx)**
   - Paginated list of past sessions with attendance stats.
   - Edit, delete, and reopen actions via modals.
6. **[Manual Attendance Correction](file:///d:/Computer%20Science/Semester%204/Rekayasa%20Perangkat%20Lunak/klas-frontend/app/routes/dosen/correction.tsx)**
   - Fetches enrolled students from `get-course-students` API.
   - Search by name or NIM, filter tabs (All, Present, Absent, Excused).
   - Per-row status toggle buttons (Present / Absent / Excused) with change tracking.
   - Bulk mark present action and save/discard changes.
7. **[Academic Report](file:///d:/Computer%20Science/Semester%204/Rekayasa%20Perangkat%20Lunak/klas-frontend/app/routes/dosen/report.tsx)**
   - Per-course attendance report fetched from `get-dosen-report` API.
   - Student-level breakdown table with attendance rates.
   - CSV export via `export-report` API.
8. **[Account Settings](file:///d:/Computer%20Science/Semester%204/Rekayasa%20Perangkat%20Lunak/klas-frontend/app/routes/dosen/account-settings.tsx)**
   - Edit profile (name, gender) via `update-dosen-profile` API.
   - Change password via `change-password` API.
   - Sign out.

---

## Part 3: Admin Role (Desktop Sidebar Portal)

The Admin pages target a large desktop viewport with a fixed left sidebar navigation menu (`Aside - SideNavBar Shell`) of width `260px` and a top profile details bar.

### Implemented Pages & Layouts
1. **[Desktop Sidebar Layout Shell](file:///d:/Computer%20Science/Semester%204/Rekayasa%20Perangkat%20Lunak/klas-frontend/app/routes/admin/layout.tsx)**
   - Fixed left sidebar navigation (260px, dark brand) with KLAS brand header, active link highlights.
   - Core Panel: Dashboard, Master Data, Global Attendance, Schedule Plotting.
   - Administration: Security Settings, Audit Logs.
   - Footer with admin profile context.
   - **Top header**: "Admin Console" badge, notifications bell with dropdown, profile dropdown.
2. **[Academic Analytics & Dashboard](file:///d:/Computer%20Science/Semester%204/Rekayasa%20Perangkat%20Lunak/klas-frontend/app/routes/admin/dashboard.tsx)**
   - Fetches system-wide metrics from `get-admin-dashboard` API.
   - Displays: total students, lecturers, courses, active sessions, attendance rate, geofence violations.
   - Interactive bar chart for attendance trends (7-day) and system overview table.
3. **[Master Data Management](file:///d:/Computer%20Science/Semester%204/Rekayasa%20Perangkat%20Lunak/klas-frontend/app/routes/admin/master-data.tsx)**
   - 3-tab interface: Students (Mahasiswa), Lecturers (Dosen), Courses (Mata Kuliah).
   - CRUD operations via `crud-mahasiswa`, `crud-dosen`, `crud-mata-kuliah` APIs.
   - Search, filter by department/year/gender/status, add/edit/delete modals.
4. **[Global Attendance Monitoring](file:///d:/Computer%20Science/Semester%204/Rekayasa%20Perangkat%20Lunak/klas-frontend/app/routes/admin/attendance.tsx)**
   - Fetches cross-course session data from `get-global-attendance` API.
   - Live classes table with status, attendance progress bars, and stats.
5. **[Course Schedule Plotting](file:///d:/Computer%20Science/Semester%204/Rekayasa%20Perangkat%20Lunak/klas-frontend/app/routes/admin/schedule.tsx)**
   - Schedule table with inline lecturer/room assignment dropdowns.
   - Auto-computed status (assigned/unassigned/room-missing) via `crud-jadwal` API.
   - Scheduling summary sidebar.
6. **[Security Settings](file:///d:/Computer%20Science/Semester%204/Rekayasa%20Perangkat%20Lunak/klas-frontend/app/routes/admin/settings.tsx)**
   - Configuration cards: 2FA toggle, session timeout, password policy, geofence strictness.
   - Role permission matrix (Super Admin, Admin Prodi, Dosen, Mahasiswa) via `update-role-permissions` API.
   - Save/discard changes with change detection.
7. **[System Audit Logs](file:///d:/Computer%20Science/Semester%204/Rekayasa%20Perangkat%20Lunak/klas-frontend/app/routes/admin/audit-logs.tsx)**
   - Paginated, filterable audit trail fetched from `get-audit-logs` API.
   - Filter by category, status, time range, search.
   - CSV export capability.

---

## Navbar Dropdowns Refinement

- **Increased Dropdown Widths**: Enlarged the Notifications dropdown width from `360px` to `400px` and the Profile dropdown from `280px` to `320px` to prevent text truncation and improve spatial balance.
- **Added Padding and Gaps**: Increased dropdown inner padding from `20px` to `24px` and layout gap parameters from `14px` to `16px`.
- **Upscaled Typography**: Enhanced font sizes (header from `15px` to `16px`/`17px`, body details from `13px`/`11px` to `14px`/`12px`) and icon sizing inside list items to match the increased density.

---

## How to Run & Verify

1. Start the React Router v8 dev server:
   ```bash
   npm run dev
   ```
2. Navigate to:
   - Hero / Landing page: `http://localhost:5173/`
   - Login page: `http://localhost:5173/login`
   - Student dashboard: `http://localhost:5173/mahasiswa`
   - Lecturer dashboard: `http://localhost:5173/dosen`
   - Admin console: `http://localhost:5173/admin`

3. Verify that the build type-checks cleanly and packages correctly:
   ```bash
   npm run build
   ```
