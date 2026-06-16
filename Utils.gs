// ============================================================
// Utils.gs — Utility / Helper Functions
// KIMS — โรงเรียนกระแชงวิทยา
// ============================================================

// ─── Database ───────────────────────────────────────────────

/** คืนค่า Spreadsheet object */
function getDB() {
  return SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
}

/** คืนค่า Sheet ตามชื่อ */
function getSheet(sheetName) {
  return getDB().getSheetByName(sheetName);
}

/** แปลง row array → object ตาม headers */
function rowToObject(headers, row) {
  return headers.reduce((obj, key, i) => {
    obj[key] = row[i] !== undefined ? row[i] : '';
    return obj;
  }, {});
}

/** ดึงทุก row ใน sheet เป็น Array ของ Object */
function getAllRows(sheetName) {
  const sheet = getSheet(sheetName);
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];
  const headers = data[0];
  return data.slice(1).map(row => rowToObject(headers, row));
}

/** Append row ใหม่ตาม object (key ตรงกับ header) */
function appendRow(sheetName, obj) {
  const sheet = getSheet(sheetName);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const row = headers.map(h => {
    const val = obj[h];
    return val !== undefined && val !== null ? val : '';
  });
  sheet.appendRow(row);
}

/** Update cell ใน row ที่ค่า idColumn ตรงกับ idValue */
function updateRowByKey(sheetName, idColumn, idValue, updateObj) {
  const sheet = getSheet(sheetName);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const idCol = headers.indexOf(idColumn);
  if (idCol === -1) throw new Error('Column not found: ' + idColumn);

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][idCol]) === String(idValue)) {
      Object.keys(updateObj).forEach(key => {
        const col = headers.indexOf(key);
        if (col !== -1) {
          sheet.getRange(i + 1, col + 1).setValue(updateObj[key]);
        }
      });
      return true;
    }
  }
  return false;
}

/** ลบ row ที่ค่า idColumn ตรงกับ idValue */
function deleteRowByKey(sheetName, idColumn, idValue) {
  const sheet = getSheet(sheetName);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const idCol = headers.indexOf(idColumn);
  if (idCol === -1) return false;

  for (let i = data.length - 1; i >= 1; i--) {
    if (String(data[i][idCol]) === String(idValue)) {
      sheet.deleteRow(i + 1);
      return true;
    }
  }
  return false;
}

// ─── ID / UUID ──────────────────────────────────────────────

/** สร้าง UUID แบบ GAS */
function generateUUID() {
  return Utilities.getUuid();
}

/** สร้าง User ID แบบ USR-2568-xxx */
function generateUserId() {
  const year = getCurrentThaiYear();
  const rand = Math.floor(Math.random() * 9000) + 1000;
  return `USR-${year}-${rand}`;
}

/** สร้าง Innovation ID แบบ INV-2568-xxx */
function generateInnovationId() {
  const year = getCurrentThaiYear();
  const rand = Math.floor(Math.random() * 90000) + 10000;
  return `INV-${year}-${rand}`;
}

// ─── Date / Time ────────────────────────────────────────────

/** คืนค่าวันเวลาปัจจุบัน ในรูป String */
function now() {
  return Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyy-MM-dd HH:mm:ss');
}

/** คืนค่าปีการศึกษาปัจจุบัน (พ.ศ.) */
function getCurrentThaiYear() {
  const date = new Date();
  return date.getFullYear() + 543;
}

/** คืน Array ปีการศึกษาย้อนหลัง 5 ปี + ปีปัจจุบัน */
function getAcademicYears() {
  const currentYear = getCurrentThaiYear();
  const years = [];
  for (let i = 0; i <= 5; i++) {
    years.push(currentYear - i);
  }
  return years;
}

// ─── Security ───────────────────────────────────────────────

/** Hash password ด้วย SHA-256 + SALT */
function hashPassword(password) {
  const bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    password + CONFIG.SALT,
    Utilities.Charset.UTF_8
  );
  return bytes.map(b => ('0' + (b & 0xFF).toString(16)).slice(-2)).join('');
}

