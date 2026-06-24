// ============================================================
// UserService.gs — User Management (CRUD)
// KIMS — โรงเรียนกระแชงวิทยา
// ============================================================

const UserService = {

  /** ดึงรายชื่อผู้ใช้ทั้งหมด (Admin) */
  getUsers: function(params) {
    try {
      requireRole(params, [ROLES.SUPERADMIN, ROLES.ADMIN]);
      const p = params || {};
      let rows = getAllRows(SHEET_NAMES.USERS);

      if (p.role) rows = rows.filter(r => r.role === p.role);
      if (p.department) rows = rows.filter(r => r.department === p.department);
      if (p.search) {
        const q = p.search.toLowerCase();
        rows = rows.filter(r =>
          (r.first_name || '').toLowerCase().includes(q) ||
          (r.last_name || '').toLowerCase().includes(q) ||
          (r.email || '').toLowerCase().includes(q)
        );
      }

      rows.sort((a, b) => (a.first_name || '').localeCompare(b.first_name || '', 'th'));

      return successResponse({
        users: rows.map(r => this.formatUser(r)),
        total: rows.length,
      });
    } catch (e) {
      return errorResponse(e.message);
    }
  },

  /** สร้างผู้ใช้ใหม่ */
  createUser: function(data) {
    try {
      const session = requireRole(data, [ROLES.SUPERADMIN, ROLES.ADMIN]);

      // Validate required fields
      const required = ['id_card', 'password', 'title', 'first_name', 'last_name', 'role', 'email'];
      for (const field of required) {
        if (!data[field]) return errorResponse(`กรุณากรอก ${field}`);
      }

      if (!validateIdCard(data.id_card)) {
        return errorResponse('เลขประจำตัวประชาชนไม่ถูกต้อง');
      }

      // Check duplicate
      const existing = AuthService.findUserByIdCard(data.id_card);
      if (existing) return errorResponse('เลขประจำตัวประชาชนนี้มีในระบบแล้ว');

      // Super Admin สร้างได้ทุก role; Admin สร้างได้แค่ HEAD, TEACHER
      if (session.role === ROLES.ADMIN && [ROLES.SUPERADMIN, ROLES.ADMIN].includes(data.role)) {
        return errorResponse('คุณไม่มีสิทธิ์สร้างผู้ใช้ระดับนี้');
      }

      const userId = generateUserId();
      const fullName = `${data.title}${data.first_name} ${data.last_name}`;

      // สร้าง Drive folder
      const folderResult = DriveService.createUserFolder(fullName, getCurrentThaiYear());

      const user = {
        user_id: userId,
        id_card: data.id_card,
        password_hash: hashPassword(data.password),
        title: sanitize(data.title),
        first_name: sanitize(data.first_name),
        last_name: sanitize(data.last_name),
        role: data.role,
        department: data.department || '',
        email: sanitize(data.email),
        phone: sanitize(data.phone || ''),
        drive_folder_id: folderResult ? folderResult.folderId : '',
        is_active: 'TRUE',
        created_at: now(),
        last_login: '',
      };

      appendRow(SHEET_NAMES.USERS, user);
      writeAuditLog(session.user_id, AUDIT_ACTIONS.CREATE, 'USER', userId, {
        name: fullName,
        role: data.role,
      });

      // แจ้งเตือนครูใหม่
      try { EmailService.notifyNewUser(user, data.password); } catch(_e) { Logger.log('email skip: ' + _e.message); }

      return successResponse({ user_id: userId }, `สร้างบัญชีผู้ใช้ ${fullName} เรียบร้อยแล้ว`);
    } catch (e) {
      Logger.log('createUser error: ' + e.message);
      return errorResponse(e.message);
    }
  },

  /** แก้ไขข้อมูลผู้ใช้ */
  updateUser: function(data) {
    try {
      const session = requireRole(data, [ROLES.SUPERADMIN, ROLES.ADMIN]);
      const userId = data.user_id;
      if (!userId) return errorResponse('ไม่ระบุ user_id');

      const rows = getAllRows(SHEET_NAMES.USERS);
      const user = rows.find(r => r.user_id === userId);
      if (!user) return errorResponse('ไม่พบผู้ใช้ที่ระบุ');

      // Admin ไม่สามารถแก้ SuperAdmin ได้
      if (session.role === ROLES.ADMIN && user.role === ROLES.SUPERADMIN) {
        return errorResponse('ไม่มีสิทธิ์แก้ไขผู้ดูแลระบบสูงสุด');
      }

      const updateData = {};
      if (data.title) updateData.title = sanitize(data.title);
      if (data.first_name) updateData.first_name = sanitize(data.first_name);
      if (data.last_name) updateData.last_name = sanitize(data.last_name);
      if (data.department !== undefined) updateData.department = data.department;
      if (data.email) updateData.email = sanitize(data.email);
      if (data.phone !== undefined) updateData.phone = sanitize(data.phone);
      if (data.is_active !== undefined) updateData.is_active = data.is_active ? 'TRUE' : 'FALSE';
      if (data.role && session.role === ROLES.SUPERADMIN) updateData.role = data.role;
      if (data.new_password) {
        if (data.new_password.length < 6) return errorResponse('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร');
        updateData.password_hash = hashPassword(data.new_password);
      }

      updateRowByKey(SHEET_NAMES.USERS, 'user_id', userId, updateData);
      writeAuditLog(session.user_id, AUDIT_ACTIONS.UPDATE, 'USER', userId, updateData);

      return successResponse({ user_id: userId }, 'แก้ไขข้อมูลผู้ใช้เรียบร้อยแล้ว');
    } catch (e) {
      return errorResponse(e.message);
    }
  },

  /** ปิด/เปิดการใช้งานบัญชี (Soft delete) */
  toggleUserActive: function(data) {
    try {
      const session = requireRole(data, [ROLES.SUPERADMIN, ROLES.ADMIN]);
      const { user_id, is_active } = data;
      if (!user_id) return errorResponse('ไม่ระบุ user_id');

      updateRowByKey(SHEET_NAMES.USERS, 'user_id', user_id, {
        is_active: is_active ? 'TRUE' : 'FALSE',
      });

      writeAuditLog(session.user_id, AUDIT_ACTIONS.UPDATE, 'USER', user_id, {
        is_active: is_active,
      });

      return successResponse(null, is_active ? 'เปิดการใช้งานบัญชีแล้ว' : 'ระงับการใช้งานบัญชีแล้ว');
    } catch (e) {
      return errorResponse(e.message);
    }
  },

  /**
   * นำเข้าผู้ใช้จำนวนมาก (CSV)
   * data: { users: [{id_card, password?, title, first_name, last_name, role, department?, email, phone?}], default_password? }
   * คืนผลรวม: { created, failed, errors:[{row, id_card, reason}] }
   */
  bulkImportUsers: function(data) {
    try {
      const session = requireRole(data, [ROLES.SUPERADMIN, ROLES.ADMIN]);
      const rows = Array.isArray(data.users) ? data.users : [];
      if (!rows.length) return errorResponse('ไม่พบข้อมูลผู้ใช้ในไฟล์');
      if (rows.length > 500) return errorResponse('นำเข้าได้ครั้งละไม่เกิน 500 รายการ');

      const defaultPw = String(data.default_password || 'Kcw@2568');
      const year = getCurrentThaiYear();

      // โหลด id_card ที่มีอยู่แล้วครั้งเดียว (กันซ้ำ + เร็ว)
      const existing = getAllRows(SHEET_NAMES.USERS);
      const existingIds = {};
      existing.forEach(u => { existingIds[String(u.id_card).replace(/\D/g, '')] = true; });

      let created = 0;
      const errors = [];
      const seenInFile = {};

      rows.forEach((raw, idx) => {
        const rowNo = idx + 1;
        try {
          const u = {
            id_card:    String(raw.id_card || '').replace(/\D/g, ''),
            password:   String(raw.password || defaultPw),
            title:      sanitize(String(raw.title || '')),
            first_name: sanitize(String(raw.first_name || '')),
            last_name:  sanitize(String(raw.last_name || '')),
            role:       String(raw.role || 'TEACHER').toUpperCase().trim(),
            department: String(raw.department || ''),
            email:      sanitize(String(raw.email || '')),
            phone:      sanitize(String(raw.phone || '')),
          };

          // Validate
          if (!u.first_name || !u.last_name) throw new Error('ไม่มีชื่อ/นามสกุล');
          if (!u.email) throw new Error('ไม่มีอีเมล');
          if (!validateIdCard(u.id_card)) throw new Error('เลขบัตรประชาชนไม่ถูกต้อง');
          if (!ROLES[u.role]) throw new Error('บทบาทไม่ถูกต้อง (' + u.role + ')');
          if (existingIds[u.id_card] || seenInFile[u.id_card]) throw new Error('เลขบัตรซ้ำ');
          if (u.password.length < 6) throw new Error('รหัสผ่านสั้นเกินไป');

          // Admin สร้าง ADMIN/SUPERADMIN ไม่ได้
          if (session.role === ROLES.ADMIN && [ROLES.SUPERADMIN, ROLES.ADMIN].includes(u.role)) {
            throw new Error('ไม่มีสิทธิ์สร้างผู้ใช้ระดับนี้');
          }
          if (!u.title) u.title = (u.role === ROLES.TEACHER || u.role === ROLES.HEAD) ? 'นาย' : 'นาย';

          const userId = generateUserId();
          const fullName = `${u.title}${u.first_name} ${u.last_name}`;

          let folderId = '';
          try {
            const fr = DriveService.createUserFolder(fullName, year);
            folderId = fr ? fr.folderId : '';
          } catch (_e) { /* folder ล้มเหลวไม่ block การสร้าง user */ }

          appendRow(SHEET_NAMES.USERS, {
            user_id: userId,
            id_card: u.id_card,
            password_hash: hashPassword(u.password),
            title: u.title,
            first_name: u.first_name,
            last_name: u.last_name,
            role: u.role,
            department: u.department,
            email: u.email,
            phone: u.phone,
            drive_folder_id: folderId,
            is_active: 'TRUE',
            created_at: now(),
            last_login: '',
          });

          existingIds[u.id_card] = true;
          seenInFile[u.id_card] = true;
          created++;
        } catch (rowErr) {
          errors.push({ row: rowNo, id_card: String(raw.id_card || ''), reason: rowErr.message });
        }
      });

      writeAuditLog(session.user_id, 'BULK_IMPORT', 'USER', '', { created: created, failed: errors.length });

      return successResponse(
        { created: created, failed: errors.length, errors: errors },
        `นำเข้าสำเร็จ ${created} รายการ` + (errors.length ? ` / ไม่สำเร็จ ${errors.length} รายการ` : '')
      );
    } catch (e) {
      Logger.log('bulkImportUsers error: ' + e.message);
      return errorResponse(e.message);
    }
  },

  /** แก้ไขโปรไฟล์ตนเอง (ทุก role) — ชื่อ/เบอร์/อีเมล/รูปโปรไฟล์ */
  updateProfile: function(data) {
    try {
      const session = this.requireAuthAny(data);
      const updateData = {};
      if (data.title)      updateData.title = sanitize(data.title);
      if (data.first_name) updateData.first_name = sanitize(data.first_name);
      if (data.last_name)  updateData.last_name = sanitize(data.last_name);
      if (data.phone !== undefined)  updateData.phone = sanitize(data.phone);
      if (data.email)      updateData.email = sanitize(data.email);
      if (data.profile_url !== undefined) updateData.profile_url = data.profile_url;

      updateRowByKey(SHEET_NAMES.USERS, 'user_id', session.user_id, updateData);
      writeAuditLog(session.user_id, AUDIT_ACTIONS.UPDATE, 'USER', session.user_id, { profile: true });

      // คืนข้อมูลโปรไฟล์ล่าสุด
      const user = getAllRows(SHEET_NAMES.USERS).find(r => r.user_id === session.user_id);
      return successResponse(this.formatUser(user), 'บันทึกโปรไฟล์เรียบร้อยแล้ว');
    } catch (e) {
      return errorResponse(e.message);
    }
  },

  requireAuthAny: function(data) {
    const token = String(data && data.token ? data.token : '');
    const session = AuthService.getSessionByToken(token);
    if (!session) throw new Error('กรุณาเข้าสู่ระบบก่อน');
    return session;
  },

  /** ลบผู้ใช้ถาวร (ADMIN+) — ลบ SuperAdmin/ตัวเองไม่ได้ */
  deleteUser: function(data) {
    try {
      const session = requireRole(data, [ROLES.SUPERADMIN, ROLES.ADMIN]);
      const userId = data.user_id;
      if (!userId) return errorResponse('ไม่ระบุ user_id');
      if (userId === session.user_id) return errorResponse('ไม่สามารถลบบัญชีของตนเองได้');

      const user = getAllRows(SHEET_NAMES.USERS).find(r => r.user_id === userId);
      if (!user) return errorResponse('ไม่พบผู้ใช้ที่ระบุ');
      if (user.role === ROLES.SUPERADMIN) return errorResponse('ไม่สามารถลบผู้ดูแลระบบสูงสุดได้');
      if (session.role === ROLES.ADMIN && [ROLES.SUPERADMIN, ROLES.ADMIN].includes(user.role)) {
        return errorResponse('คุณไม่มีสิทธิ์ลบผู้ใช้ระดับนี้');
      }

      deleteRowByKey(SHEET_NAMES.USERS, 'user_id', userId);
      writeAuditLog(session.user_id, AUDIT_ACTIONS.DELETE, 'USER', userId, { name: user.first_name + ' ' + user.last_name });
      return successResponse(null, 'ลบผู้ใช้เรียบร้อยแล้ว');
    } catch (e) {
      return errorResponse(e.message);
    }
  },

  /** Format user สำหรับ Frontend (ไม่ส่ง password_hash) */
  formatUser: function(user) {
    return {
      user_id: user.user_id,
      id_card: String(user.id_card || '').replace(/(\d{1})(\d{4})(\d{5})(\d{2})(\d{1})/, '$1-$2-$3-$4-$5'),
      title: user.title,
      first_name: user.first_name,
      last_name: user.last_name,
      full_name: `${user.title}${user.first_name} ${user.last_name}`,
      role: user.role,
      role_label: getRoleLabel(user.role),
      department: user.department,
      email: user.email,
      phone: user.phone,
      profile_url: user.profile_url || '',
      is_active: String(user.is_active) === 'TRUE',
      created_at: user.created_at,
      last_login: user.last_login,
    };
  },
};
