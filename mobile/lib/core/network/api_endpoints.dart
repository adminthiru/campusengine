// ── API Endpoints — mirrors the existing Express backend routes ──────────────

class ApiEndpoints {
  ApiEndpoints._();

  // ── Base path prefix (appended after base URL) ───────────────────────────
  static const String _api = '/api';

  // ── Auth ─────────────────────────────────────────────────────────────────
  static const String login         = '$_api/auth/login';
  static const String logout        = '$_api/auth/logout';
  static const String refreshToken  = '$_api/auth/refresh';
  static const String changePassword= '$_api/auth/change-password';
  static const String me            = '$_api/auth/me';

  // ── School ────────────────────────────────────────────────────────────────
  static const String school        = '$_api/school';

  // ── Employees / Teacher Profile ───────────────────────────────────────────
  static const String employees     = '$_api/employees';
  static String employeeById(String id) => '$_api/employees/$id';

  // ── Classes ───────────────────────────────────────────────────────────────
  static const String classes       = '$_api/classes';
  static String classById(String id) => '$_api/classes/$id';

  // ── Subjects ──────────────────────────────────────────────────────────────
  static const String subjects      = '$_api/subjects';

  // ── Students ──────────────────────────────────────────────────────────────
  static const String students      = '$_api/students';
  static String studentById(String id) => '$_api/students/$id';

  // ── Attendance ────────────────────────────────────────────────────────────
  static const String attendance    = '$_api/attendance';
  static const String attendanceBulk= '$_api/attendance/bulk';
  static const String attendanceStudent = '$_api/attendance/student';

  // ── Homework ──────────────────────────────────────────────────────────────
  static const String homework      = '$_api/homework';
  static String homeworkById(String id)        => '$_api/homework/$id';
  static String homeworkSubmissions(String id) => '$_api/homework/$id/submissions';
  static String submissionUpdate(String hwId, String studentId) => '$_api/homework/$hwId/submissions/$studentId';
  static String homeworkNotify(String id) => '$_api/homework/$id/notify';

  // ── Timetable ─────────────────────────────────────────────────────────────
  static const String timetable     = '$_api/timetable';

  // ── Exams ─────────────────────────────────────────────────────────────────
  static const String exams          = '$_api/exams';
  static String examById(String id)  => '$_api/exams/$id';
  static String examPublish(String id) => '$_api/exams/$id/publish';
  static const String examResults    = '$_api/exams/results';
  static const String examMarks      = '$_api/exams/marks';

  // ── Fees (view-only for teacher) ──────────────────────────────────────────
  static const String fees          = '$_api/fees';

  // ── Leave / Permission ────────────────────────────────────────────────────
  static const String leaves        = '$_api/leaves';
  static String leaveById(String id) => '$_api/leaves/$id';

  // ── Notifications ─────────────────────────────────────────────────────────
  static const String notifications = '$_api/notifications';
  static const String markAllRead   = '$_api/notifications/mark-all-read';

  // ── School Calendar (holidays, events, exam days, meetings) ──────────────
  static const String calendar      = '$_api/calendar';

  // ── Reports ───────────────────────────────────────────────────────────────
  static const String reportsTeacher = '$_api/reports/teacher';

  // ── Dashboard ─────────────────────────────────────────────────────────────
  static const String dashboardTeacher = '$_api/dashboard/teacher';

  // ── Chat / Messages ───────────────────────────────────────────────────────
  static const String conversations  = '$_api/conversations';
  static String messages(String convId) => '$_api/conversations/$convId/messages';

  // ── FCM Token registration ────────────────────────────────────────────────
  static const String registerFcmToken = '$_api/notifications/fcm-token';
}
