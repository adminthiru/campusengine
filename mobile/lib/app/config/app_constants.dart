// ── App Constants ─────────────────────────────────────────────────────────────

class AppConstants {
  AppConstants._();

  // ── App Info ─────────────────────────────────────────────────────────────
  static const String appName    = 'SKL Teacher';
  static const String appVersion = '1.0.0';

  // ── Storage Keys ─────────────────────────────────────────────────────────
  static const String keyAccessToken   = 'access_token';
  static const String keyRefreshToken  = 'refresh_token';
  static const String keyUserId        = 'user_id';
  static const String keyUserRole      = 'user_role';
  static const String keySchoolId      = 'school_id';
  static const String keyThemeMode     = 'theme_mode';
  static const String keyOnboardingDone = 'onboarding_done';
  static const String keyRememberMe    = 'remember_me';
  static const String keySavedEmail    = 'saved_email';

  // ── Hive Box Names ────────────────────────────────────────────────────────
  static const String boxStudents     = 'students_box';
  static const String boxTimetable    = 'timetable_box';
  static const String boxAttendance   = 'attendance_box';
  static const String boxNotifications = 'notifications_box';
  static const String boxPendingSync  = 'pending_sync_box';
  static const String boxHomework     = 'homework_box';

  // ── Network ───────────────────────────────────────────────────────────────
  static const int connectTimeoutMs = 10000;
  static const int receiveTimeoutMs = 30000;
  static const int sendTimeoutMs    = 20000;
  static const int maxRetries       = 3;

  // ── Pagination ────────────────────────────────────────────────────────────
  static const int pageSize = 20;

  // ── Session ───────────────────────────────────────────────────────────────
  static const int sessionTimeoutMinutes = 30;
}
