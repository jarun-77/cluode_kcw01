# CLAUDE.md — Developer Guide for KIMS
# Complete Instructions for Claude Code / AI Development

---

## 🎯 Project Overview

**Project:** KIMS — Krachangwittaya Innovation Management System
**Type:** Google Apps Script (GAS) Web Application
**Organization:** โรงเรียนกระแชงวิทยา สังกัด สพฐ.
**Stack:** 100% Google Workspace — GAS + Sheets + Drive

---

## 🛠 Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Runtime | Google Apps Script (V8) | Latest |
| Frontend | HTML Service (HTML5 + CSS3 + Vanilla JS) | - |
| Database | Google Sheets | - |
| Storage | Google Drive API (via GAS DriveApp) | - |
| Auth | GAS PropertiesService + SHA-256 | - |
| Charts | Chart.js (CDN) | 4.x |
| Icons | Font Awesome (CDN) | 6.x |
| Fonts | Google Fonts (Sarabun, Prompt) | - |
| Email | GAS MailApp | - |
| Deployment | GAS Web App (Execute as: Me, Access: Anyone) | - |

---

## 📁 Folder Structure

```
kims/
├── Code.gs                  # Main entry: doGet(), doPost(), routing
├── Auth.gs                  # Login, logout, session management
├── InnovationService.gs     # CRUD นวัตกรรม, workflow
├── DriveService.gs          # Google Drive operations, folder creation
├── UserService.gs           # CRUD ผู้ใช้
├── DashboardService.gs      # Dashboard & Report data
├── EmailService.gs          # Email notifications
├── Utils.gs                 # Helpers: UUID, hash, date, validate
├── Config.gs                # System config constants
│
├── html/
│   ├── Index.html           # หน้าหลัก (Public)
│   ├── Login.html           # หน้าเข้าสู่ระบบ
│   ├── Innovations.html     # รายการนวัตกรรม (Public)
│   ├── InnovationDetail.html # รายละเอียดนวัตกรรม
│   ├── Upload.html          # อัปโหลดนวัตกรรม (Teacher)
│   ├── MyInnovations.html   # นวัตกรรมของฉัน (Teacher)
│   ├── AdminDashboard.html  # Dashboard (Admin)
│   ├── AdminApprove.html    # อนุมัติ/ปฏิเสธ (Admin)
│   ├── AdminUsers.html      # จัดการผู้ใช้ (Admin)
│   ├── AdminConfig.html     # ตั้งค่าระบบ (Super Admin)
│   └── AdminReports.html    # รายงาน (Admin)
│
└── css/
    └── (Inline CSS in HTML files — GAS limitation)
```

---

## 📋 Coding Standards

### GAS Backend (*.gs files)

```javascript
// ✅ ตั้งชื่อ Function แบบ camelCase
function getInnovationById(id) { }

// ✅ ทุก Function ที่เรียกจาก Frontend ต้อง return JSON
function getInnovations(params) {
  try {
    // ... logic
    return { success: true, data: result };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

// ✅ ตรวจสอบ Permission ก่อนทุก operation
function createInnovation(data) {
  const session = getSession();
  if (!session || !['TEACHER','ADMIN','SUPERADMIN'].includes(session.role)) {
    return { success: false, error: 'Unauthorized' };
  }
  // ... proceed
}

// ✅ Constants ใน Config.gs
const SHEET_NAMES = {
  USERS: 'USERS',
  INNOVATIONS: 'INNOVATIONS',
  AUDIT_LOG: 'AUDIT_LOG',
  CONFIG: 'CONFIG'
};

const ROLES = { SUPERADMIN: 'SUPERADMIN', ADMIN: 'ADMIN', HEAD: 'HEAD', TEACHER: 'TEACHER' };
const STATUS = { DRAFT: 'DRAFT', PENDING: 'PENDING', PUBLISHED: 'PUBLISHED', REJECTED: 'REJECTED' };
```

### doGet() / doPost() Routing Pattern (Code.gs)

