// ============================================================
// InnovationService.gs — Innovation CRUD & Workflow
// KIMS — โรงเรียนกระแชงวิทยา
// ============================================================

const InnovationService = {

  // ─── Public: ดูนวัตกรรม ──────────────────────────────────────

  /**
   * ดึงรายการนวัตกรรม (Public — เฉพาะ Published)
   * params: { page, limit, search, type_code, department, academic_year, teacher_name }
   */
  getInnovations: function(params) {
    try {
      const p = params || {};
      const page = parseInt(p.page) || 1;
      const limit = parseInt(p.limit) || 12;

      let rows = getAllRows(SHEET_NAMES.INNOVATIONS)
        .filter(r => r.status === STATUS.PUBLISHED);

      // Filters
      if (p.search) {
        const q = p.search.toLowerCase();
        rows = rows.filter(r =>
          (r.title || '').toLowerCase().includes(q) ||
          (r.description || '').toLowerCase().includes(q) ||
          (r.teacher_name || '').toLowerCase().includes(q) ||
          (r.tags || '').toLowerCase().includes(q)
        );
      }
      if (p.type_code) rows = rows.filter(r => normTypeCode(r.type_code) === normTypeCode(p.type_code));
      if (p.department) rows = rows.filter(r => r.department === p.department);
      if (p.grade_level) rows = rows.filter(r => jsonToArray(r.grade_level).indexOf(p.grade_level) >= 0);
      if (p.academic_year) rows = rows.filter(r => String(r.academic_year) === String(p.academic_year));
      if (p.teacher_name) rows = rows.filter(r => (r.teacher_name || '').includes(p.teacher_name));

      // Sort by created_at desc
      rows.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

      const total = rows.length;
      const totalPages = Math.ceil(total / limit);
      const start = (page - 1) * limit;
      const paged = this.attachTeacherProfiles(rows.slice(start, start + limit).map(r => this.formatPublicCard(r)));

      return successResponse({
        innovations: paged,
        pagination: { page, limit, total, totalPages },
      });
    } catch (e) {
      Logger.log('getInnovations error: ' + e.message);
      return errorResponse(e.message);
    }
  },

  /**
   * ดึงรายละเอียดนวัตกรรม (Public) + เพิ่ม view count
   */
  getInnovationById: function(params) {
    try {
      const id = params.innovation_id;
      if (!id) return errorResponse('ไม่ระบุ ID นวัตกรรม');

      const rows = getAllRows(SHEET_NAMES.INNOVATIONS);
      const item = rows.find(r => r.innovation_id === id);
      if (!item) return errorResponse('ไม่พบนวัตกรรมที่ระบุ');

      // ถ้า Guest ต้องเป็น Published เท่านั้น
      const session = AuthService.getSessionByToken(params && params.token ? params.token : '');
      if (!session && item.status !== STATUS.PUBLISHED) {
        return errorResponse('นวัตกรรมนี้ไม่ได้เผยแพร่สาธารณะ');
      }

      // Increment view count
      if (item.status === STATUS.PUBLISHED) {
        const newCount = parseInt(item.view_count || 0) + 1;
        updateRowByKey(SHEET_NAMES.INNOVATIONS, 'innovation_id', id, {
          view_count: newCount,
        });
        item.view_count = newCount;
      }

      const detail = this.formatDetail(item);
      this.attachTeacherProfiles([detail]);
      return successResponse(detail);
    } catch (e) {
      Logger.log('getInnovationById error: ' + e.message);
      return errorResponse(e.message);
    }
  },

  // ─── Teacher: อัปโหลดนวัตกรรม ────────────────────────────────

  /**
   * สร้างนวัตกรรมใหม่
   */
  create: function(data) {
    try {
      const session = requireRole(data, [ROLES.SUPERADMIN, ROLES.ADMIN, ROLES.HEAD, ROLES.TEACHER]);

      // Validate required fields
      const required = ['title', 'type_code', 'department', 'grade_level', 'academic_year', 'semester', 'description'];
      for (const field of required) {
        if (!data[field] || (Array.isArray(data[field]) && data[field].length === 0)) {
          return errorResponse(`กรุณากรอก ${field}`);
        }
      }

      // ต้องมีไฟล์หรือ link อย่างใดอย่างหนึ่ง
      const hasFiles = data.file_urls && jsonToArray(data.file_urls).length > 0;
      const hasLink = data.link_url && validateUrl(data.link_url);
      if (!hasFiles && !hasLink) {
        return errorResponse('กรุณาแนบไฟล์ หรือระบุ Link URL อย่างน้อย 1 รายการ');
      }

      // Validate link URL ถ้ามี
      if (data.link_url && !validateUrl(data.link_url)) {
        return errorResponse('Link URL ไม่ถูกต้อง ต้องขึ้นต้นด้วย https://');
      }

      const innovationId = generateInnovationId();
      const innovation = {
        innovation_id: innovationId,
        title: sanitize(data.title).substring(0, 200),
        type_code: data.type_code,
        department: data.department,
        grade_level: arrayToJson(Array.isArray(data.grade_level) ? data.grade_level : [data.grade_level]),
        academic_year: parseInt(data.academic_year),
        semester: parseInt(data.semester),
        description: sanitize(data.description).substring(0, 2000),
        tags: (data.tags || '').substring(0, 500),
        teacher_id: session.user_id,
        teacher_name: session.full_name,
        file_urls: data.file_urls || '[]',
        file_names: data.file_names || '[]',
        link_url: data.link_url || '',
        cover_url: data.cover_url || '',
        drive_folder_id: data.drive_folder_id || '',
        status: STATUS.PENDING,
        reject_reason: '',
        approved_by: '',
        approved_at: '',
        view_count: 0,
        created_at: now(),
        updated_at: now(),
      };

      appendRow(SHEET_NAMES.INNOVATIONS, innovation);
      writeAuditLog(session.user_id, AUDIT_ACTIONS.CREATE, 'INNOVATION', innovationId, {
        title: innovation.title,
      });

      // แจ้งเตือน Admin
      try { EmailService.notifyAdminNewInnovation(innovation, session); } catch(_e) { Logger.log('email skip: ' + _e.message); }

      return successResponse({ innovation_id: innovationId }, 'ส่งนวัตกรรมเรียบร้อยแล้ว รอการอนุมัติจากผู้ดูแลระบบ');
    } catch (e) {
      Logger.log('createInnovation error: ' + e.message);
      return errorResponse(e.message);
    }
  },

  /**
   * แก้ไขนวัตกรรม (เฉพาะ DRAFT หรือ REJECTED เท่านั้น)
   */
  update: function(data) {
    try {
      const session = requireRole(data, [ROLES.SUPERADMIN, ROLES.ADMIN, ROLES.HEAD, ROLES.TEACHER]);
      const id = data.innovation_id;
      if (!id) return errorResponse('ไม่ระบุ ID นวัตกรรม');

      const rows = getAllRows(SHEET_NAMES.INNOVATIONS);
      const item = rows.find(r => r.innovation_id === id);
      if (!item) return errorResponse('ไม่พบนวัตกรรมที่ระบุ');

      // ครูแก้ได้เฉพาะงานตัวเองที่ DRAFT/REJECTED
      if (session.role === ROLES.TEACHER || session.role === ROLES.HEAD) {
        if (item.teacher_id !== session.user_id) {
          return errorResponse('คุณไม่มีสิทธิ์แก้ไขนวัตกรรมนี้');
        }
        if (![STATUS.DRAFT, STATUS.REJECTED].includes(item.status)) {
          return errorResponse('ไม่สามารถแก้ไขนวัตกรรมที่อยู่ในสถานะนี้ได้');
        }
      }

      const updateData = {
        title: sanitize(data.title || item.title).substring(0, 200),
        type_code: data.type_code || item.type_code,
        department: data.department || item.department,
        grade_level: data.grade_level ? arrayToJson(Array.isArray(data.grade_level) ? data.grade_level : [data.grade_level]) : item.grade_level,
        academic_year: data.academic_year ? parseInt(data.academic_year) : item.academic_year,
        semester: data.semester ? parseInt(data.semester) : item.semester,
        description: sanitize(data.description || item.description).substring(0, 2000),
        tags: (data.tags !== undefined ? data.tags : item.tags).substring(0, 500),
        link_url: data.link_url || item.link_url,
        cover_url: data.cover_url !== undefined ? data.cover_url : (item.cover_url || ''),
        status: STATUS.PENDING,  // ส่งใหม่ → กลับไปรอ Approve
        reject_reason: '',
        updated_at: now(),
      };

      if (data.file_urls !== undefined) {
        updateData.file_urls = data.file_urls;
        updateData.file_names = data.file_names || item.file_names;
      }

      updateRowByKey(SHEET_NAMES.INNOVATIONS, 'innovation_id', id, updateData);
      writeAuditLog(session.user_id, AUDIT_ACTIONS.UPDATE, 'INNOVATION', id, { title: updateData.title });

      // แจ้ง Admin ว่ามีการส่งใหม่
      try { EmailService.notifyAdminResubmit({ ...item, ...updateData }, session); } catch(_e) { Logger.log('email skip: ' + _e.message); }

      return successResponse({ innovation_id: id }, 'แก้ไขนวัตกรรมเรียบร้อยแล้ว รอการอนุมัติอีกครั้ง');
    } catch (e) {
      Logger.log('updateInnovation error: ' + e.message);
      return errorResponse(e.message);
    }
  },

  /**
   * ลบนวัตกรรม
   */
  delete: function(data) {
    try {
      const session = requireRole(data, [ROLES.SUPERADMIN, ROLES.ADMIN, ROLES.HEAD, ROLES.TEACHER]);
      const id = data.innovation_id;
      if (!id) return errorResponse('ไม่ระบุ ID นวัตกรรม');

      const rows = getAllRows(SHEET_NAMES.INNOVATIONS);
      const item = rows.find(r => r.innovation_id === id);
      if (!item) return errorResponse('ไม่พบนวัตกรรมที่ระบุ');

      // ครูลบได้เฉพาะของตัวเอง และ DRAFT/REJECTED เท่านั้น
      if (session.role === ROLES.TEACHER) {
        if (item.teacher_id !== session.user_id) {
          return errorResponse('คุณไม่มีสิทธิ์ลบนวัตกรรมนี้');
        }
        if (![STATUS.DRAFT, STATUS.REJECTED].includes(item.status)) {
          return errorResponse('ไม่สามารถลบนวัตกรรมที่อยู่ในสถานะนี้');
        }
      }

      // ลบไฟล์ใน Drive
      const fileUrls = jsonToArray(item.file_urls || '[]');
      // ไม่ delete file จาก Drive โดยตรง — ใช้ Trash แทน (ป้องกัน accident)

      deleteRowByKey(SHEET_NAMES.INNOVATIONS, 'innovation_id', id);
      writeAuditLog(session.user_id, AUDIT_ACTIONS.DELETE, 'INNOVATION', id, { title: item.title });

      return successResponse(null, 'ลบนวัตกรรมเรียบร้อยแล้ว');
    } catch (e) {
      Logger.log('deleteInnovation error: ' + e.message);
      return errorResponse(e.message);
    }
  },

  // ─── Admin: อนุมัติ/ปฏิเสธ ───────────────────────────────────

  /**
   * อนุมัตินวัตกรรม
   */
  approve: function(data) {
    try {
      const session = requireRole(data, [ROLES.SUPERADMIN, ROLES.ADMIN]);
      const id = data.innovation_id;
      if (!id) return errorResponse('ไม่ระบุ ID นวัตกรรม');

      const rows = getAllRows(SHEET_NAMES.INNOVATIONS);
      const item = rows.find(r => r.innovation_id === id);
      if (!item) return errorResponse('ไม่พบนวัตกรรมที่ระบุ');
      if (item.status !== STATUS.PENDING) return errorResponse('นวัตกรรมนี้ไม่ได้อยู่ในสถานะรออนุมัติ');

      updateRowByKey(SHEET_NAMES.INNOVATIONS, 'innovation_id', id, {
        status: STATUS.PUBLISHED,
        approved_by: session.user_id,
        approved_at: now(),
        reject_reason: '',
        updated_at: now(),
      });

      writeAuditLog(session.user_id, AUDIT_ACTIONS.APPROVE, 'INNOVATION', id, { title: item.title });

      // แจ้งครู
      try { EmailService.notifyTeacherApproved(item, session); } catch(_e) { Logger.log('email skip: ' + _e.message); }

      return successResponse({ innovation_id: id }, 'อนุมัตินวัตกรรมเรียบร้อยแล้ว');
    } catch (e) {
      Logger.log('approveInnovation error: ' + e.message);
      return errorResponse(e.message);
    }
  },

  /**
   * ปฏิเสธนวัตกรรม
   */
  reject: function(data) {
    try {
      const session = requireRole(data, [ROLES.SUPERADMIN, ROLES.ADMIN]);
      const id = data.innovation_id;
      const reason = sanitize(data.reason || '').substring(0, 500);
      if (!id) return errorResponse('ไม่ระบุ ID นวัตกรรม');
      if (!reason) return errorResponse('กรุณาระบุเหตุผลในการปฏิเสธ');

      const rows = getAllRows(SHEET_NAMES.INNOVATIONS);
      const item = rows.find(r => r.innovation_id === id);
      if (!item) return errorResponse('ไม่พบนวัตกรรมที่ระบุ');
      if (item.status !== STATUS.PENDING) return errorResponse('นวัตกรรมนี้ไม่ได้อยู่ในสถานะรออนุมัติ');

      updateRowByKey(SHEET_NAMES.INNOVATIONS, 'innovation_id', id, {
        status: STATUS.REJECTED,
        reject_reason: reason,
        approved_by: session.user_id,
        approved_at: now(),
        updated_at: now(),
      });

      writeAuditLog(session.user_id, AUDIT_ACTIONS.REJECT, 'INNOVATION', id, {
        title: item.title,
        reason: reason,
      });

      // แจ้งครูพร้อมเหตุผล
      try { EmailService.notifyTeacherRejected(item, session, reason); } catch(_e) { Logger.log('email skip: ' + _e.message); }

      return successResponse({ innovation_id: id }, 'ปฏิเสธนวัตกรรมเรียบร้อยแล้ว');
    } catch (e) {
      Logger.log('rejectInnovation error: ' + e.message);
      return errorResponse(e.message);
    }
  },

  /**
   * ดึงรายการรออนุมัติ (Admin)
   */
  getPendingList: function(params) {
    try {
      requireRole(params, [ROLES.SUPERADMIN, ROLES.ADMIN]);
      const rows = getAllRows(SHEET_NAMES.INNOVATIONS)
        .filter(r => r.status === STATUS.PENDING)
        .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
        .map(r => this.formatAdminCard(r));

      return successResponse({ innovations: rows, total: rows.length });
    } catch (e) {
      return errorResponse(e.message);
    }
  },

  /**
   * ดึงนวัตกรรมของครูที่ล็อกอินอยู่
   */
  getMyInnovations: function(params) {
    try {
      const session = requireRole(params, [ROLES.SUPERADMIN, ROLES.ADMIN, ROLES.HEAD, ROLES.TEACHER]);
      let rows = getAllRows(SHEET_NAMES.INNOVATIONS)
        .filter(r => r.teacher_id === session.user_id)
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

      return successResponse({
        innovations: rows.map(r => this.formatAdminCard(r)),
        total: rows.length,
      });
    } catch (e) {
      return errorResponse(e.message);
    }
  },

  /**
   * ดึงนวัตกรรมทั้งหมด (Admin)
   */
  getAllInnovations: function(params) {
    try {
      const session = requireRole(params, [ROLES.SUPERADMIN, ROLES.ADMIN, ROLES.HEAD]);
      const p = params || {};
      let rows = getAllRows(SHEET_NAMES.INNOVATIONS);

      // HEAD ดูเฉพาะกลุ่มสาระตนเอง
      if (session.role === ROLES.HEAD) {
        rows = rows.filter(r => r.department === session.department);
      }

      if (p.status) rows = rows.filter(r => r.status === p.status);
      if (p.department) rows = rows.filter(r => r.department === p.department);
      if (p.academic_year) rows = rows.filter(r => String(r.academic_year) === String(p.academic_year));

      rows.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

      const page = parseInt(p.page) || 1;
      const limit = parseInt(p.limit) || 20;
      const total = rows.length;
      const paged = rows.slice((page - 1) * limit, page * limit).map(r => this.formatAdminCard(r));

      return successResponse({
        innovations: paged,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      });
    } catch (e) {
      return errorResponse(e.message);
    }
  },

  // ─── Format Helpers ──────────────────────────────────────────

  /** Format สำหรับ Public card */
  formatPublicCard: function(r) {
    return {
      innovation_id: r.innovation_id,
      title: r.title,
      type_code: normTypeCode(r.type_code),
      type_name: getInnovationTypeName(r.type_code),
      department: r.department,
      grade_level: jsonToArray(r.grade_level),
      academic_year: r.academic_year,
      semester: r.semester,
      teacher_id: r.teacher_id,
      teacher_name: r.teacher_name,
      teacher_profile_url: '',
      cover_url: r.cover_url || '',
      view_count: parseInt(r.view_count) || 0,
      tags: r.tags,
      created_at: r.created_at,
    };
  },

  /** เติม URL รูปโปรไฟล์ครูลงใน cards (เรียกหลัง format) */
  attachTeacherProfiles: function(cards) {
    const users = getAllRows(SHEET_NAMES.USERS);
    const map = {};
    users.forEach(function(u){ map[u.user_id] = u.profile_url || ''; });
    cards.forEach(function(c){ c.teacher_profile_url = map[c.teacher_id] || ''; });
    return cards;
  },

  /** Format สำหรับ Detail page */
  formatDetail: function(r) {
    return {
      ...this.formatPublicCard(r),
      description: r.description,
      file_urls: jsonToArray(r.file_urls),
      file_names: jsonToArray(r.file_names),
      link_url: r.link_url,
      status: r.status,
      approved_at: r.approved_at,
    };
  },

  /** Format สำหรับ Admin view */
  formatAdminCard: function(r) {
    return {
      ...this.formatDetail(r),
      status_label: getStatusLabel(r.status),
      reject_reason: r.reject_reason,
      approved_by: r.approved_by,
      teacher_id: r.teacher_id,
      updated_at: r.updated_at,
    };
  },

  /** ดึงสถิติ public */
  getPublicStats: function() {
    try {
      const rows = getAllRows(SHEET_NAMES.INNOVATIONS);
      const published = rows.filter(r => r.status === STATUS.PUBLISHED);
      const teachers = [...new Set(rows.map(r => r.teacher_id))];
      const years = [...new Set(published.map(r => r.academic_year))];

      return successResponse({
        total_published: published.length,
        total_teachers: teachers.length,
        total_years: years.length,
        total_types: Object.keys(INNOVATION_TYPES).length,
      });
    } catch (e) {
      return errorResponse(e.message);
    }
  },
};
