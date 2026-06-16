# KIMS — Krachangwittaya Innovation Management System

ระบบบริหารจัดการนวัตกรรมทางการศึกษา โรงเรียนกระแชงวิทยา สังกัด สพฐ. (รหัส 1031670201)

สร้างด้วย Google Apps Script (GAS) + Google Sheets + Google Drive

---

## โครงสร้างไฟล์

```
KIMS/
├── Code.gs                  # Entry point: doGet (serve HTML + inject EXEC_URL), doPost (API), setupSheets, wrapper functions
├── Config.gs                # ค่าคงที่: SPREADSHEET_ID, DRIVE_ROOT_FOLDER_ID, ROLES, STATUS, DEPARTMENTS ฯลฯ
├── Utils.gs                 # Helper: getDB, rowToObject, hashPassword (SHA-256), validateIdCard, response helpers, audit log
├── Auth.gs                  # Authentication: login/logout, token-based session (ScriptProperties), requireRole
├── DriveService.gs          # อัปโหลดไฟล์ base64 → Drive, สร้างโฟลเดอร์ครู/ปี
├── InnovationService.gs     # CRUD นวัตกรรม + อนุมัติ/ปฏิเสธ + filter + pagination
├── UserService.gs           # CRUD ผู้ใช้ + role guard
├── DashboardService.gs      # KPI, charts, reports, audit log
├── EmailService.gs          # แจ้งเตือนผ่าน MailApp
└── html/
    ├── Index.html           # หน้าแรก (public)
    ├── Login.html           # เข้าสู่ระบบ
    ├── Innovations.html     # เรียกดูนวัตกรรม (public)
    ├── InnovationDetail.html# รายละเอียดนวัตกรรม
    ├── Upload.html          # อัปโหลดนวัตกรรม (TEACHER+)
    ├── MyInnovations.html   # นวัตกรรมของฉัน (TEACHER+)
    ├── AdminDashboard.html  # แดชบอร์ด (ADMIN+)
    ├── AdminApprove.html    # อนุมัติ/ปฏิเสธ (ADMIN+)
    ├── AdminUsers.html      # จัดการผู้ใช้ (ADMIN+)
    ├── AdminReports.html    # รายงาน (ADMIN+)
    └── AdminConfig.html     # ตั้งค่าระบบ (SUPERADMIN เท่านั้น)
```

---

## สถาปัตยกรรมสำคัญ (อ่านก่อนแก้ไข)

### 1. Authentication = Token-based (สำคัญมาก)
GAS Web App ที่ Deploy แบบ **Execute as: Me + Access: Anyone** ทำให้
`PropertiesService.getUserProperties()` **ใช้ไม่ได้** (ผูกกับ account เจ้าของ script ไม่ใช่ผู้ใช้)

จึงใช้ **token-based session** แทน:
- `login` สร้าง token (UUID) เก็บใน `ScriptProperties` key `KIMS_TOKEN_<uuid>`
- Frontend เก็บ token ใน `sessionStorage.KIMS_TOKEN`
- ทุก API call แนบ `token` ไปด้วย
- Backend `requireRole(data, roles)` อ่าน `data.token` → `AuthService.getSessionByToken()`

### 2. Frontend → Backend = fetch() ไม่ใช่ google.script.run
`google.script.run` มี quirks เยอะ จึงใช้ `fetch()` POST ไปยัง `EXEC_URL` แทน:

```javascript
function callAPI(action, params) {
  var payload = Object.assign({ action: action, token: getToken() }, params || {});
  return fetch(getExecUrl(), {
    method: 'POST',
    redirect: 'follow',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(payload)
  }).then(function(r) { return r.json(); });
}
```

### 3. EXEC_URL Injection (สำคัญมาก)
หน้าเว็บถูก serve ใน iframe sandbox (`userCodeAppPanel`) ซึ่ง `window.location.href`
**ไม่ใช่** URL ของ `/exec` → fetch ไปจะไม่ถึง doPost

แก้โดย `doGet` ใน Code.gs **inject URL จริง** ลงในทุกหน้า:
```javascript
const execUrl = ScriptApp.getService().getUrl();
const rawHtml = HtmlService.createHtmlOutputFromFile(htmlFile).getContent();
const injected = rawHtml.replace('var EXEC_URL = "";', 'var EXEC_URL = "' + execUrl + '";');
```
ทุก HTML จึงต้องมีบรรทัด `var EXEC_URL = "";` (ห้ามแก้ format นี้ เพราะ replace ตรงตัว)

### 4. ข้อจำกัด GAS HTML
- HTML files **ห้ามมี** `<meta charset>`, `<meta viewport>`, `<title>` (Code.gs จัดการผ่าน `.addMetaTag()` / `.setTitle()`)
- CSS ต้อง inline ใน `<style>` (ใช้ external CDN ได้เฉพาะ fonts/icons/Chart.js)
- ใช้ `.setSandboxMode(IFRAME)` + `.setXFrameOptionsMode(ALLOWALL)`

---

## การ Deploy

### ขั้นที่ 1 — เตรียม Spreadsheet + Drive
ค่าถูกตั้งไว้แล้วใน `Config.gs`:
- `SPREADSHEET_ID: '1wQeNguG5FiZLZcSqkt0rmXB42sPAr8-4nKNR11t2Cr4'`
- `DRIVE_ROOT_FOLDER_ID: '1LuGNHBrOkaIOjiYsQmp7ZjLbNY5EAxN7'`

