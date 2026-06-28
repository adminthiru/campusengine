import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../../../core/network/api_client.dart';
import '../../../../core/models/teacher_profile.dart';
import '../../../../core/models/student.dart';

class AttendanceProvider extends ChangeNotifier {
  bool _disposed = false;

  @override
  void dispose() {
    _disposed = true;
    super.dispose();
  }

  void _notify() {
    if (!_disposed) notifyListeners();
  }

  DateTime _selectedDate = DateTime.now();
  DateTime get selectedDate => _selectedDate;

  List<ClassInfo> _classes = [];
  List<ClassInfo> get classes => _classes;

  String? _selectedClassId;
  String? get selectedClassId => _selectedClassId;

  List<Student> _students = [];
  List<Student> get students => _students;

  // Map of Student ID -> { 'status': 'present', 'remarks': '' }
  Map<String, Map<String, String>> _attendanceMap = {};
  Map<String, Map<String, String>> get attendanceMap => _attendanceMap;

  bool _isLoadingClasses = false;
  bool get isLoadingClasses => _isLoadingClasses;

  bool _isLoadingStudents = false;
  bool get isLoadingStudents => _isLoadingStudents;

  bool _isSaving = false;
  bool get isSaving => _isSaving;

  bool _isSaved = false;
  bool get isSaved => _isSaved;

  String? _error;
  String? get error => _error;

  void setDate(DateTime date) {
    _selectedDate = date;
    _isSaved = false;

    // Reset attendance map to defaults
    _attendanceMap = {
      for (final s in _students) s.id: {'status': 'present', 'remarks': ''}
    };

    _notify();
    if (_selectedClassId != null) {
      fetchExistingAttendance();
    }
  }

  void setClass(String classId) {
    _selectedClassId = classId;
    _notify();
    fetchStudents();
  }

  void setStatus(String studentId, String status) {
    if (_attendanceMap.containsKey(studentId)) {
      _attendanceMap[studentId]!['status'] = status;
      _notify();
    }
  }

  void setRemarks(String studentId, String remarks) {
    if (_attendanceMap.containsKey(studentId)) {
      _attendanceMap[studentId]!['remarks'] = remarks;
      _notify();
    }
  }

  void setIsSaved(bool saved) {
    _isSaved = saved;
    _notify();
  }

  // Fast init: use class info already loaded in ProfileProvider — no extra API call.
  void initWithKnownClass(ClassInfo classInfo) {
    _classes = [classInfo];
    _selectedClassId = classInfo.id;
    _isLoadingClasses = false;
    // No notify — fetchStudents() is called immediately after by the screen.
  }

  // Fallback when profile isn't cached yet (edge case).
  Future<void> fetchClasses() async {
    _isLoadingClasses = true;
    _error = null;
    _notify();

    try {
      final res = await ApiClient.get('/teacher/my-profile');
      final profile = TeacherProfile.fromJson(res.data);
      _classes = [];
      if (profile.classTeacher != null) {
        _classes.add(profile.classTeacher!.classInfo);
        _selectedClassId = profile.classTeacher!.classInfo.id;
      }
      if (_selectedClassId != null) await fetchStudents();
    } catch (e) {
      _error = 'Failed to load classes: ${ApiClient.errorMessage(e)}';
    } finally {
      _isLoadingClasses = false;
      _notify();
    }
  }

  Future<void> fetchStudents() async {
    if (_selectedClassId == null) return;

    _isLoadingStudents = true;
    _students = [];
    _attendanceMap = {};
    _isSaved = false;
    _error = null;
    _notify();

    try {
      final dateStr = DateFormat('yyyy-MM-dd').format(_selectedDate);

      // Launch both requests simultaneously — no sequential waiting.
      final studentsFuture = ApiClient.get('/students', params: {
        'classId': _selectedClassId,
        'limit': 200,
      });
      final attendanceFuture = ApiClient.get('/attendance', params: {
        'type': 'student',
        'classId': _selectedClassId,
        'date': dateStr,
      });

      // Students are required; resolve them first.
      final studentsRes = await studentsFuture;
      final List data = studentsRes.data['students'] ?? [];
      _students = data.map((json) => Student.fromJson(json)).toList();
      for (final s in _students) {
        _attendanceMap[s.id] = {'status': 'present', 'remarks': ''};
      }

      // Attendance is optional (may not exist for today yet).
      try {
        final attendanceRes = await attendanceFuture;
        _applyAttendanceResponse(attendanceRes.data);
      } catch (_) {
        // No saved attendance for this date — defaults stand.
      }
    } catch (e) {
      _error = 'Failed to load: ${ApiClient.errorMessage(e)}';
    } finally {
      _isLoadingStudents = false;
      _notify(); // Single notify after all state is ready.
    }
  }

  void _applyAttendanceResponse(dynamic data) {
    final attendanceList = data['attendance'] as List?;
    if (attendanceList == null || attendanceList.isEmpty) return;
    final records = attendanceList.first['records'] as List?;
    if (records == null || records.isEmpty) return;
    _isSaved = true;
    for (final r in records) {
      final studentData = r['student'];
      final studentId = studentData is Map ? studentData['_id'] : studentData;
      if (studentId != null) {
        _attendanceMap[studentId.toString()] = {
          'status': r['status'] ?? 'present',
          'remarks': r['remarks'] ?? '',
        };
      }
    }
  }

  Future<void> fetchExistingAttendance() async {
    if (_selectedClassId == null) return;
    try {
      final dateStr = DateFormat('yyyy-MM-dd').format(_selectedDate);
      final response = await ApiClient.get('/attendance', params: {
        'type': 'student',
        'classId': _selectedClassId,
        'date': dateStr,
      });
      _applyAttendanceResponse(response.data);
    } catch (e) {
      debugPrint('No existing attendance or error: $e');
    }
    _notify();
  }

  Future<bool> saveAttendance() async {
    if (_selectedClassId == null || _students.isEmpty) return false;

    _isSaving = true;
    _notify();

    try {
      final dateStr = DateFormat('yyyy-MM-dd').format(_selectedDate);

      final records = _attendanceMap.entries.map((e) {
        return {
          'student': e.key,
          'status': e.value['status'] ?? 'present',
          if ((e.value['remarks'] ?? '').isNotEmpty)
            'remarks': e.value['remarks'],
        };
      }).toList();

      await ApiClient.post('/attendance/student', data: {
        'classId': _selectedClassId,
        'date': dateStr,
        'records': records,
      });

      _isSaved = true;
      return true;
    } catch (e) {
      _error = 'Failed to save attendance: ${ApiClient.errorMessage(e)}';
      return false;
    } finally {
      _isSaving = false;
      _notify();
    }
  }
}
