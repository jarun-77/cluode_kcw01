// ============================================================
// Code.gs — Main Entry Point: doGet() / doPost() Routing
// KIMS — โรงเรียนกระแชงวิทยา
// ============================================================

/** doGet: serve Single-Page App (SPA)
 *  ทั้งระบบเป็นหน้าเดียว — สลับ view ด้วย JavaScript ฝั่ง client
 *  ทุก backend call ใช้ google.script.run → handleRequest()
 *  ไม่มี cross-page navigation จึงไม่เกิด iframe ซ้อน / redirect loop ใน GAS
 */
function doGet(e) {
  try {
    ensureSchema();
    return HtmlService.createHtmlOutputFromFile('App')
      .setTitle('KIMS — ระบบบริหารจัดการนวัตกรรม | โรงเรียนกระแชงวิทยา')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  } catch (err) {
    Logger.log('doGet error: ' + err.message);
    return HtmlService.createHtmlOutput(
      '<html><body style="font-family:sans-serif;padding:40px;text-align:center;">' +
      '<h2 style="color:#E74C3C;">เกิดข้อผิดพลาด</h2><p>' + err.message + '</p>' +
      '</body></html>'
    );
  }
}

/** doPost: รับ API request และ dispatch ไปยัง Service ที่เหมาะสม */
function doPost(e) {
  try {
    const raw = e && e.postData && e.postData.contents ? e.postData.contents : '{}';
    const data = JSON.parse(raw);
    const action = data.action || '';

    const result = handleRequest(data);
    return ContentService
      .createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    Logger.log('doPost error: ' + err.message);
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/** Central router: map action → service function */
function handleRequest(data) {
  const action = data.action || '';

  const routes = {
    // ─── Auth ─────────────────────────────────────
    'login':                () => AuthService.login(data),
    'logout':               () => AuthService.logout(),
    'getCurrentUser':       () => AuthService.getCurrentUser(),
    'changePassword':       () => AuthService.changePassword(data),
    'updateProfile':        () => UserService.updateProfile(data),

    // ─── Public ───────────────────────────────────
    'getInnovations':       () => InnovationService.getInnovations(data),
    'getInnovationById':    () => InnovationService.getInnovationById(data),
    'getPublicStats':       () => InnovationService.getPublicStats(),

    // ─── Teacher ──────────────────────────────────
    'createInnovation':     () => InnovationService.create(data),
    'updateInnovation':     () => InnovationService.update(data),
    'deleteInnovation':     () => InnovationService.delete(data),
    'getMyInnovations':     () => InnovationService.getMyInnovations(data),
    'uploadFile':           () => DriveService.uploadFile(data),
    'checkUrl':             () => DriveService.checkUrlActive(data),

    // ─── Admin ────────────────────────────────────
    'approveInnovation':    () => InnovationService.approve(data),
    'rejectInnovation':     () => InnovationService.reject(data),
    'getPendingList':       () => InnovationService.getPendingList(data),
    'getAllInnovations':     () => InnovationService.getAllInnovations(data),
    'getDashboardData':     () => DashboardService.getDashboardData(data),
    'getYearlyReport':      () => DashboardService.getYearlyReport(data),
    'getTeacherReport':     () => DashboardService.getTeacherReport(data),
    'getApprovalReport':    () => DashboardService.getApprovalReport(data),
    'getAuditLog':          () => DashboardService.getAuditLog(data),

    // ─── User Management ──────────────────────────
    'getUsers':             () => UserService.getUsers(data),
    'createUser':           () => UserService.createUser(data),
    'updateUser':           () => UserService.updateUser(data),
    'toggleUserActive':     () => UserService.toggleUserActive(data),
    'bulkImportUsers':      () => UserService.bulkImportUsers(data),

    // ─── Super Admin ──────────────────────────────
    'getConfig':            () => DashboardService.getConfig(data),
    'getPublicConfig':      () => DashboardService.getPublicConfig(),
    'updateConfig':         () => DashboardService.updateConfig(data),
  };

  if (!routes[action]) {
    return errorResponse(`ไม่รู้จัก action: ${action}`);
  }

  try {
    const result = routes[action]();
    // Normalize → JSON-safe: แปลง Date object (จาก Sheets) เป็น string
    // ป้องกัน google.script.run คืน null เมื่อ payload มี type ที่ serialize ข้าม iframe ไม่ได้
    return JSON.parse(JSON.stringify(result == null ? { success: false, error: 'no result' } : result));
  } catch (e) {
    Logger.log(`handleRequest error [${action}]: ` + e.message);
    return errorResponse(e.message);
  }
}

// ─── Schema migration (auto, idempotent) ────────────────────
/** เพิ่มคอลัมน์ใหม่ให้ระบบที่ติดตั้งไปแล้ว โดยไม่ต้อง setup ใหม่ */
function ensureSchema() {
  try {
    const props = PropertiesService.getScriptProperties();
    if (props.getProperty('SCHEMA_V2') === 'done') return;
    const db = getDB();
    addColumnIfMissing(db.getSheetByName(SHEET_NAMES.USERS), 'profile_url');
    addColumnIfMissing(db.getSheetByName(SHEET_NAMES.INNOVATIONS), 'cover_url');
    props.setProperty('SCHEMA_V2', 'done');
  } catch (e) {
    Logger.log('ensureSchema error: ' + e.message);
  }
}
function addColumnIfMissing(sheet, colName) {
  if (!sheet) return;
  const lastCol = sheet.getLastColumn();
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  if (headers.indexOf(colName) === -1) {
    sheet.getRange(1, lastCol + 1).setValue(colName)
      .setBackground('#1A5276').setFontColor('white').setFontWeight('bold');
  }
}

// ─── Sheet Setup (เรียกครั้งเดียวตอนติดตั้ง) ─────────────────

/**
 * สร้าง Sheet headers ทั้งหมด
 * เรียกครั้งเดียวหลังสร้าง Spreadsheet ใหม่
 */
function setupSheets() {
  const db = getDB();

  const schemas = {
    USERS: ['user_id','id_card','password_hash','title','first_name','last_name','role','department','email','phone','drive_folder_id','is_active','created_at','last_login','profile_url'],
    INNOVATIONS: ['innovation_id','title','type_code','department','grade_level','academic_year','semester','description','tags','teacher_id','teacher_name','file_urls','file_names','link_url','drive_folder_id','status','reject_reason','approved_by','approved_at','view_count','created_at','updated_at','cover_url'],
    AUDIT_LOG: ['log_id','user_id','action','target_type','target_id','detail','ip_address','timestamp'],
    CONFIG: ['config_key','config_value','description'],
  };

  Object.entries(schemas).forEach(([name, headers]) => {
    let sheet = db.getSheetByName(name);
    if (!sheet) {
      sheet = db.insertSheet(name);
    }
    if (sheet.getLastRow() === 0) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      sheet.getRange(1, 1, 1, headers.length)
        .setBackground('#1A5276')
        .setFontColor('white')
        .setFontWeight('bold');
    }
    Logger.log(`Sheet "${name}" ready.`);
  });

  // ใส่ default CONFIG rows
  const configSheet = db.getSheetByName('CONFIG');
  if (configSheet.getLastRow() <= 1) {
    const defaults = [
      ['school_name',           'โรงเรียนกระแชงวิทยา',              'ชื่อโรงเรียน'],
      ['school_logo_url',       '',                                    'URL โลโก้โรงเรียน'],
      ['primary_color',         '#1A5276',                             'สีหลักของระบบ'],
      ['secondary_color',       '#2E86C1',                             'สีรองของระบบ'],
      ['max_file_size_mb',      '100',                                 'ขนาดไฟล์สูงสุด (MB)'],
      ['allowed_file_types',    'pdf,doc,docx,xls,xlsx,ppt,pptx,mp4,jpg,png,gif', 'ประเภทไฟล์'],
      ['drive_root_folder_id',  CONFIG.DRIVE_ROOT_FOLDER_ID,          'Google Drive Root Folder ID'],
      ['admin_email',           CONFIG.ADMIN_EMAIL,                    'อีเมล Admin หลัก'],
      ['system_version',        CONFIG.SYSTEM_VERSION,                 'เวอร์ชันระบบ'],
      ['maintenance_mode',      'FALSE',                               'โหมดปิดปรับปรุง'],
    ];
    configSheet.getRange(2, 1, defaults.length, 3).setValues(defaults);
  }

  Logger.log('✅ Setup complete! Now run initSuperAdmin()');
}


// ─── Client-callable wrapper functions ──────────────────────
// google.script.run ต้องเรียก top-level function เท่านั้น
// ทุก function รับ data object ที่มี token แนบมาด้วย

function clientLogin(idCard, password) {
  return handleRequest({ action: 'login', id_card: idCard, password: password });
}
function clientLogout(token) {
  return handleRequest({ action: 'logout', token: token });
}
function clientGetCurrentUser(token) {
  return handleRequest({ action: 'getCurrentUser', token: token });
}
function clientChangePassword(data) {
  return handleRequest({ action: 'changePassword', ...data });
}
function clientGetInnovations(data) {
  return handleRequest({ action: 'getInnovations', ...data });
}
function clientGetInnovationById(data) {
  return handleRequest({ action: 'getInnovationById', ...data });
}
function clientGetPublicStats() {
  return handleRequest({ action: 'getPublicStats' });
}
function clientCreateInnovation(data) {
  return handleRequest({ action: 'createInnovation', ...data });
}
function clientUpdateInnovation(data) {
  return handleRequest({ action: 'updateInnovation', ...data });
}
function clientDeleteInnovation(data) {
  return handleRequest({ action: 'deleteInnovation', ...data });
}
function clientGetMyInnovations(data) {
  return handleRequest({ action: 'getMyInnovations', ...data });
}
function clientUploadFile(data) {
  return handleRequest({ action: 'uploadFile', ...data });
}
function clientCheckUrl(data) {
  return handleRequest({ action: 'checkUrl', ...data });
}
function clientApproveInnovation(data) {
  return handleRequest({ action: 'approveInnovation', ...data });
}
function clientRejectInnovation(data) {
  return handleRequest({ action: 'rejectInnovation', ...data });
}
function clientGetPendingList(data) {
  return handleRequest({ action: 'getPendingList', ...data });
}
function clientGetAllInnovations(data) {
  return handleRequest({ action: 'getAllInnovations', ...data });
}
function clientGetDashboardData(data) {
  return handleRequest({ action: 'getDashboardData', ...data });
}
function clientGetYearlyReport(data) {
  return handleRequest({ action: 'getYearlyReport', ...data });
}
function clientGetTeacherReport(data) {
  return handleRequest({ action: 'getTeacherReport', ...data });
}
function clientGetAuditLog(data) {
  return handleRequest({ action: 'getAuditLog', ...data });
}
function clientGetUsers(data) {
  return handleRequest({ action: 'getUsers', ...data });
}
function clientCreateUser(data) {
  return handleRequest({ action: 'createUser', ...data });
}
function clientUpdateUser(data) {
  return handleRequest({ action: 'updateUser', ...data });
}
function clientToggleUserActive(data) {
  return handleRequest({ action: 'toggleUserActive', ...data });
}
function clientGetConfig(token) {
  return handleRequest({ action: 'getConfig', token: token });
}
function clientUpdateConfig(data) {
  return handleRequest({ action: 'updateConfig', ...data });
}
function clientGetScriptUrl() {
  return ScriptApp.getService().getUrl();
}