```javascript
function doGet(e) {
  const page = e.parameter.page || 'index';
  const pageMap = {
    'index': 'Index',
    'login': 'Login',
    'innovations': 'Innovations',
    'detail': 'InnovationDetail',
    'upload': 'Upload',
    'my-innovations': 'MyInnovations',
    'admin-dashboard': 'AdminDashboard',
    // ...
  };
  const template = HtmlService.createTemplateFromFile(pageMap[page] || 'Index');
  template.page = page;
  return template.evaluate()
    .setTitle('KIMS — ระบบบริหารจัดการนวัตกรรม')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function doPost(e) {
  const data = JSON.parse(e.postData.contents);
  const action = data.action;
  const actionMap = {
    'login': () => AuthService.login(data),
    'createInnovation': () => InnovationService.create(data),
    'uploadFile': () => DriveService.uploadFile(data),
    'approveInnovation': () => InnovationService.approve(data),
    // ...
  };
  if (!actionMap[action]) return JSON.stringify({ success: false, error: 'Unknown action' });
  return ContentService.createTextOutput(JSON.stringify(actionMap[action]()))
    .setMimeType(ContentService.MimeType.JSON);
}
```

### Frontend HTML Pattern

```html
<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>KIMS</title>
  <!-- Google Fonts -->
  <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;500;600;700&family=Prompt:wght@400;600;700&display=swap" rel="stylesheet">
  <!-- Font Awesome -->
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
  <!-- Chart.js (Admin pages only) -->
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4/dist/chart.umd.min.js"></script>
  <style>
    /* CSS Variables */
    :root {
      --primary: #1A5276;
      --secondary: #2E86C1;
      --accent: #148F77;
      --light-blue: #D6EAF8;
      --gray-bg: #F2F3F4;
      --font-main: 'Sarabun', sans-serif;
      --font-heading: 'Prompt', sans-serif;
      --radius: 12px;
      --shadow: 0 2px 12px rgba(0,0,0,0.08);
      --shadow-hover: 0 6px 20px rgba(26,82,118,0.15);
    }
    body { font-family: var(--font-main); background: var(--gray-bg); margin: 0; }
  </style>
</head>
<body>
  <!-- Content -->
  <script>
    // ✅ เรียก GAS Backend ผ่าน google.script.run
    function callAPI(action, params) {
      return new Promise((resolve, reject) => {
        google.script.run
          .withSuccessHandler(resolve)
          .withFailureHandler(reject)
          .handleRequest({ action, ...params });
      });
    }
    // ✅ ตัวอย่างการใช้งาน
    async function loadInnovations() {
      showLoading(true);
      try {
        const result = await callAPI('getInnovations', { page: 1, limit: 12 });
        if (result.success) renderCards(result.data);
        else showError(result.error);
      } catch(e) {
        showError('เกิดข้อผิดพลาด กรุณาลองใหม่');
      } finally {
        showLoading(false);
      }
    }
  </script>
</body>
</html>
```

---

## 🗄 Database Standards

### Google Sheets Operations Pattern

```javascript
// ✅ ดึง Spreadsheet จาก ID (ระบุใน Config)
function getDB() {
  return SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
}

// ✅ CRUD Template
function findUserByIdCard(idCard) {
  const sheet = getDB().getSheetByName(SHEET_NAMES.USERS);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const idCardCol = headers.indexOf('id_card');
  const row = data.find((r, i) => i > 0 && r[idCardCol] === idCard);
  if (!row) return null;
  return headers.reduce((obj, key, i) => ({ ...obj, [key]: row[i] }), {});
}

// ✅ Insert Row
function insertInnovation(obj) {
  const sheet = getDB().getSheetByName(SHEET_NAMES.INNOVATIONS);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const row = headers.map(h => obj[h] ?? '');
  sheet.appendRow(row);
}

// ✅ Update Row by ID
function updateInnovationStatus(innovationId, status, adminId) {
  const sheet = getDB().getSheetByName(SHEET_NAMES.INNOVATIONS);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const idCol = headers.indexOf('innovation_id') + 1;
  const statusCol = headers.indexOf('status') + 1;
  for (let i = 1; i < data.length; i++) {
    if (data[i][idCol - 1] === innovationId) {
      sheet.getRange(i + 1, statusCol).setValue(status);
      break;
    }
  }
}
```

---