### ขั้นที่ 2 — วางไฟล์ใน GAS Editor
1. เปิด Google Apps Script project (ผูกกับ Spreadsheet ด้านบน)
2. วางไฟล์ `.gs` ทั้ง 9 ไฟล์ (ชื่อตรงกัน ไม่ต้องใส่ `.gs`)
3. สร้าง HTML files ทั้ง 11 ไฟล์ (File > New > HTML) ชื่อ **ไม่ต้องใส่ `.html`**
   เช่น ไฟล์ `Index.html` → ตั้งชื่อใน GAS ว่า `Index`

### ขั้นที่ 3 — Setup ครั้งแรก
รันใน GAS Editor ตามลำดับ:
1. `setupSheets()` — สร้าง 4 sheets (USERS, INNOVATIONS, AUDIT_LOG, CONFIG) + headers + default config
2. `initSuperAdmin()` — สร้าง Super Admin

### ขั้นที่ 4 — Deploy
1. **Deploy > New deployment**
2. Type: **Web app**
3. Execute as: **Me**
4. Who has access: **Anyone**
5. กด **Deploy** → คัดลอก Web App URL (ลงท้าย `/exec`)

> ⚠️ **ทุกครั้งที่แก้โค้ด** ต้อง Deploy > Manage deployments > Edit > Version: New version > Deploy
> (URL `/exec` เดิมจะยังใช้ได้ แค่โค้ดอัปเดต)

### ขั้นที่ 5 — เข้าใช้งาน
เปิด Web App URL → Login:
- **ID Card:** `1000000000001`
- **Password:** `Admin@2568`
- → เปลี่ยนรหัสผ่านทันทีในเมนู AdminConfig

---

## Page Routing
URL pattern: `<EXEC_URL>?page=<page>`

| page | ไฟล์ | สิทธิ์ |
|------|------|--------|
| `index` (default) | Index | public |
| `login` | Login | - |
| `innovations` | Innovations | public |
| `detail` | InnovationDetail | public |
| `upload` | Upload | TEACHER+ |
| `my-innovations` | MyInnovations | TEACHER+ |
| `admin-dashboard` | AdminDashboard | ADMIN+ |
| `admin-approve` | AdminApprove | ADMIN+ |
| `admin-users` | AdminUsers | ADMIN+ |
| `admin-reports` | AdminReports | ADMIN+ |
| `admin-config` | AdminConfig | SUPERADMIN |

---

## API Actions (ผ่าน doPost)
ทุก action ส่งผ่าน `callAPI('<action>', { ...params, token })`

**Auth:** `login`, `logout`, `getCurrentUser`, `changePassword`
**Public:** `getInnovations`, `getInnovationById`, `getPublicStats`
**Teacher:** `createInnovation`, `updateInnovation`, `deleteInnovation`, `getMyInnovations`, `uploadFile`, `checkUrl`
**Admin:** `approveInnovation`, `rejectInnovation`, `getPendingList`, `getAllInnovations`, `getDashboardData`, `getYearlyReport`, `getTeacherReport`, `getAuditLog`, `getUsers`, `createUser`, `updateUser`, `toggleUserActive`
**SuperAdmin:** `getConfig`, `updateConfig`

---

## Google Sheets Schema

**USERS:** user_id, id_card, password_hash, title, first_name, last_name, role, department, email, phone, drive_folder_id, is_active, created_at, last_login

**INNOVATIONS:** innovation_id, title, type_code, department, grade_level (JSON), academic_year, semester, description, tags, teacher_id, teacher_name, file_urls (JSON), file_names (JSON), link_url, drive_folder_id, status, reject_reason, approved_by, approved_at, view_count, created_at, updated_at

**AUDIT_LOG:** log_id, user_id, action, target_type, target_id, detail, ip_address, timestamp

**CONFIG:** config_key, config_value, description

---

## ค่าคงที่
- **ROLES:** SUPERADMIN, ADMIN, HEAD, TEACHER
- **STATUS:** DRAFT, PENDING, PUBLISHED, REJECTED
- **กลุ่มสาระ:** 8 กลุ่ม + กิจกรรมพัฒนาผู้เรียน
- **ระดับชั้น:** ม.1–ม.6
- **ประเภทนวัตกรรม:** 01–05, 99

---

## หมายเหตุสำหรับการพัฒนาต่อใน Claude Code

1. **เพิ่ม API action ใหม่** ต้องทำ 3 จุด:
   - เพิ่ม method ใน Service ที่เกี่ยวข้อง (รับ `data`, เรียก `requireRole(data, [...])`)
   - เพิ่ม route ใน `Code.gs > handleRequest > routes`
   - เพิ่ม wrapper function ใน `Code.gs` (ถ้าต้องการเรียกผ่าน google.script.run ด้วย — แต่ frontend ใช้ fetch อยู่แล้วจึงไม่จำเป็น)

2. **เพิ่มหน้าใหม่** ต้องทำ:
   - สร้าง HTML file + ใส่ `var EXEC_URL = "";` + `callAPI` helper + `goTo`/`getToken`
   - เพิ่ม entry ใน `Code.gs > doGet > pageMap`

3. **ทดสอบ local ไม่ได้** — ต้อง deploy แล้วทดสอบบน GAS เท่านั้น (ใช้ `Logger.log` + View > Logs ในการ debug)

4. **CORS / fetch** — fetch จาก iframe ไป /exec ใช้ `Content-Type: text/plain` เพื่อเลี่ยง preflight; doPost อ่าน `e.postData.contents` แล้ว JSON.parse
