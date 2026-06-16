// ============================================================
// DashboardService.gs — Dashboard Data & Reports
// KIMS — โรงเรียนกระแชงวิทยา
// ============================================================

const DashboardService = {

  /** ดึงข้อมูล Dashboard ทั้งหมด (Admin) */
  getDashboardData: function(params) {
    try {
      const session = requireRole(params, [ROLES.SUPERADMIN, ROLES.ADMIN, ROLES.HEAD]);
      const innovations = getAllRows(SHEET_NAMES.INNOVATIONS);
      const users = getAllRows(SHEET_NAMES.USERS);

      // HEAD ดูเฉพาะกลุ่มสาระตนเอง
      const filtered = session.role === ROLES.HEAD
        ? innovations.filter(r => r.department === session.department)
        : innovations;

      // ─── KPI Cards ────────────────────────────
      const kpi = {
        total: filtered.length,
        pending: filtered.filter(r => r.status === STATUS.PENDING).length,
        published: filtered.filter(r => r.status === STATUS.PUBLISHED).length,
        rejected: filtered.filter(r => r.status === STATUS.REJECTED).length,
        draft: filtered.filter(r => r.status === STATUS.DRAFT).length,
        total_teachers: session.role === ROLES.HEAD
          ? users.filter(u => u.department === session.department && u.role === ROLES.TEACHER).length
          : users.filter(u => [ROLES.TEACHER, ROLES.HEAD].includes(u.role)).length,
        active_teachers: [...new Set(filtered.filter(r => r.status === STATUS.PUBLISHED).map(r => r.teacher_id))].length,
        total_views: filtered.reduce((sum, r) => sum + (parseInt(r.view_count) || 0), 0),
      };

      // ─── By Type (Donut) ──────────────────────
      const byType = {};
      Object.keys(INNOVATION_TYPES).forEach(code => { byType[code] = { code, name: INNOVATION_TYPES[code], count: 0 }; });
      filtered.filter(r => r.status === STATUS.PUBLISHED).forEach(r => {
        const k = normTypeCode(r.type_code);
        if (byType[k]) byType[k].count++;
      });

      // ─── By Year (Bar) ────────────────────────
      const byYear = {};
      filtered.filter(r => r.status === STATUS.PUBLISHED).forEach(r => {
        const y = String(r.academic_year);
        if (!byYear[y]) byYear[y] = 0;
        byYear[y]++;
      });

      // ─── By Department (Horizontal Bar) ──────
      const byDept = {};
      DEPARTMENTS.forEach(d => { byDept[d] = 0; });
      filtered.filter(r => r.status === STATUS.PUBLISHED).forEach(r => {
        if (byDept[r.department] !== undefined) byDept[r.department]++;
      });

      // ─── Monthly Trend (Line) ──────────────────
      const monthlyTrend = this.getMonthlyTrend(filtered);

      // ─── Top 10 by View Count ──────────────────
      const topViewed = filtered
        .filter(r => r.status === STATUS.PUBLISHED)
        .sort((a, b) => (parseInt(b.view_count) || 0) - (parseInt(a.view_count) || 0))
        .slice(0, 10)
        .map(r => ({
          innovation_id: r.innovation_id,
          title: r.title,
          teacher_name: r.teacher_name,
          department: r.department,
          type_name: getInnovationTypeName(r.type_code),
          view_count: parseInt(r.view_count) || 0,
        }));

      // ─── Top Teacher by count ─────────────────
      const teacherCount = {};
      filtered.filter(r => r.status === STATUS.PUBLISHED).forEach(r => {
        if (!teacherCount[r.teacher_id]) {
          teacherCount[r.teacher_id] = { teacher_id: r.teacher_id, teacher_name: r.teacher_name, count: 0, department: r.department };
        }
        teacherCount[r.teacher_id].count++;
      });
      const topTeachers = Object.values(teacherCount)
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      // ─── Recent Pending ────────────────────────
      const pendingList = filtered
        .filter(r => r.status === STATUS.PENDING)
        .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
        .slice(0, 10)
        .map(r => ({
          innovation_id: r.innovation_id,
          title: r.title,
          teacher_name: r.teacher_name,
          department: r.department,
          type_name: getInnovationTypeName(r.type_code),
          created_at: r.created_at,
        }));

      return successResponse({
        kpi,
        byType: Object.values(byType),
        byYear: Object.entries(byYear).sort((a, b) => a[0] - b[0]).map(([year, count]) => ({ year, count })),
        byDept: Object.entries(byDept).map(([dept, count]) => ({ dept, count })),
        monthlyTrend,
        topViewed,
        topTeachers,
        pendingList,
      });
    } catch (e) {
      Logger.log('getDashboardData error: ' + e.message);
      return errorResponse(e.message);
    }
  },

  /** แนวโน้มรายเดือน (12 เดือนล่าสุด) */
  getMonthlyTrend: function(rows) {
    const now_ = new Date();
    const months = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now_.getFullYear(), now_.getMonth() - i, 1);
      months.push({
        key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
        label: `${d.getMonth() + 1}/${d.getFullYear()}`,
        count: 0,
      });
    }
    rows.forEach(r => {
      if (!r.created_at) return;
      const d = new Date(r.created_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const m = months.find(m => m.key === key);
      if (m) m.count++;
    });
    return months;
  },

  /** รายงาน: สรุปรายปีการศึกษา */
  getYearlyReport: function(params) {
    try {
      requireRole(params, [ROLES.SUPERADMIN, ROLES.ADMIN, ROLES.HEAD]);
      const year = params.academic_year;
      const rows = getAllRows(SHEET_NAMES.INNOVATIONS)
        .filter(r => r.status === STATUS.PUBLISHED && (!year || String(r.academic_year) === String(year)));

      const byType = {};
      const byDept = {};
      const byGrade = {};

      Object.keys(INNOVATION_TYPES).forEach(c => { byType[c] = { code: c, name: INNOVATION_TYPES[c], count: 0 }; });
      DEPARTMENTS.forEach(d => { byDept[d] = 0; });

      rows.forEach(r => {
        const tk = normTypeCode(r.type_code);
        if (byType[tk]) byType[tk].count++;
        if (byDept[r.department] !== undefined) byDept[r.department]++;
        jsonToArray(r.grade_level).forEach(g => {
          if (!byGrade[g]) byGrade[g] = 0;
          byGrade[g]++;
        });
      });

      return successResponse({
        academic_year: year || 'ทุกปี',
        total: rows.length,
        byType: Object.values(byType),
        byDept: Object.entries(byDept).map(([dept, count]) => ({ dept, count })),
        byGrade: Object.entries(byGrade).map(([grade, count]) => ({ grade, count })),
      });
    } catch (e) {
      return errorResponse(e.message);
    }
  },

  /** รายงาน: สรุปรายบุคคล (Admin) */
  getTeacherReport: function(params) {
    try {
      requireRole(params, [ROLES.SUPERADMIN, ROLES.ADMIN]);
      const innovations = getAllRows(SHEET_NAMES.INNOVATIONS)
        .filter(r => r.status === STATUS.PUBLISHED);
      const users = getAllRows(SHEET_NAMES.USERS)
        .filter(u => [ROLES.TEACHER, ROLES.HEAD].includes(u.role) && String(u.is_active) === 'TRUE');

      const report = users.map(u => {
        const myInn = innovations.filter(r => r.teacher_id === u.user_id);
        const byType = {};
        Object.keys(INNOVATION_TYPES).forEach(c => { byType[c] = 0; });
        myInn.forEach(r => { if (byType[r.type_code] !== undefined) byType[r.type_code]++; });
        return {
          user_id: u.user_id,
          full_name: `${u.title}${u.first_name} ${u.last_name}`,
          department: u.department,
          total: myInn.length,
          byType,
          total_views: myInn.reduce((s, r) => s + (parseInt(r.view_count) || 0), 0),
        };
      });

      report.sort((a, b) => b.total - a.total);
      return successResponse({ teachers: report, total_teachers: report.length });
    } catch (e) {
      return errorResponse(e.message);
    }
  },

  /** รายงาน: สรุปการอนุมัติ (รายเดือน + เวลาเฉลี่ย) */
  getApprovalReport: function(params) {
    try {
      requireRole(params, [ROLES.SUPERADMIN, ROLES.ADMIN]);
      const rows = getAllRows(SHEET_NAMES.INNOVATIONS);

      // 12 เดือนล่าสุด
      const now_ = new Date();
      const months = [];
      for (let i = 11; i >= 0; i--) {
        const d = new Date(now_.getFullYear(), now_.getMonth() - i, 1);
        months.push({
          key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
          label: `${d.getMonth() + 1}/${d.getFullYear()}`,
          approved: 0, rejected: 0,
        });
      }

      let totalApproved = 0, totalRejected = 0, pending = 0;
      let sumDays = 0, countDays = 0;

      rows.forEach(r => {
        if (r.status === STATUS.PENDING) pending++;
        if (!r.approved_at) return;
        const ad = new Date(r.approved_at);
        const key = `${ad.getFullYear()}-${String(ad.getMonth() + 1).padStart(2, '0')}`;
        const m = months.find(x => x.key === key);
        if (r.status === STATUS.PUBLISHED) {
          totalApproved++;
          if (m) m.approved++;
          if (r.created_at) {
            const days = (ad - new Date(r.created_at)) / (1000 * 60 * 60 * 24);
            if (days >= 0) { sumDays += days; countDays++; }
          }
        } else if (r.status === STATUS.REJECTED) {
          totalRejected++;
          if (m) m.rejected++;
        }
      });

      return successResponse({
        monthly: months,
        totalApproved: totalApproved,
        totalRejected: totalRejected,
        pending: pending,
        avgDays: countDays ? Math.round((sumDays / countDays) * 10) / 10 : 0,
      });
    } catch (e) {
      return errorResponse(e.message);
    }
  },

  /** รายงาน: Audit Log */
  getAuditLog: function(params) {
    try {
      requireRole(params, [ROLES.SUPERADMIN, ROLES.ADMIN]);
      const p = params || {};
      let rows = getAllRows(SHEET_NAMES.AUDIT_LOG);

      if (p.user_id) rows = rows.filter(r => r.user_id === p.user_id);
      if (p.action) rows = rows.filter(r => r.action === p.action);
      if (p.target_type) rows = rows.filter(r => r.target_type === p.target_type);

      rows.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

      const page = parseInt(p.page) || 1;
      const limit = parseInt(p.limit) || 50;
      const total = rows.length;
      const paged = rows.slice((page - 1) * limit, page * limit);

      return successResponse({
        logs: paged,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      });
    } catch (e) {
      return errorResponse(e.message);
    }
  },

  /** ดึง Config ระบบ */
  getConfig: function(data) {
    try {
      requireRole(data, [ROLES.SUPERADMIN]);
      const rows = getAllRows(SHEET_NAMES.CONFIG);
      const config = {};
      rows.forEach(r => { config[r.config_key] = r.config_value; });
      return successResponse(config);
    } catch (e) {
      return errorResponse(e.message);
    }
  },

  /** ดึง Config ส่วนสาธารณะ (ไม่ต้องล็อกอิน) — ชื่อโรงเรียน, footer, สี */
  getPublicConfig: function() {
    try {
      const rows = getAllRows(SHEET_NAMES.CONFIG);
      const c = {};
      rows.forEach(r => { c[r.config_key] = r.config_value; });
      return successResponse({
        school_name:     c.school_name || 'โรงเรียนกระแชงวิทยา',
        school_logo_url: c.school_logo_url || '',
        footer_line1:    c.footer_line1 || '',
        footer_line2:    c.footer_line2 || '',
        footer_line3:    c.footer_line3 || '',
        footer_color:    c.footer_color || '',
        primary_color:   c.primary_color || '',
        secondary_color: c.secondary_color || '',
      });
    } catch (e) {
      return errorResponse(e.message);
    }
  },

  /** อัปเดต Config ระบบ (Super Admin เท่านั้น) */
  updateConfig: function(data) {
    try {
      requireRole(data, [ROLES.SUPERADMIN]);
      const sheet = getSheet(SHEET_NAMES.CONFIG);
      const sheetData = sheet.getDataRange().getValues();
      const headers = sheetData[0];
      const keyCol = headers.indexOf('config_key');
      const valCol = headers.indexOf('config_value');

      Object.entries(data).forEach(([key, value]) => {
        if (key === 'action') return;
        for (let i = 1; i < sheetData.length; i++) {
          if (sheetData[i][keyCol] === key) {
            sheet.getRange(i + 1, valCol + 1).setValue(value);
            break;
          }
        }
      });

      writeAuditLog((AuthService.getSessionByToken(data && data.token ? data.token : '') || {}).user_id, 'UPDATE_CONFIG', 'CONFIG', 'system', data);
      return successResponse(null, 'บันทึกการตั้งค่าระบบเรียบร้อยแล้ว');
    } catch (e) {
      return errorResponse(e.message);
    }
  },
};
