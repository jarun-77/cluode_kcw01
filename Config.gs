// ============================================================
// Config.gs — KIMS System Configuration
// โรงเรียนกระแชงวิทยา | Krachangwittaya Innovation Management System
// ============================================================

const CONFIG = {
  SPREADSHEET_ID: '1wQeNguG5FiZLZcSqkt0rmXB42sPAr8-4nKNR11t2Cr4',
  DRIVE_ROOT_FOLDER_ID: '1LuGNHBrOkaIOjiYsQmp7ZjLbNY5EAxN7',
  SALT: 'KIMS_KRACHANGWITTAYA_2568',                   // ← เปลี่ยนก่อน Deploy จริง
  ADMIN_EMAIL: 'admin@krachangwittaya.ac.th',
  SCHOOL_NAME: 'โรงเรียนกระแชงวิทยา',
  MAX_FILE_SIZE_MB: 100,
  SESSION_HOURS: 8,
  OBEC_CODE: '1031670201',
  SYSTEM_VERSION: '1.0.0',
};

// Sheet Names
const SHEET_NAMES = {
  USERS: 'USERS',
  INNOVATIONS: 'INNOVATIONS',
  AUDIT_LOG: 'AUDIT_LOG',
  CONFIG: 'CONFIG',
};

// Roles
const ROLES = {
  SUPERADMIN: 'SUPERADMIN',
  ADMIN: 'ADMIN',
  HEAD: 'HEAD',
  TEACHER: 'TEACHER',
};

// Innovation Statuses
const STATUS = {
  DRAFT: 'DRAFT',
  PENDING: 'PENDING',
  PUBLISHED: 'PUBLISHED',
  REJECTED: 'REJECTED',
};

// Innovation Types
const INNOVATION_TYPES = {
  '01': 'สื่อการสอน / CAI',
  '02': 'วิจัยในชั้นเรียน',
  '03': 'แผนการจัดการเรียนรู้',
  '04': 'ชุดกิจกรรม / ใบงาน',
  '05': 'เทคโนโลยีทางการศึกษา',
  '99': 'อื่นๆ',
};

// กลุ่มสาระการเรียนรู้ (หลักสูตรแกนกลาง 2551)
const DEPARTMENTS = [
  'ภาษาไทย',
  'คณิตศาสตร์',
  'วิทยาศาสตร์และเทคโนโลยี',
  'สังคมศึกษา ศาสนา และวัฒนธรรม',
  'สุขศึกษาและพลศึกษา',
  'ศิลปะ',
  'การงานอาชีพ',
  'ภาษาต่างประเทศ',
  'กิจกรรมพัฒนาผู้เรียน',
];

// ระดับชั้น
const GRADE_LEVELS = ['ม.1', 'ม.2', 'ม.3', 'ม.4', 'ม.5', 'ม.6'];

// Audit Actions
const AUDIT_ACTIONS = {
  LOGIN: 'LOGIN',
  LOGOUT: 'LOGOUT',
  CREATE: 'CREATE',
  UPDATE: 'UPDATE',
  DELETE: 'DELETE',
  APPROVE: 'APPROVE',
  REJECT: 'REJECT',
  VIEW: 'VIEW',
};

// Allowed file extensions
const ALLOWED_FILE_TYPES = [
  'pdf', 'doc', 'docx', 'xls', 'xlsx',
  'ppt', 'pptx', 'mp4', 'jpg', 'jpeg', 'png', 'gif',
];
