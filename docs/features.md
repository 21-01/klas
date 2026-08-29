# Klas. Frontend — Feature List per Page

## 1. Landing Page (`/` — `routes/home.tsx`)
- Hero section with brand logo and tagline "Your Location, Your Attendance"
- Animated SVG logo
- "Get Started" CTA button linking to `/login`
- Feature cards (3 columns): Dynamic QR, GPS Geofencing, IP Filtering
- Responsive navigation with "Sign In" link

## 2. Login Page (`/login` — `routes/login.tsx`)
- Two-panel layout: brand identity (desktop) + login form (right)
- Login form with **Campus ID** (NIM/NIP/email) and **Password** fields
- Show/hide password toggle
- Loading spinner on submit
- Error banner for validation/auth errors
- **NIM/NIP resolution**: auto-lookup numeric IDs against `mahasiswa`/`dosen` tables to resolve email
- **Supabase authentication** via `signInWithPassword`
- Role-based redirect: `mahasiswa` → `/mahasiswa`, `dosen` → `/dosen`, `admin` → `/admin`
- Stores `userRole`, `userCampusId`, `userName`, `userEmail` in `localStorage`
- **Quick test account presets**: Student, Lecturer, Admin (pre-fill credentials)

---

## 3. Mahasiswa (Student) Pages

### Layout (`/mahasiswa` — `routes/layout.tsx`)
- Mobile-first layout (max-width 500px, centered on desktop)
- Bottom tab navigation with 3 items:
  - **Home** (`/mahasiswa`)
  - **Logs** (`/mahasiswa/logs`)
  - **Profile** (`/mahasiswa/profile`)
- NavLink active state highlights in brand color

### 3.1 Dashboard (`/mahasiswa` — `routes/dashboard.tsx`)
- **TopAppBar** component
- Date display and heading "Today's Active Class"
- List of **ClassCards** (3 variants):
  - **In-session**: "SCAN QR" action button linking to `/scanner`
  - **Closed**: no action
  - **Upcoming**: no action
- Each card shows: time, title, location, lecturer (if applicable)

### 3.2 Scanner / QR Check-in (`/mahasiswa/scanner` — `routes/scanner.tsx`)
- **TopAppBar** component
- Camera-based QR code scanner using `@yudiel/react-qr-scanner`
- Requests GPS coordinates via Browser Geolocation API
- Calls `check-in` edge function with QR token + GPS coordinates
- Success animation (CheckCircle + bounce) + auto-redirect to dashboard (2s)
- Error state display for failed check-ins (expired QR, out of geofence, etc.)
- **GPS Status** indicator (pulsing green dot, "Verified")
- Info alert: "Enable location services for automatic classroom detection"

### 3.3 Logs / Riwayat Kehadiran (`/mahasiswa/logs` — `routes/logs.tsx`)
- **TopAppBar** component
- **Academic Standing** section: Total Attendance % (from `get-attendance-stats` API)
- **Class Logs** list with each entry: course name, date/time, status (Present/Absent)
- Present entries highlighted green, Absent entries highlighted red
- Semester and tahun_akademik display
- Data fetched from `get-my-logs` API with pagination

### 3.4 Profile (`/mahasiswa/profile` — `routes/profile.tsx`)
- **TopAppBar** component
- Profile card: avatar with initials, name, class info
- GPA display (e.g. "3.8 / 4.0")
- **Student Information** section:
  - Student ID
  - Email
  - Academic Advisor
- "Sign Out" button (with red danger styling)

---

## 4. Dosen (Lecturer) Pages

### Layout (`/dosen` — `routes/dosen/layout.tsx`)
- Fixed top header with brand logo, "LECTURER" badge
- Top navigation: **Dashboard**, **Attendance**, **Report**
- **Notifications dropdown** with system alerts (geofence flags, session closures)
- **Profile dropdown** with avatar, name, NIDN, Account Settings, Sign Out

