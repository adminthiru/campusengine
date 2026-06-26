import 'package:flutter/material.dart';
import 'package:skl_teacher/core/network/api_client.dart';
import 'package:skl_teacher/core/models/homework.dart';
import 'package:skl_teacher/core/models/teacher_profile.dart';

class DashboardProvider extends ChangeNotifier {
  bool _isLoading = false;
  bool get isLoading => _isLoading;

  String? _error;
  String? get error => _error;

  // Analytics data
  int _todayPresent = 0;
  int _todayAbsent = 0;
  int _todayTotal = 0;
  int get todayPresent => _todayPresent;
  int get todayAbsent => _todayAbsent;
  int get todayTotal => _todayTotal;

  // Active Homework for assigned class
  List<Homework> _activeHomework = [];
  List<Homework> get activeHomework => _activeHomework;

  Future<void> fetchDashboardData(TeacherProfile profile) async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      final classTeacher = profile.classTeacher;
      final subjectTeachers = profile.subjectTeacher;

      if (classTeacher != null) {
        final classId = classTeacher.classInfo.id;

        // 1. Fetch recent attendance
        final attRes = await ApiClient.get('/attendance', params: {
          'type': 'student',
          'classId': classId,
        });

        final attData = attRes.data is Map ? attRes.data['attendance'] : null;
        if (attData is List && attData.isNotEmpty) {
          final latestRecord =
              attData.first; // Most recent due to sort({date: -1})
          final records = (latestRecord is Map && latestRecord['records'] is List)
              ? latestRecord['records'] as List
              : const [];
          _todayTotal = records.length;
          _todayPresent =
              records.where((r) => r is Map && r['status'] == 'present').length;
          _todayAbsent =
              records.where((r) => r is Map && r['status'] == 'absent').length;
        }
      }

      // 2. Fetch homework
      // We will fetch all active homework and filter locally to homework for the teacher's classes or subjects.
      // Alternatively, we just fetch active homework for the class if they are only a class teacher.
      // Since backend doesn't filter by teacher currently, we'll fetch all and filter locally by matching subjects/classes.
      final hwRes = await ApiClient.get('/homework', params: {
        'status': 'active', // only active homework
      });

      final hwData = hwRes.data is Map ? hwRes.data['homework'] : null;
      if (hwData is List) {
        final allHomework = hwData.map((e) => Homework.fromJson(e)).toList();

        // Filter homework for this teacher:
        // Either they created it, or it's for their class, or it's for their subjects.
        final myClassId = classTeacher?.classInfo.id;
        final mySubjectIds = subjectTeachers.map((s) => s.subject.id).toSet();

        _activeHomework = allHomework.where((hw) {
          final isMyClass = hw.classRef?.id == myClassId;
          final isMySubject = mySubjectIds.contains(hw.subject?.id);
          // Assuming user ID is profile id, or we just rely on class/subject matches
          return isMyClass || isMySubject;
        }).toList();
      }

      // 3. Fetch Timetable for the Teacher
      final ttRes = await ApiClient.get('/timetable', params: {
        'teacherId': profile.employee.id,
      });

      final ttData = ttRes.data is Map ? ttRes.data['timetables'] : null;
      if (ttData is List) {
        _timetables = ttData;
      }
    } catch (e) {
      _error = e.toString();
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  // To store raw timetable data
  List<dynamic> _timetables = [];
  List<dynamic> get timetables => _timetables;
}
