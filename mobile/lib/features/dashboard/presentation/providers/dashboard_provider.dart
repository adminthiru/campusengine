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

      // 2. Fetch active homework scoped to teacher's class(es) + subjects
      final myOwnedSubjectIds =
          subjectTeachers.map((s) => s.subject.id).toSet();
      final myAllClassIds = <String>{
        if (classTeacher != null) classTeacher.classInfo.id,
        ...subjectTeachers.map((s) => s.classInfo.id),
      };

      // Pre-filter by classId on the API when possible (reduces response size)
      final hwParams = <String, dynamic>{'status': 'active'};
      if (classTeacher != null) hwParams['classId'] = classTeacher.classInfo.id;

      final hwRes = await ApiClient.get('/homework', params: hwParams);
      final hwData = hwRes.data is Map ? hwRes.data['homework'] : null;
      if (hwData is List) {
        final all = hwData.map((e) => Homework.fromJson(e)).toList();

        _activeHomework = all.where((hw) {
          final hwClassId = hw.classRef?.id ?? '';
          // Must be in one of this teacher's classes
          if (myAllClassIds.isNotEmpty &&
              !myAllClassIds.contains(hwClassId)) { return false; }
          // If teacher has explicit subject assignments, restrict to those subjects
          if (myOwnedSubjectIds.isNotEmpty) {
            final sid = hw.subject?.id ?? '';
            return sid.isEmpty || myOwnedSubjectIds.contains(sid);
          }
          // Pure class teacher: show all homework for their class
          return true;
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