### 4.1 Dashboard (`/dosen` — `routes/dosen/dashboard.tsx`)
- Header: "Class Session Management" with real-time Server Time and Date display
- **Course cards grid** (responsive 1-3 columns) fetched from `get-dosen-dashboard` API:
  - Each card shows: course info (kode_mk, nama_mk, sks), schedule (day, time), room, enrolled count
  - Latest session status badge (live/completed)
  - Links to: Live Monitor (if session open), Session History, Manual Correction, Report
- "Assign New Course" placeholder card (dashed border)

### 4.2 Attendance Course Selection (`/dosen/attendance` — `routes/dosen/attendance-index.tsx`)
- Lists all assigned courses with enrollment and schedule info
- Click to select a course and navigate to live monitor

### 4.3 Live Attendance Monitor (`/dosen/attendance/:jadwal_id` — `routes/dosen/attendance.tsx`)
- Back navigation, course title header
- Action buttons: **Manual Correction** and **End Session**
- **Split panel layout**:
  - **Left**: QR code display (via `react-qr-code`) with rotating tokens
  - **Left settings**: **Session Settings** accordion containing:
    - **Geofencing Radius** slider (10m–500m)
    - **QR Rotates Every** slider (5s–60s)
    - Save Settings button
  - **Right**: Attendance quota banner (present/pending count + %)
  - **Right**: Live Activity Log feed via Supabase Realtime subscription
- **Batch QR token generation**: Generates a 2-minute batch of tokens in a single edge function call, reducing network calls by ~91.5%.
- QR token queue with `useRef` for stale-closure-free rotation
- Real-time present count updates via Supabase Realtime

### 4.4 Session History (`/dosen/attendance/:jadwal_id/sessions` — `routes/dosen/sessions.tsx`)
- Paginated list of past sessions fetched from `list-sessions` API
- Each session shows: date, time range, status badge (LIVE/COMPLETED), attendance stats (present/absent/total, rate %)
- Action buttons: Edit (modal with date picker, geofence slider, QR rotation slider), Reopen (confirm → navigate to attendance), Delete (confirm with warning)
- "Load More" pagination

### 4.5 Manual Attendance Correction (`/dosen/attendance/correction/:jadwal_id` — `routes/dosen/correction.tsx`)
- Fetches enrolled students from `get-course-students` API
- **Stats cards**: Total Class Size, Present, Absent, Excused (count & %)
- **Student table** with:
  - Search by name or NIM
  - Filter tabs: All, Present, Absent, Excused
  - Per-row status toggle buttons (Present / Absent / Excused) with color coding
  - "Modified" indicator for changed rows
  - "Mark Filtered Present" bulk action
- Save/Discard Changes buttons via `correct-attendance` and `bulk-mark-present` APIs
- Change detection (compares against original data)

### 4.6 Academic Report (`/dosen/report` — `routes/dosen/report.tsx`)
- Per-course attendance report fetched from `get-dosen-report` API
- **Student-level breakdown table** with attendance rates
- CSV export via `export-report` API

### 4.7 Account Settings (`/dosen/account-settings` — `routes/dosen/account-settings.tsx`)
- Edit profile (name, gender) via `update-dosen-profile` API
- Change password via `change-password` API
- Sign out

---

## 5. Admin Pages

### Layout (`/admin` — `routes/admin/layout.tsx`)
- **Fixed sidebar** (260px, dark brand) with:
  - Brand header (logo + "KLAS University Portal")
  - Core Panel: Dashboard, Master Data, Global Attendance, Schedule Plotting
  - Administration: Security Settings, Audit Logs
  - Footer with admin profile context
- **Top header**: "Admin Console" badge, notifications bell (with dropdown), profile dropdown
- Notifications dropdown with system alerts (geofence flags, new lecturer, scheduler run)
- Profile dropdown with user info, Security Settings link, Sign Out

