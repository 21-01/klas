const ORIGIN = 'https://klas-demo.vercel.app';
const AUTH = 'https://ep-winter-hat-az4t5c3x.neonauth.c-3.ap-southeast-1.aws.neon.tech/neondb/auth';
const API = 'https://br-wild-unit-azq7a8bc-api.compute.c-3.ap-southeast-1.aws.neon.tech';
const PASSWORD = 'KlasDemo#2026';
const SAMPLE_JADWAL = 'f0000000-0000-0000-0000-000000000001';

let failures = 0;
const log = (label, ok, extra = '') => {
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${extra ? ' :: ' + extra : ''}`);
};

async function signIn(email) {
  const res = await fetch(`${AUTH}/sign-in/email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: ORIGIN },
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  const body = await res.json().catch(() => ({}));
  const rawCookies = res.headers.getSetCookie?.() ?? [];
  const cookie = rawCookies.map((c) => c.split(';')[0]).join('; ');
  const tokenRes = await fetch(`${AUTH}/token`, { headers: { Origin: ORIGIN, cookie } });
  const tokenJson = await tokenRes.json().catch(() => ({}));
  log(`sign-in ${email}`, res.status === 200 && !!tokenJson.token, `signin=${res.status} token=${tokenRes.status}`);
  return { token: tokenJson.token, cookieAttrs: rawCookies.map((c) => c.split(';').slice(1).join(';').trim()) };
}

async function call(token, fn, payload = {}, method = 'POST') {
  const res = await fetch(`${API}/${fn}`, {
    method,
    headers: { 'Content-Type': 'application/json', Origin: ORIGIN, Authorization: `Bearer ${token}` },
    body: method === 'GET' ? undefined : JSON.stringify(payload),
  });
  const text = await res.text();
  let parsed;
  try { parsed = JSON.parse(text); } catch { parsed = null; }
  return { status: res.status, allow: res.headers.get('access-control-allow-origin'), text, parsed };
}

function expect(label, r, check = () => true) {
  const ok = r.status === 200 && r.allow === ORIGIN && check(r.parsed);
  log(label, ok, `status=${r.status} snippet=${r.text.slice(0, 140)}`);
  return r.parsed;
}

const pf = await fetch(`${API}/get-my-profile`, {
  method: 'OPTIONS',
  headers: { Origin: ORIGIN, 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'content-type,authorization' },
});
log('api preflight', pf.headers.get('access-control-allow-origin') === ORIGIN, `status=${pf.status}`);

// ---- admin ----
const admin = await signIn('admin@klas.unj.ac.id');
console.log('       cookie attrs:', admin.cookieAttrs.join(' | '));
expect('admin /get-my-profile', await call(admin.token, 'get-my-profile'));
expect('admin /get-admin-dashboard', await call(admin.token, 'get-admin-dashboard'));
expect('admin /get-global-attendance', await call(admin.token, 'get-global-attendance', { limit: 5 }));
expect('admin /get-notifications list', await call(admin.token, 'get-notifications', { action: 'list', limit: 10 }));
expect('admin /get-audit-logs', await call(admin.token, 'get-audit-logs', { limit: 5 }));
expect('admin /get-admin-attendance-courses', await call(admin.token, 'get-admin-attendance-courses'));
expect('admin /crud-mahasiswa list', await call(admin.token, 'crud-mahasiswa', { action: 'list', limit: 5 }));

// ---- dosen ----
const dosen = await signIn('samudra.adi@unj.ac.id');
expect('dosen /get-my-profile', await call(dosen.token, 'get-my-profile'));
expect('dosen /get-dosen-dashboard', await call(dosen.token, 'get-dosen-dashboard'));
expect('dosen /get-dosen-profile', await call(dosen.token, 'get-dosen-profile'));
expect('dosen /get-notifications stats', await call(dosen.token, 'get-notifications', { action: 'stats' }));
expect('dosen /get-course-students', await call(dosen.token, 'get-course-students', { jadwal_id: SAMPLE_JADWAL, limit: 10 }));
expect('dosen /get-dosen-report', await call(dosen.token, 'get-dosen-report', { jadwal_id: SAMPLE_JADWAL }));
const csv = await call(dosen.token, 'export-report', { jadwal_id: SAMPLE_JADWAL, format: 'csv' });
log('dosen /export-report', csv.status === 200 && csv.allow === ORIGIN && csv.text.length > 0, `status=${csv.status} bytes=${csv.text.length}`);

const sessions = expect('dosen /list-sessions', await call(dosen.token, 'list-sessions', { jadwal_id: SAMPLE_JADWAL, limit: 5 }));
const sesiId = sessions?.sessions?.[0]?.sesi_id ?? sessions?.data?.[0]?.sesi_id;
log('session id available', !!sesiId, `sesi_id=${sesiId ?? 'none'}`);

// ---- mahasiswa ----
const mhs = await signIn('nandana.ammar@mhs.unj.ac.id');
expect('mahasiswa /get-my-profile', await call(mhs.token, 'get-my-profile'));
expect('mahasiswa /get-my-dashboard', await call(mhs.token, 'get-my-dashboard'));
expect('mahasiswa /get-my-logs', await call(mhs.token, 'get-my-logs', { limit: 5 }));
expect('mahasiswa /get-attendance-stats', await call(mhs.token, 'get-attendance-stats'));
expect('mahasiswa /get-notifications list', await call(mhs.token, 'get-notifications', { action: 'list', limit: 10 }));

// ---- realtime: capability config + sealed queries ----
const cfg = expect('dosen GET /realtime/config', await call(dosen.token, 'realtime/config', {}, 'GET'));
log('realtime config url', !!cfg?.url, `url=${cfg?.url ?? 'none'}`);
if (sesiId) {
  const sealedP = expect('dosen POST /realtime/presensi', await call(dosen.token, 'realtime/presensi', { sesi_id: sesiId }));
  log('sealed presensi capability', !!sealedP?.capability, `keys=${Object.keys(sealedP ?? {}).join(',')}`);
  const sealedS = expect('dosen POST /realtime/sesi', await call(dosen.token, 'realtime/sesi', { sesi_id: sesiId }));
  log('sealed sesi capability', !!sealedS?.capability, `keys=${Object.keys(sealedS ?? {}).join(',')}`);
}
const sealedN = expect('mahasiswa POST /realtime/notifikasi', await call(mhs.token, 'realtime/notifikasi'));
log('sealed notifikasi capability', !!sealedN?.capability, `keys=${Object.keys(sealedN ?? {}).join(',')}`);

console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
