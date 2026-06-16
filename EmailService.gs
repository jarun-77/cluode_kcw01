// ============================================================
// EmailService.gs — Email Notifications (GAS MailApp)
// KIMS — โรงเรียนกระแชงวิทยา
// ============================================================

const EmailService = {

  /** รูปแบบ Email header */
  _header: function() {
    return `
      <div style="background:#1A5276;color:white;padding:20px 30px;border-radius:8px 8px 0 0;">
        <h2 style="margin:0;font-family:sans-serif;font-size:18px;">
          📚 KIMS — ระบบบริหารจัดการนวัตกรรม
        </h2>
        <p style="margin:5px 0 0;font-size:13px;opacity:0.85;">โรงเรียนกระแชงวิทยา สังกัด สพฐ.</p>
      </div>
    `;
  },

  /** Wrapper ครอบ body */
  _wrap: function(body) {
    return `
      <div style="font-family:'TH Sarabun New',sans-serif;max-width:600px;margin:0 auto;background:#f2f3f4;padding:20px;">
        <div style="background:white;border-radius:8px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
          ${this._header()}
          <div style="padding:25px 30px;">
            ${body}
          </div>
          <div style="background:#f2f3f4;padding:15px 30px;font-size:12px;color:#666;border-top:1px solid #eee;">
            อีเมลนี้ส่งโดยอัตโนมัติจากระบบ KIMS โรงเรียนกระแชงวิทยา | กรุณาอย่าตอบกลับอีเมลนี้
          </div>
        </div>
      </div>
    `;
  },

  /** ส่งอีเมลปลอดภัย */
  _send: function(to, subject, htmlBody) {
    try {
      if (!to || !to.includes('@')) {
        Logger.log('EmailService: invalid email address — ' + to);
        return false;
      }
      MailApp.sendEmail({
        to: to,
        subject: subject,
        htmlBody: this._wrap(htmlBody),
      });
      return true;
    } catch (e) {
      Logger.log('EmailService error: ' + e.message + ' | to: ' + to);
      return false;
    }
  },

  /** แจ้ง Admin เมื่อมีนวัตกรรมใหม่ */
  notifyAdminNewInnovation: function(innovation, teacherSession) {
    try {
      const admins = getAllRows(SHEET_NAMES.USERS)
        .filter(u => [ROLES.SUPERADMIN, ROLES.ADMIN].includes(u.role) && String(u.is_active) === 'TRUE');

      const body = `
        <h3 style="color:#1A5276;">🔔 มีนวัตกรรมใหม่รอการอนุมัติ</h3>
        <table style="width:100%;border-collapse:collapse;font-size:15px;">
          <tr><td style="padding:8px;color:#666;width:140px;">ชื่อนวัตกรรม</td><td style="padding:8px;font-weight:600;">${innovation.title}</td></tr>
          <tr style="background:#f9f9f9;"><td style="padding:8px;color:#666;">ประเภท</td><td style="padding:8px;">${getInnovationTypeName(innovation.type_code)}</td></tr>
          <tr><td style="padding:8px;color:#666;">กลุ่มสาระ</td><td style="padding:8px;">${innovation.department}</td></tr>
          <tr style="background:#f9f9f9;"><td style="padding:8px;color:#666;">ปีการศึกษา</td><td style="padding:8px;">${innovation.academic_year} ภาคเรียนที่ ${innovation.semester}</td></tr>
          <tr><td style="padding:8px;color:#666;">ผู้ส่ง</td><td style="padding:8px;">${teacherSession.full_name}</td></tr>
          <tr style="background:#f9f9f9;"><td style="padding:8px;color:#666;">วันที่ส่ง</td><td style="padding:8px;">${now()}</td></tr>
        </table>
        <p style="margin-top:20px;">
          <a href="#" style="background:#1A5276;color:white;padding:10px 20px;text-decoration:none;border-radius:6px;font-size:14px;">
            🔍 ตรวจสอบและอนุมัติ
          </a>
        </p>
        <p style="color:#888;font-size:13px;">กรุณาเข้าสู่ระบบ KIMS เพื่อตรวจสอบและอนุมัตินวัตกรรมดังกล่าว</p>
      `;

      admins.forEach(admin => {
        this._send(admin.email, `[KIMS] มีนวัตกรรมใหม่รออนุมัติ: ${innovation.title}`, body);
      });
    } catch (e) {
      Logger.log('notifyAdminNewInnovation error: ' + e.message);
    }
  },

  /** แจ้ง Admin เมื่อครูส่งนวัตกรรมซ้ำหลังแก้ไข */
  notifyAdminResubmit: function(innovation, teacherSession) {
    try {
      const admins = getAllRows(SHEET_NAMES.USERS)
        .filter(u => [ROLES.SUPERADMIN, ROLES.ADMIN].includes(u.role) && String(u.is_active) === 'TRUE');

      const body = `
        <h3 style="color:#F39C12;">🔄 นวัตกรรมที่แก้ไขแล้วรออนุมัติอีกครั้ง</h3>
        <p><strong>${teacherSession.full_name}</strong> ได้แก้ไขนวัตกรรมและส่งใหม่เพื่อรอการอนุมัติ</p>
        <table style="width:100%;border-collapse:collapse;font-size:15px;">
          <tr><td style="padding:8px;color:#666;width:140px;">ชื่อนวัตกรรม</td><td style="padding:8px;font-weight:600;">${innovation.title}</td></tr>
          <tr style="background:#f9f9f9;"><td style="padding:8px;color:#666;">ประเภท</td><td style="padding:8px;">${getInnovationTypeName(innovation.type_code)}</td></tr>
          <tr><td style="padding:8px;color:#666;">กลุ่มสาระ</td><td style="padding:8px;">${innovation.department}</td></tr>
        </table>
        <p style="color:#888;font-size:13px;margin-top:15px;">กรุณาเข้าสู่ระบบ KIMS เพื่อตรวจสอบ</p>
      `;

      admins.forEach(admin => {
        this._send(admin.email, `[KIMS] นวัตกรรมที่แก้ไขแล้วรออนุมัติ: ${innovation.title}`, body);
      });
    } catch (e) {
      Logger.log('notifyAdminResubmit error: ' + e.message);
    }
  },

  /** แจ้งครูเมื่อนวัตกรรมได้รับการอนุมัติ */
  notifyTeacherApproved: function(innovation, adminSession) {
    try {
      const teacher = getAllRows(SHEET_NAMES.USERS).find(u => u.user_id === innovation.teacher_id);
      if (!teacher || !teacher.email) return;

      const body = `
        <h3 style="color:#27AE60;">✅ นวัตกรรมของคุณได้รับการอนุมัติแล้ว!</h3>
        <p>เรียน <strong>${teacher.title}${teacher.first_name} ${teacher.last_name}</strong></p>
        <p>นวัตกรรมทางการศึกษาของคุณได้รับการอนุมัติและเผยแพร่บนระบบ KIMS เรียบร้อยแล้ว</p>
        <table style="width:100%;border-collapse:collapse;font-size:15px;">
          <tr><td style="padding:8px;color:#666;width:140px;">ชื่อนวัตกรรม</td><td style="padding:8px;font-weight:600;">${innovation.title}</td></tr>
          <tr style="background:#f9f9f9;"><td style="padding:8px;color:#666;">ประเภท</td><td style="padding:8px;">${getInnovationTypeName(innovation.type_code)}</td></tr>
          <tr><td style="padding:8px;color:#666;">กลุ่มสาระ</td><td style="padding:8px;">${innovation.department}</td></tr>
          <tr style="background:#f9f9f9;"><td style="padding:8px;color:#666;">อนุมัติโดย</td><td style="padding:8px;">${adminSession.full_name}</td></tr>
          <tr><td style="padding:8px;color:#666;">วันที่อนุมัติ</td><td style="padding:8px;">${now()}</td></tr>
        </table>
        <p style="margin-top:15px;color:#555;">บุคคลทั่วไปสามารถค้นหาและชมนวัตกรรมของคุณได้บนหน้าเว็บไซต์ KIMS แล้ว ขอบคุณที่ร่วมพัฒนาการศึกษา!</p>
      `;

      this._send(teacher.email, `[KIMS] ✅ นวัตกรรม "${innovation.title}" ได้รับการอนุมัติแล้ว`, body);
    } catch (e) {
      Logger.log('notifyTeacherApproved error: ' + e.message);
    }
  },

  /** แจ้งครูเมื่อนวัตกรรมถูกปฏิเสธ */
  notifyTeacherRejected: function(innovation, adminSession, reason) {
    try {
      const teacher = getAllRows(SHEET_NAMES.USERS).find(u => u.user_id === innovation.teacher_id);
      if (!teacher || !teacher.email) return;

      const body = `
        <h3 style="color:#E74C3C;">❌ นวัตกรรมของคุณยังไม่ผ่านการอนุมัติ</h3>
        <p>เรียน <strong>${teacher.title}${teacher.first_name} ${teacher.last_name}</strong></p>
        <p>นวัตกรรมทางการศึกษาของคุณยังไม่ผ่านการตรวจสอบ โดยมีรายละเอียดดังนี้</p>
        <table style="width:100%;border-collapse:collapse;font-size:15px;">
          <tr><td style="padding:8px;color:#666;width:140px;">ชื่อนวัตกรรม</td><td style="padding:8px;font-weight:600;">${innovation.title}</td></tr>
          <tr style="background:#f9f9f9;"><td style="padding:8px;color:#666;">ผู้ตรวจสอบ</td><td style="padding:8px;">${adminSession.full_name}</td></tr>
          <tr><td style="padding:8px;color:#666;">วันที่ตรวจสอบ</td><td style="padding:8px;">${now()}</td></tr>
        </table>
        <div style="background:#FADBD8;border-left:4px solid #E74C3C;padding:15px;margin:15px 0;border-radius:0 6px 6px 0;">
          <strong style="color:#E74C3C;">เหตุผล:</strong>
          <p style="margin:5px 0 0;color:#555;">${reason}</p>
        </div>
        <p style="color:#555;">คุณสามารถแก้ไขนวัตกรรมและส่งใหม่ได้โดยเข้าสู่ระบบ KIMS แล้วไปที่เมนู <strong>"นวัตกรรมของฉัน"</strong></p>
      `;

      this._send(teacher.email, `[KIMS] ❌ นวัตกรรม "${innovation.title}" ยังไม่ผ่านการอนุมัติ`, body);
    } catch (e) {
      Logger.log('notifyTeacherRejected error: ' + e.message);
    }
  },

  /** แจ้งครูใหม่เมื่อ Admin สร้างบัญชีให้ */
  notifyNewUser: function(user, initialPassword) {
    try {
      if (!user.email) return;
      const body = `
        <h3 style="color:#1A5276;">🎉 บัญชีผู้ใช้งาน KIMS ของคุณพร้อมใช้งานแล้ว</h3>
        <p>เรียน <strong>${user.title}${user.first_name} ${user.last_name}</strong></p>
        <p>ผู้ดูแลระบบได้สร้างบัญชีสำหรับคุณบนระบบ KIMS เรียบร้อยแล้ว</p>
        <div style="background:#D6EAF8;border-radius:8px;padding:20px;margin:15px 0;">
          <p style="margin:0 0 10px;font-weight:600;color:#1A5276;">ข้อมูลสำหรับเข้าสู่ระบบ</p>
          <table style="font-size:15px;">
            <tr><td style="color:#666;padding:4px 15px 4px 0;">เลขประจำตัวประชาชน</td><td style="font-weight:600;">${user.id_card}</td></tr>
            <tr><td style="color:#666;padding:4px 15px 4px 0;">รหัสผ่านเริ่มต้น</td><td style="font-weight:600;color:#E74C3C;">${initialPassword}</td></tr>
          </table>
        </div>
        <p style="color:#E74C3C;font-size:13px;">⚠️ กรุณาเปลี่ยนรหัสผ่านทันทีหลังจากเข้าสู่ระบบครั้งแรก</p>
      `;

      this._send(user.email, '[KIMS] บัญชีผู้ใช้งานของคุณพร้อมแล้ว', body);
    } catch (e) {
      Logger.log('notifyNewUser error: ' + e.message);
    }
  },
};