### 5.1 Admin Dashboard (`/admin` — `routes/admin/dashboard.tsx`)
- **4 metric cards** fetched from `get-admin-dashboard` API: Total Students, Total Lecturers, Active Sessions, Overall Attendance Rate
- **Attendance trend bar chart** (7-day) with present/absent breakdown
- **Geofence Violation Alerts** count
- **System Overview table**: courses, rooms, enrollments, students with low attendance
- "Export Analytics Summary" button

### 5.2 Master Data Management (`/admin/master-data` — `routes/admin/master-data.tsx`)
- **3-tab interface**: Students (Mahasiswa), Lecturers (Dosen), Courses (Mata Kuliah)
- **Toolbar**: search input, filter popover (Department, Year, Gender, Status), "+ Add New" button
- **Data tables** per tab fetched from respective CRUD APIs:
  - **Students**: Name (with initials avatar), NIM, Program Studi, Year, Gender, Status, Actions (Edit/Delete)
  - **Lecturers**: Name, NIDN, Program Studi, Gender, Status, Actions
  - **Courses**: Title, Code, Credits (SKS), Status, Actions
- **CRUD modals** (Add / Edit) with adaptive form fields per tab
- Status toggle inline (Active/Inactive), Delete with confirmation
- Pagination footer, Filter indicator badge

### 5.3 Global Attendance Monitoring (`/admin/attendance` — `routes/admin/attendance.tsx`)
- **4 metric cards**: Active Live Monitors, Total Checked-In, Geofence Flags, Attendance Rate
- **Live classes table** fetched from `get-global-attendance` API:
  - Status filter tabs: All, In Session, Completed
  - Columns: Class Detail, Lecturer, Room, Geofence Radius, Attendance Progress (with progress bar), Status badge, Actions
- Real-time status with animated ping dot

### 5.4 Course Schedule Plotting (`/admin/schedule` — `routes/admin/schedule.tsx`)
- **Filter controls**: Semester dropdown, Program Studi dropdown, course search
- **Scheduling table** managed via `crud-jadwal` API:
  - Columns: Course (Code & SKS), Student Size, Assigned Lecturer (inline dropdown), Time Schedule, Room (inline dropdown), Status
  - Status pills: Assigned (green), Lec Missing (red), Room Missing (amber)
- **Scheduling Summary sidebar**: Total Slots, Assigned, Unassigned, Progress bar

### 5.5 Security Settings (`/admin/settings` — `routes/admin/settings.tsx`)
- **3 configuration cards**:
  - **Authentication**: 2FA toggle, Session Timeout (slider, 10–120 min)
  - **Password Policy**: Minimum Length (8/12/16), Special Characters toggle
  - **GPS & Geofence**: Strict Geofence Checks toggle
- **Role Permission Matrix table** via `update-role-permissions` API:
  - Roles: Super Admin (locked), Admin Prodi, Lecturer, Student
  - Permissions: Read, Write, Attendance Moderation, System Configuration
- Save/Discard Changes with change detection

### 5.6 System Audit Logs (`/admin/audit-logs` — `routes/admin/audit-logs.tsx`)
- **Filters**: Search, Event Category (Master Data, Schedule Plotting, Security Policies, Attendance Overrides), Time Range
- **Audit logs table** fetched from `get-audit-logs` API:
  - Columns: Timestamp, Authority (User + Role), Category (color-coded badge), Action, IP Address, Status (Success/Failed badge)
- Failed rows highlighted in red
- CSV export capability

---

## Shared Components (`app/components/`)

- **`ClassCard.tsx`** — Reusable card for class display with variant prop (in-session, closed, upcoming)
- **`StatusPill.tsx`** — Small status indicator pill
- **`TopAppBar.tsx`** — Top application bar used in Mahasiswa pages
- **`Toast.tsx`** — Toast notification system with ToastProvider context and useToast() hook
- **`ClickAwayListener.tsx`** — Utility wrapper for detecting outside clicks (dropdown dismissal)