## 🔐 Security Standards

```javascript
// ✅ Password Hashing (SHA-256 via GAS)
function hashPassword(password) {
  const bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    password + CONFIG.SALT,
    Utilities.Charset.UTF_8
  );
  return bytes.map(b => ('0' + (b & 0xFF).toString(16)).slice(-2)).join('');
}

// ✅ Session Management
function createSession(user) {
  const token = Utilities.getUuid();
  const userProps = PropertiesService.getUserProperties();
  userProps.setProperty('SESSION_TOKEN', token);
  userProps.setProperty('SESSION_USER', JSON.stringify({
    user_id: user.user_id, role: user.role, name: user.first_name,
    department: user.department, expires: Date.now() + (8 * 60 * 60 * 1000)
  }));
  return token;
}

function getSession() {
  const props = PropertiesService.getUserProperties();
  const sessionStr = props.getProperty('SESSION_USER');
  if (!sessionStr) return null;
  const session = JSON.parse(sessionStr);
  if (Date.now() > session.expires) { clearSession(); return null; }
  return session;
}

// ✅ Input Sanitization
function sanitize(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/[<>'"]/g, '').trim().substring(0, 2000);
}

// ✅ Validate Thai ID Card (Checksum)
function validateIdCard(id) {
  if (!/^[0-9]{13}$/.test(id)) return false;
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += parseInt(id[i]) * (13 - i);
  return (11 - (sum % 11)) % 10 === parseInt(id[12]);
}
```

---

## 📁 Google Drive Standards

```javascript
// ✅ สร้าง Folder Structure: ROOT/ปีการศึกษา/ชื่อครู/
function getOrCreateTeacherFolder(teacherName, academicYear) {
  const rootFolder = DriveApp.getFolderById(CONFIG.DRIVE_ROOT_FOLDER_ID);
  // ปีการศึกษา folder
  const yearFolders = rootFolder.getFoldersByName(String(academicYear));
  const yearFolder = yearFolders.hasNext()
    ? yearFolders.next()
    : rootFolder.createFolder(String(academicYear));
  // ครู folder
  const teacherFolders = yearFolder.getFoldersByName(teacherName);
  const teacherFolder = teacherFolders.hasNext()
    ? teacherFolders.next()
    : yearFolder.createFolder(teacherName);
  return teacherFolder;
}

// ✅ อัปโหลดไฟล์ (Base64 จาก Frontend)
function uploadFileToDrive(base64Data, fileName, mimeType, teacherName, academicYear) {
  const folder = getOrCreateTeacherFolder(teacherName, academicYear);
  const blob = Utilities.newBlob(Utilities.base64Decode(base64Data), mimeType, fileName);
  const file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return { fileId: file.getId(), fileUrl: file.getUrl(), viewUrl: `https://drive.google.com/file/d/${file.getId()}/preview` };
}
```

---

## 📊 Dashboard / Chart Standards

```javascript
// ✅ Chart.js Configuration Template
const chartDefaults = {
  responsive: true,
  plugins: {
    legend: { labels: { font: { family: 'Sarabun', size: 13 } } },
    tooltip: { titleFont: { family: 'Sarabun' }, bodyFont: { family: 'Sarabun' } }
  }
};

// ✅ Donut Chart (ประเภทนวัตกรรม)
new Chart(document.getElementById('typeChart'), {
  type: 'doughnut',
  data: {
    labels: ['สื่อการสอน/CAI', 'วิจัยในชั้นเรียน', 'แผนการสอน', 'ชุดกิจกรรม', 'เทคโนโลยี', 'อื่นๆ'],
    datasets: [{ data: [30,25,20,15,8,2], backgroundColor: ['#1A5276','#2E86C1','#148F77','#F39C12','#8E44AD','#85929E'] }]
  },
  options: { ...chartDefaults, cutout: '60%' }
});
```

---

## 🚀 Deployment Standards

### Setup Steps
```
1. สร้าง Google Spreadsheet ใหม่
   → สร้าง Sheets: USERS, INNOVATIONS, AUDIT_LOG, CONFIG
   → เพิ่ม Headers ตาม Database Design
   → บันทึก Spreadsheet ID

