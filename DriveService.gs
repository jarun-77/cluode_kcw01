// ============================================================
// DriveService.gs — Google Drive Operations
// KIMS — โรงเรียนกระแชงวิทยา
// ============================================================

const DriveService = {

  /**
   * อัปโหลดไฟล์ไปยัง Google Drive
   * @param {Object} data - { base64Data, fileName, mimeType, teacherName, academicYear }
   */
  uploadFile: function(data) {
    try {
      const session = requireRole(data, [ROLES.SUPERADMIN, ROLES.ADMIN, ROLES.HEAD, ROLES.TEACHER]);

      const { base64Data, fileName, mimeType, academicYear } = data;
      const teacherName = session.full_name;

      // Validate
      if (!base64Data || !fileName) {
        return errorResponse('ข้อมูลไฟล์ไม่ครบถ้วน');
      }
      if (!validateFileExtension(fileName)) {
        return errorResponse(`ไม่รองรับประเภทไฟล์ .${fileName.split('.').pop()} กรุณาใช้ไฟล์ประเภท: ${ALLOWED_FILE_TYPES.join(', ')}`);
      }
      if (!validateFileSize(base64Data, CONFIG.MAX_FILE_SIZE_MB)) {
        return errorResponse(`ไฟล์ขนาดใหญ่เกินไป (สูงสุด ${CONFIG.MAX_FILE_SIZE_MB} MB)`);
      }

      const result = this.uploadFileToDrive(
        base64Data,
        fileName,
        mimeType || 'application/octet-stream',
        teacherName,
        academicYear || getCurrentThaiYear()
      );

      writeAuditLog(session.user_id, 'UPLOAD_FILE', 'FILE', result.fileId, {
        fileName: fileName,
        academicYear: academicYear,
      });

      return successResponse(result, 'อัปโหลดไฟล์สำเร็จ');
    } catch (e) {
      Logger.log('uploadFile error: ' + e.message);
      return errorResponse(e.message);
    }
  },

  /**
   * Core upload function
   */
  uploadFileToDrive: function(base64Data, fileName, mimeType, teacherName, academicYear) {
    const folder = this.getOrCreateTeacherFolder(teacherName, academicYear);
    // Decode & create Blob
    const decoded = Utilities.base64Decode(base64Data);
    const blob = Utilities.newBlob(decoded, mimeType, fileName);
    const file = folder.createFile(blob);
    // Set public read permission
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    return {
      fileId: file.getId(),
      fileName: fileName,
      fileUrl: file.getUrl(),
      viewUrl: `https://drive.google.com/file/d/${file.getId()}/preview`,
      downloadUrl: `https://drive.google.com/uc?id=${file.getId()}&export=download`,
      imageUrl: `https://drive.google.com/thumbnail?id=${file.getId()}&sz=w1000`,
      mimeType: mimeType,
      size: file.getSize(),
    };
  },

  /**
   * สร้าง/ดึง Folder: ROOT / ปีการศึกษา / ชื่อครู
   */
  getOrCreateTeacherFolder: function(teacherName, academicYear) {
    const rootFolder = DriveApp.getFolderById(CONFIG.DRIVE_ROOT_FOLDER_ID);

    // Year folder
    const yearName = String(academicYear);
    const yearIter = rootFolder.getFoldersByName(yearName);
    const yearFolder = yearIter.hasNext()
      ? yearIter.next()
      : rootFolder.createFolder(yearName);

    // Teacher folder
    const teacherIter = yearFolder.getFoldersByName(teacherName);
    const teacherFolder = teacherIter.hasNext()
      ? teacherIter.next()
      : yearFolder.createFolder(teacherName);

    return teacherFolder;
  },

  /**
   * สร้าง Folder ส่วนตัวสำหรับครู (เรียกตอนสร้าง user)
   */
  createUserFolder: function(teacherName, academicYear) {
    try {
      const folder = this.getOrCreateTeacherFolder(teacherName, academicYear);
      return { folderId: folder.getId(), folderUrl: folder.getUrl() };
    } catch (e) {
      Logger.log('createUserFolder error: ' + e.message);
      return null;
    }
  },

  /**
   * ลบไฟล์จาก Google Drive
   */
  deleteFile: function(fileId) {
    try {
      const file = DriveApp.getFileById(fileId);
      file.setTrashed(true);
      return true;
    } catch (e) {
      Logger.log('deleteFile error: ' + e.message + ' fileId: ' + fileId);
      return false;
    }
  },

  /**
   * ตรวจสอบว่า URL active อยู่หรือไม่
   */
  checkUrlActive: function(data) {
    try {
      const url = data.url;
      if (!validateUrl(url)) {
        return errorResponse('URL ไม่ถูกต้อง ต้องขึ้นต้นด้วย https://');
      }
      try {
        const response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
        const code = response.getResponseCode();
        const active = code >= 200 && code < 400;
        return successResponse({ active: active, status_code: code });
      } catch (e) {
        return successResponse({ active: false, status_code: 0 });
      }
    } catch (e) {
      return errorResponse(e.message);
    }
  },

  /**
   * Test function สำหรับทดสอบการ upload ใน Script Editor
   */
  testUpload: function() {
    const testBase64 = Utilities.base64Encode('Hello KIMS Test File');
    const result = this.uploadFileToDrive(
      testBase64,
      'test_kims.txt',
      'text/plain',
      'ทดสอบ ระบบ',
      getCurrentThaiYear()
    );
    Logger.log(JSON.stringify(result));
    return result;
  },
};
