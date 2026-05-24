class AttendanceRecord {
  final String id;
  final String studentId;
  final String date;
  final String status; // 'present' | 'absent' | 'late' | 'leave'

  AttendanceRecord({
    required this.id, required this.studentId,
    required this.date, required this.status,
  });

  factory AttendanceRecord.fromJson(Map<String, dynamic> j) => AttendanceRecord(
    id: j['_id'] ?? '',
    studentId: j['student'] is Map ? j['student']['_id'] : j['student'] ?? '',
    date: j['date'] ?? '',
    status: j['status'] ?? 'present',
  );
}