2. สร้าง Google Drive Folder
   → สร้าง Folder ชื่อ "KIMS"
   → บันทึก Folder ID

3. สร้าง Google Apps Script Project
   → สร้างไฟล์ตาม Folder Structure
   → ตั้งค่า CONFIG.gs ใส่ SPREADSHEET_ID และ DRIVE_ROOT_FOLDER_ID

4. Deploy เป็น Web App
   → Deploy → New Deployment
   → Type: Web App
   → Execute as: Me (your Google Account)
   → Who has access: Anyone
   → Copy Web App URL

5. สร้าง Super Admin Account แรก
   → เรียกฟังก์ชัน initSuperAdmin() ครั้งเดียวใน Script Editor
```

### CONFIG.gs Template
```javascript
const CONFIG = {
  SPREADSHEET_ID: 'YOUR_SPREADSHEET_ID_HERE',
  DRIVE_ROOT_FOLDER_ID: 'YOUR_DRIVE_FOLDER_ID_HERE',
  SALT: 'KIMS_KRACHANGWITTAYA_2568',   // เปลี่ยนก่อน Deploy
  ADMIN_EMAIL: 'admin@krachangwittaya.ac.th',
  SCHOOL_NAME: 'โรงเรียนกระแชงวิทยา',
  MAX_FILE_SIZE_MB: 100,
  SESSION_HOURS: 8,
  OBEC_CODE: '1031670201',             // รหัสโรงเรียน สพฐ.
};
```

---

## ✅ Testing Standards

```javascript
// ✅ Test Functions ใน Script Editor (Run → ชื่อ function)
function TEST_login() {
  const result = AuthService.login({ id_card: '1234567890123', password: 'test1234' });
  Logger.log(JSON.stringify(result));
}

function TEST_createInnovation() {
  // Mock session first
  // ...
}

function TEST_driveUpload() {
  const result = DriveService.testUpload();
  Logger.log(result);
}
```

---

## 📝 OBEC Context Notes

- **ปีการศึกษา** ใช้ พ.ศ. เช่น 2567, 2568 (ไม่ใช่ ค.ศ.)
- **ภาคเรียน** มี 2 ภาค: ภาคเรียนที่ 1 (พ.ค.-ต.ค.) และ ภาคเรียนที่ 2 (พ.ย.-มี.ค.)
- **กลุ่มสาระการเรียนรู้** 8 กลุ่ม ตามหลักสูตรแกนกลาง 2551:
  1. ภาษาไทย
  2. คณิตศาสตร์
  3. วิทยาศาสตร์และเทคโนโลยี
  4. สังคมศึกษา ศาสนา และวัฒนธรรม
  5. สุขศึกษาและพลศึกษา
  6. ศิลปะ
  7. การงานอาชีพ
  8. ภาษาต่างประเทศ
  + กิจกรรมพัฒนาผู้เรียน
- **ระดับชั้น:** ม.1 - ม.6 (มัธยมศึกษาปีที่ 1-6)
- **ชื่อโรงเรียน:** โรงเรียนกระแชงวิทยา

---

## 🎓 AI Development Command

เมื่อเริ่มพัฒนา ให้ Claude Code อ่าน CLAUDE.md นี้ก่อน แล้ว:

1. สร้างไฟล์ตาม Folder Structure ข้างต้นทั้งหมด
2. เริ่มจาก Config.gs และ Utils.gs ก่อน
3. สร้าง Auth.gs (Login/Session) ต่อไป
4. สร้าง InnovationService.gs และ DriveService.gs
5. สร้าง HTML pages ทีละหน้า เริ่มจาก Index.html → Login.html → Upload.html
6. ทดสอบแต่ละ Function ใน Script Editor ก่อน Deploy
7. Deploy เป็น Web App และทดสอบ End-to-End

**ห้ามใช้ Library ภายนอกที่ไม่ใช่ CDN (Chart.js, Font Awesome, Google Fonts เท่านั้น)**
**ห้ามใช้ Database ภายนอก — ใช้ Google Sheets เท่านั้น**
**ห้ามใช้ Server ภายนอก — ใช้ GAS Web App เท่านั้น**
