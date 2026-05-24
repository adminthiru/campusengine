import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../../../core/network/api_client.dart';

class TeacherPeriod {
  final int periodNumber;
  final String subjectName;
  final String subjectColor;
  final String className;
  final String section;
  final String? room;
  final bool isBreak;
  final String? startTime;
  final String? endTime;

  TeacherPeriod({
    required this.periodNumber,
    required this.subjectName,
    required this.subjectColor,
    required this.className,
    required this.section,
    this.room,
    this.isBreak = false,
    this.startTime,
    this.endTime,
  });

  String get fullClassName => section.isNotEmpty ? '$className $section' : className;
}

class SubstitutionAssignment {
  final String id;
  final DateTime date;
  final int periodNumber;
  final String absentTeacherName;
  final String className;
  final String section;
  final String subjectName;
  final String subjectColor;
  final String note;

  SubstitutionAssignment({
    required this.id,
    required this.date,
    required this.periodNumber,
    required this.absentTeacherName,
    required this.className,
    required this.section,
    required this.subjectName,
    required this.subjectColor,
    required this.note,
  });

  String get fullClassName => section.isNotEmpty ? '$className $section' : className;
}

class TimetableProvider extends ChangeNotifier {
  bool _isLoading = false;
  bool get isLoading => _isLoading;

  String? _error;
  String? get error => _error;

  // Day of week -> List of regular periods
  Map<String, List<TeacherPeriod>> _timetable = {};
  Map<String, List<TeacherPeriod>> get timetable => _timetable;

  // Selected date's substitutions
  List<SubstitutionAssignment> _substitutions = [];
  List<SubstitutionAssignment> get substitutions => _substitutions;

  DateTime _selectedDate = DateTime.now();
  DateTime get selectedDate => _selectedDate;

  void selectDate(DateTime date, String teacherId) {
    _selectedDate = date;
    notifyListeners();
    fetchSubstitutions(teacherId, date);
  }

  Future<void> fetchTimetable(String teacherId) async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      final res = await ApiClient.get('/timetable', params: {
        'teacherId': teacherId,
      });

      final List rawTimetables = res.data['timetables'] ?? [];
      
      final Map<String, List<TeacherPeriod>> tempSchedule = {
        'monday': [],
        'tuesday': [],
        'wednesday': [],
        'thursday': [],
        'friday': [],
        'saturday': [],
        'sunday': [],
      };

      for (var tt in rawTimetables) {
        final classInfo = tt['class'];
        final className = classInfo != null ? (classInfo['name'] ?? '').toString() : '';
        final classSection = classInfo != null ? (classInfo['section'] ?? '').toString() : '';

        final schedule = tt['schedule'] as List? ?? [];
        for (var dayData in schedule) {
          final String day = (dayData['day'] ?? '').toString().toLowerCase();
          if (tempSchedule.containsKey(day)) {
            final periods = dayData['periods'] as List? ?? [];
            for (var p in periods) {
              if (p['isBreak'] == true) continue;
              
              final subject = p['subject'];
              final subjectName = subject != null ? (subject['name'] ?? '').toString() : 'Unknown';
              final subjectColor = subject != null ? (subject['color'] ?? '#1A56E8').toString() : '#1A56E8';

              tempSchedule[day]!.add(TeacherPeriod(
                periodNumber: p['periodNumber'] is int ? p['periodNumber'] : int.parse(p['periodNumber'].toString()),
                subjectName: subjectName,
                subjectColor: subjectColor,
                className: className,
                section: classSection,
                room: p['room'],
                startTime: p['startTime'],
                endTime: p['endTime'],
              ));
            }
          }
        }
      }

      // Sort periods by periodNumber for each day
      for (var day in tempSchedule.keys) {
        tempSchedule[day]!.sort((a, b) => a.periodNumber.compareTo(b.periodNumber));
      }

      _timetable = tempSchedule;
    } catch (e) {
      _error = 'Failed to load timetable: ${ApiClient.errorMessage(e)}';
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> fetchSubstitutions(String teacherId, DateTime date) async {
    final dateStr = DateFormat('yyyy-MM-dd').format(date);
    try {
      final res = await ApiClient.get('/timetable/substitutions', params: {
        'substituteTeacherId': teacherId,
        'date': dateStr,
      });

      final List rawSubstitutions = res.data['substitutions'] ?? [];
      
      _substitutions = rawSubstitutions.map((json) {
        final absentTeacher = json['absentTeacher'];
        final absentTeacherName = absentTeacher != null ? (absentTeacher['name'] ?? '').toString() : 'Absent Teacher';
        
        final classRef = json['classRef'];
        final className = classRef != null ? (classRef['name'] ?? '').toString() : '';
        final classSection = classRef != null ? (classRef['section'] ?? '').toString() : '';
        
        final subject = json['subject'];
        final subjectName = subject != null ? (subject['name'] ?? '').toString() : 'Unknown';
        final subjectColor = subject != null ? (subject['color'] ?? '#EF4444').toString() : '#EF4444';

        return SubstitutionAssignment(
          id: json['_id'] ?? '',
          date: DateTime.parse(json['date']),
          periodNumber: json['periodNumber'] is int ? json['periodNumber'] : int.parse(json['periodNumber'].toString()),
          absentTeacherName: absentTeacherName,
          className: className,
          section: classSection,
          subjectName: subjectName,
          subjectColor: subjectColor,
          note: json['note'] ?? '',
        );
      }).toList();
      
      notifyListeners();
    } catch (e) {
      debugPrint('Failed to load substitutions: $e');
    }
  }
}
