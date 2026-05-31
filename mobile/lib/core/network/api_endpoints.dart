// ── API Endpoints — mirrors the existing Express backend routes ──────────────
// NOTE: baseUrl already includes /api, so paths here start with just /

class ApiEndpoints {
  ApiEndpoints._();

  // ── Auth ─────────────────────────────────────────────────────────────────
  static const String login          = '/auth/login';
  static const String logout         = '/auth/logout';
  static const String refreshToken   = '/auth/refresh';
  static const String changePassword = '/auth/change-password';
  static const String me             = '/auth/me';

  // ── School ────────────────────────────────────────────────────────────────
  static const String school         = '/school';

  // ── Employees / Teacher Profile ───────────────────────────────────────────
  static const String employees      = '/employees';
  static String employeeById(String id) => '/employees/$id';

  // ── Classes ───────────────────────────────────────────────────────────────
  static const String classes        = '/classes';
  static String classById(String id) => '/classes/$id';

  // ── Subjects ──────────────────────────────────────────────────────────────
  static const String subjects       = '/subjects';

  // ── Students ──────────────────────────────────────────────────────────────
  static const String students       = '/students';
  static String studentById(String id) => '/students/$id';

  // ── Attendance ────────────────────────────────────────────────────────────
  static const String attendance         = '/attendance';
  static const String attendanceBulk     = '/attendance/bulk';
  static const String attendanceStudent  = '/attendance/student';

  // ── Homework ──────────────────────────────────────────────────────────────
  static const String homework       = '/homework';
  static String homeworkById(String id)        => '/homework/$id';
  static String homeworkSubmissions(String id) => '/homework/$id/submissions';
  static String submissionUpdate(String hwId, String studentId) => '/homework/$hwId/submissions/$studentId';
  static String homeworkNotify(String id) => '/homework/$id/notify';

  // ── Timetable ─────────────────────────────────────────────────────────────
  static const String timetable      = '/timetable';

  // ── Exams ─────────────────────────────────────────────────────────────────
  static const String exams           = '/exams';
  static String examById(String id)   => '/exams/$id';
  static String examPublish(String id) => '/exams/$id/publish';
  static const String examResults     = '/exams/results';
  static const String examMarks       = '/exams/marks';
  static const String examAnswerPaper = '/exams/answer-paper';
  // ── Fees ──────────────────────────────────────────────────────────────────
  static const String fees           = '/fees';

  // ── Leave ─────────────────────────────────────────────────────────────────
  static const String leaves         = '/leaves';
  static String leaveById(String id) => '/leaves/$id';

  // ── Notifications ─────────────────────────────────────────────────────────
  static const String notifications  = '/notifications';
  static const String markAllRead    = '/notifications/mark-all-read';

  // ── School Calendar ───────────────────────────────────────────────────────
  static const String calendar       = '/calendar';

  // ── Reports ───────────────────────────────────────────────────────────────
  static const String reportsTeacher  = '/reports/teacher';

  // ── Dashboard ─────────────────────────────────────────────────────────────
  static const String dashboardTeacher = '/dashboard/teacher';

  // ── Chat / Messages ───────────────────────────────────────────────────────
  static const String conversations   = '/conversations';
  static String messages(String convId) => '/conversations/$convId/messages';

  // ── FCM Token ─────────────────────────────────────────────────────────────
  static const String registerFcmToken = '/notifications/fcm-token';

  // ── Teacher profile ───────────────────────────────────────────────────────
  static const String teacherProfile = '/teacher/my-profile';
}
