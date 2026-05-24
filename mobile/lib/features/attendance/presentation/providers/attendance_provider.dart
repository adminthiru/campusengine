import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../../../core/network/api_client.dart';
import '../../../../core/models/teacher_profile.dart';
import '../../../../core/models/student.dart';

class AttendanceProvider extends ChangeNotifier {
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

    notifyListeners();
    if (_selectedClassId != null) {
      fetchExistingAttendance();
    }
  }

  void setClass(String classId) {
    _selectedClassId = classId;
    notifyListeners();
    fetchStudents();
  }

  void setStatus(String studentId, String status) {
    if (_attendanceMap.containsKey(studentId)) {
      _attendanceMap[studentId]!['status'] = status;
      notifyListeners();
    }
  }

  void setRemarks(String studentId, String remarks) {
    if (_attendanceMap.containsKey(studentId)) {
      _attendanceMap[studentId]!['remarks'] = remarks;
      notifyListeners();
    }
  }

  void setIsSaved(bool saved) {
    _isSaved = saved;
    notifyListeners();
  }

  Future<void> fetchClasses() async {
    _isLoadingClasses = true;
    _error = null;
    notifyListeners();

    try {
      final res = await ApiClient.get('/teacher/my-profile');
      final profile = TeacherProfile.fromJson(res.data);

      _classes = [];
      if (profile.classTeacher != null) {
        _classes.add(profile.classTeacher!.classInfo);
        _selectedClassId = profile.classTeacher!.classInfo.id;
      }

      if (_selectedClassId != null) {
        await fetchStudents();
      }
    } catch (e) {
      _error = 'Failed to load classes: ${ApiClient.errorMessage(e)}';
    } finally {
      _isLoadingClasses = false;
      notifyListeners();
    }
  }

  Future<void> fetchStudents() async {
    if (_selectedClassId == null) return;

    _isLoadingStudents = true;
    _error = null;
    _students = [];
    _attendanceMap = {};
    _isSaved = false;
    notifyListeners();

    try {
      final response = await ApiClient.get('/students', params: {
        'classId': _selectedClassId,
        'limit': 200,
      });
      final List data = response.data['students'] ?? [];
      _students = data.map((json) => Student.fromJson(json)).toList();

      // Default to present
      for (var student in _students) {
        _attendanceMap[student.id] = {'status': 'present', 'remarks': ''};
      }

      await fetchExistingAttendance();
    } catch (e) {
      _error = 'Failed to load students: ${ApiClient.errorMessage(e)}';
    } finally {
      _isLoadingStudents = false;
      notifyListeners();
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

      final attendanceList = response.data['attendance'] as List?;
      bool alreadySaved = false;
      if (attendanceList != null && attendanceList.isNotEmpty) {
        final existingRecord = attendanceList.first;
        final records = existingRecord['records'] as List?;
        if (records != null && records.isNotEmpty) {
          alreadySaved = true;
          for (var r in records) {
            final studentData = r['student'];
            final studentId =
                studentData is Map ? studentData['_id'] : studentData;

            if (studentId != null) {
              _attendanceMap[studentId.toString()] = {
                'status': r['status'] ?? 'present',
                'remarks': r['remarks'] ?? '',
              };
            }
          }
        }
      }
      _isSaved = alreadySaved;
    } catch (e) {
      debugPrint('No existing attendance or error: $e');
    }
    notifyListeners();
  }

  Future<bool> saveAttendance() async {
    if (_selectedClassId == null || _students.isEmpty) return false;

    _isSaving = true;
    notifyListeners();

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
      notifyListeners();
    }
  }
}
