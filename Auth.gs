// ============================================================
// Auth.gs — Authentication & Session Management
// KIMS — โรงเรียนกระแชงวิทยา
// ============================================================
//
// ⚠️ GAS Web App "Execute as: Me" + "Access: Anyone":
//    - PropertiesService.getUserProperties() ≠ per-browser-user
//    - ต้องใช้ ScriptProperties เก็บ token map แทน
//    - Token ส่งผ่าน Cookie-like header ไม่ได้ใน GAS
//    - วิธีที่ใช้งานได้จริง: เก็บ session token ใน ScriptProperties
//      และส่ง token กลับไปเก็บใน sessionStorage ฝั่ง browser
//      จากนั้นทุก API call ส่ง token มาด้วย
// ============================================================

const AuthService = {

  // ─── Login ─────────────────────────────────────────────────

  login: function(data) {
    try {
      const idCard  = String(data.id_card  || '').replace(/\D/g, '').trim();
      const password = String(data.password || '');

      if (!idCard || idCard.length !== 13) {
        return errorResponse('เลขประจำตัวประชาชนไม่ถูกต้อง');
      }

      const user = this.findUserByIdCard(idCard);
      if (!user) return errorResponse('ไม่พบผู้ใช้งานในระบบ');

      if (String(user.is_active).toUpperCase() !== 'TRUE') {
        return errorResponse('บัญชีผู้ใช้งานถูกระงับ กรุณาติดต่อผู้ดูแลระบบ');
      }

      const hashedInput = hashPassword(password);
      if (hashedInput !== user.password_hash) {
        return errorResponse('รหัสผ่านไม่ถูกต้อง');
      }

      // สร้าง session token และเก็บใน ScriptProperties
      const token = this.createSession({
        user_id:        user.user_id,
        id_card:        user.id_card,
        role:           user.role,
        name:           user.first_name,
        full_name:      (user.title || '') + user.first_name + ' ' + user.last_name,
        department:     user.department,
        email:          user.email,
        drive_folder_id: user.drive_folder_id || '',
      });

      // Update last login
      updateRowByKey(SHEET_NAMES.USERS, 'user_id', user.user_id, { last_login: now() });
      writeAuditLog(user.user_id, AUDIT_ACTIONS.LOGIN, 'USER', user.user_id, { id_card: idCard });

      return successResponse({
        token:      token,
        user_id:    user.user_id,
        full_name:  (user.title || '') + user.first_name + ' ' + user.last_name,
        role:       user.role,
        department: user.department,
      }, 'เข้าสู่ระบบสำเร็จ');

    } catch (e) {
      Logger.log('Login error: ' + e.message);
      return errorResponse('เกิดข้อผิดพลาดในระบบ: ' + e.message);
    }
  },

  // ─── Logout ────────────────────────────────────────────────

  logout: function(data) {
    try {
      const token = String(data && data.token ? data.token : '');
      const session = this.getSessionByToken(token);
      if (session) {
        writeAuditLog(session.user_id, AUDIT_ACTIONS.LOGOUT, 'USER', session.user_id, {});
        this.clearSession(token);
      }
      return successResponse(null, 'ออกจากระบบสำเร็จ');
    } catch (e) {
      return errorResponse(e.message);
    }
  },

  // ─── Session (ScriptProperties-based) ──────────────────────

  createSession: function(userData) {
    const token = generateUUID();
    const sessionData = {
      ...userData,
      token:   token,
      expires: Date.now() + (CONFIG.SESSION_HOURS * 60 * 60 * 1000),
    };
    const props = PropertiesService.getScriptProperties();

    // ล้าง session เก่าของ user นี้ก่อน
    this._cleanupUserSessions(props, userData.user_id);

    props.setProperty('KIMS_TOKEN_' + token, JSON.stringify(sessionData));
    return token;
  },

  getSessionByToken: function(token) {
    if (!token) return null;
    try {
      const props = PropertiesService.getScriptProperties();
      const raw   = props.getProperty('KIMS_TOKEN_' + token);
      if (!raw) return null;
      const session = JSON.parse(raw);
      if (Date.now() > session.expires) {
        this.clearSession(token);
        return null;
      }
      return session;
    } catch (e) {
      return null;
    }
  },

  clearSession: function(token) {
    if (!token) return;
    const props = PropertiesService.getScriptProperties();
    props.deleteProperty('KIMS_TOKEN_' + token);
  },

  // ล้าง session เก่าของ user (ป้องกัน ScriptProperties เต็ม)
  _cleanupUserSessions: function(props, userId) {
    try {
      const all = props.getProperties();
      Object.keys(all).forEach(function(k) {
        if (k.indexOf('KIMS_TOKEN_') === 0) {
          try {
            const s = JSON.parse(all[k]);
            if (s.user_id === userId || Date.now() > s.expires) {
              props.deleteProperty(k);
            }
          } catch(e) {}
        }
      });
    } catch(e) {}
  },

  // ─── Role helpers ───────────────────────────────────────────

  requireAuth: function(data) {
    const token   = String(data && data.token ? data.token : '');
    const session = this.getSessionByToken(token);
    if (!session) throw new Error('กรุณาเข้าสู่ระบบก่อน');
    return session;
  },

  requireRole: function(data, allowedRoles) {
    const session = this.requireAuth(data);
    if (!allowedRoles.includes(session.role)) throw new Error('คุณไม่มีสิทธิ์ดำเนินการนี้');
    return session;
  },

  // ─── getCurrentUser ─────────────────────────────────────────

  getCurrentUser: function(data) {
    const token   = String(data && data.token ? data.token : '');
    const session = this.getSessionByToken(token);
    if (!session) return errorResponse('ไม่ได้เข้าสู่ระบบ', 401);
    const user = getAllRows(SHEET_NAMES.USERS).find(function(r){ return r.user_id === session.user_id; });
    return successResponse({
      user_id:    session.user_id,
      full_name:  session.full_name,
      title:      user ? user.title : '',
      first_name: user ? user.first_name : '',
      last_name:  user ? user.last_name : '',
      role:       session.role,
      department: session.department,
      email:      user ? user.email : session.email,
      phone:      user ? user.phone : '',
      profile_url: user ? (user.profile_url || '') : '',
    });
  },

  // ─── findUserByIdCard ───────────────────────────────────────

  findUserByIdCard: function(idCard) {
    const rows = getAllRows(SHEET_NAMES.USERS);
    return rows.find(function(row) {
      return String(row.id_card).replace(/\D/g,'') === String(idCard).replace(/\D/g,'');
    }) || null;
  },

  // ─── initSuperAdmin ─────────────────────────────────────────

  initSuperAdmin: function() {
    const existing = this.findUserByIdCard('1000000000001');
    if (existing) { Logger.log('Super Admin already exists'); return; }

    appendRow(SHEET_NAMES.USERS, {
      user_id:       'USR-SUPERADMIN-001',
      id_card:       '1000000000001',
      password_hash: hashPassword('Admin@2568'),
      title:         'นาย',
      first_name:    'ผู้ดูแล',
      last_name:     'ระบบ',
      role:          ROLES.SUPERADMIN,
      department:    '',
      email:         CONFIG.ADMIN_EMAIL,
      phone:         '',
      drive_folder_id: '',
      is_active:     'TRUE',
      created_at:    now(),
      last_login:    '',
    });
    Logger.log('✅ Super Admin created. ID: 1000000000001 / Password: Admin@2568');
  },

  // ─── changePassword ─────────────────────────────────────────

  changePassword: function(data) {
    try {
      const session = this.requireAuth(data);
      const { old_password, new_password } = data;

      if (!old_password || !new_password) return errorResponse('กรุณาระบุรหัสผ่านเก่าและใหม่');
      if (new_password.length < 6)         return errorResponse('รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร');

      const user = getAllRows(SHEET_NAMES.USERS).find(function(r) { return r.user_id === session.user_id; });
      if (!user) return errorResponse('ไม่พบข้อมูลผู้ใช้');
      if (hashPassword(old_password) !== user.password_hash) return errorResponse('รหัสผ่านเก่าไม่ถูกต้อง');

      updateRowByKey(SHEET_NAMES.USERS, 'user_id', session.user_id, {
        password_hash: hashPassword(new_password),
      });
      writeAuditLog(session.user_id, 'CHANGE_PASSWORD', 'USER', session.user_id, {});
      return successResponse(null, 'เปลี่ยนรหัสผ่านสำเร็จ');

    } catch (e) { return errorResponse(e.message); }
  },
};

// ─── Global helpers ──────────────────────────────────────────
// ใช้ในทุก Service: requireRole(data, roles) — data ต้องมี token
function getSession() { return null; } // deprecated — ใช้ AuthService.getSessionByToken แทน
function requireRole(data, allowedRoles) {
  // รองรับทั้ง requireRole(data, roles) และ requireRole(roles) รูปแบบเก่า
  if (Array.isArray(data)) {
    // เรียกแบบเก่า requireRole([roles]) — ไม่มี token → throw
    throw new Error('กรุณาเข้าสู่ระบบก่อน (session expired)');
  }
  return AuthService.requireRole(data, allowedRoles);
}
function initSuperAdmin() { AuthService.initSuperAdmin(); }