/** Validate เลขประจำตัวประชาชน (13 หลัก + checksum) */
function validateIdCard(id) {
  if (!/^[0-9]{13}$/.test(id)) return false;
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(id[i]) * (13 - i);
  }
  return (11 - (sum % 11)) % 10 === parseInt(id[12]);
}

/** Sanitize string input — ป้องกัน XSS */
function sanitize(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/[<>'"]/g, '').trim().substring(0, 2000);
}

/** Sanitize object ทุก string field */
function sanitizeObject(obj) {
  const result = {};
  Object.keys(obj).forEach(key => {
    result[key] = typeof obj[key] === 'string' ? sanitize(obj[key]) : obj[key];
  });
  return result;
}

/** Validate URL — ต้องขึ้นต้น https:// */
function validateUrl(url) {
  if (!url || typeof url !== 'string') return false;
  return /^https:\/\/.+/.test(url.trim());
}

// ─── Validation ─────────────────────────────────────────────

/** ตรวจสอบขนาดไฟล์ (MB) */
function validateFileSize(base64Data, maxMb) {
  const bytes = (base64Data.length * 3) / 4;
  const mb = bytes / (1024 * 1024);
  return mb <= maxMb;
}

/** ตรวจสอบนามสกุลไฟล์ */
function validateFileExtension(fileName) {
  const ext = fileName.split('.').pop().toLowerCase();
  return ALLOWED_FILE_TYPES.includes(ext);
}

// ─── Response Helpers ────────────────────────────────────────

/** สร้าง success response */
function successResponse(data, message) {
  return { success: true, data: data || null, message: message || 'OK' };
}

/** สร้าง error response */
function errorResponse(message, code) {
  return { success: false, error: message || 'เกิดข้อผิดพลาด', code: code || 400 };
}

// ─── Audit Log ──────────────────────────────────────────────

/** บันทึก Audit Log */
function writeAuditLog(userId, action, targetType, targetId, detail) {
  try {
    appendRow(SHEET_NAMES.AUDIT_LOG, {
      log_id: generateUUID(),
      user_id: userId || 'GUEST',
      action: action,
      target_type: targetType || '',
      target_id: targetId || '',
      detail: typeof detail === 'object' ? JSON.stringify(detail) : (detail || ''),
      ip_address: '',  // GAS ไม่ expose IP โดยตรง
      timestamp: now(),
    });
  } catch (e) {
    Logger.log('Audit log error: ' + e.message);
  }
}

// ─── Format Helpers ─────────────────────────────────────────

/** normalize รหัสประเภท → 2 หลักเสมอ (กัน Sheets ตัด 0 นำหน้า เช่น '01'→1) */
function normTypeCode(code) {
  return String(code == null ? '' : code).trim().padStart(2, '0');
}

/** แปลงรหัสประเภทนวัตกรรม → ชื่อ */
function getInnovationTypeName(code) {
  return INNOVATION_TYPES[normTypeCode(code)] || 'ไม่ระบุ';
}

/** แปลง status → ชื่อภาษาไทย */
function getStatusLabel(status) {
  const map = {
    DRAFT: 'ร่าง',
    PENDING: 'รออนุมัติ',
    PUBLISHED: 'เผยแพร่แล้ว',
    REJECTED: 'ถูกปฏิเสธ',
  };
  return map[status] || status;
}

/** แปลง role → ชื่อภาษาไทย */
function getRoleLabel(role) {
  const map = {
    SUPERADMIN: 'ผู้ดูแลระบบสูงสุด',
    ADMIN: 'ผู้ดูแลระบบ',
    HEAD: 'หัวหน้ากลุ่มสาระ',
    TEACHER: 'ครู',
  };
  return map[role] || role;
}

/** แปลง Array เป็น JSON string (สำหรับเก็บใน Sheets) */
function arrayToJson(arr) {
  return JSON.stringify(Array.isArray(arr) ? arr : []);
}

/** แปลง JSON string → Array */
function jsonToArray(str) {
  try {
    const parsed = JSON.parse(str);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}
