import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:dio/dio.dart';

import '../../../../core/network/api_client.dart';
import '../../../../core/network/api_endpoints.dart';
import '../../../../core/models/teacher_profile.dart';
import '../../../../core/models/student.dart';

// ── Dropdown option models ────────────────────────────────────────────────────

class ClassOption {
  final String id;
  final String name;
  final String? section;
  ClassOption({required this.id, required this.name, this.section});
  String get displayName =>
      (section != null && section!.isNotEmpty) ? '$name $section' : name;
  factory ClassOption.fromJson(Map<String, dynamic> j) => ClassOption(
        id: j['_id']?.toString() ?? '',
        name: j['name']?.toString() ?? '',
        section: j['section']?.toString(),
      );
}

class SubjectOption {
  final String id;
  final String name;
  final String? code;
  SubjectOption({required this.id, required this.name, this.code});
  factory SubjectOption.fromJson(Map<String, dynamic> j) => SubjectOption(
        id: j['_id']?.toString() ?? '',
        name: j['name']?.toString() ?? '',
        code: j['code']?.toString(),
      );
}

// ── Draft model for create / edit schedule entries ────────────────────────────

class ScheduleEntryDraft {
  String classId;
  String subjectId;
  String className;
  String subjectName;
  int maxMarks;
  int passingMarks;
  DateTime? date;

  ScheduleEntryDraft({
    required this.classId,
    required this.subjectId,
    required this.className,
    required this.subjectName,
    this.maxMarks = 100,
    this.passingMarks = 35,
    this.date,
  });
}

// ── Exam list models ──────────────────────────────────────────────────────────

class ExamInfo {
  final String id;
  final String name;
  final String type;
  final String academicYear;
  final String status;
  final bool isResultPublished;
  final DateTime? examDate;
  final List<String> classIds;
  final List<ExamScheduleEntry> schedule;

  ExamInfo({
    required this.id,
    required this.name,
    this.type = 'unit_test',
    required this.academicYear,
    required this.status,
    required this.isResultPublished,
    this.examDate,
    required this.classIds,
    required this.schedule,
  });

  factory ExamInfo.fromJson(Map<String, dynamic> j) {
    final schedule = (j['schedule'] as List? ?? [])
        .map((s) => ExamScheduleEntry.fromJson(s as Map<String, dynamic>))
        .toList();

    final classIds = (j['classes'] as List? ?? []).map((c) {
      if (c is Map) return c['_id']?.toString() ?? '';
      return c.toString();
    }).where((id) => id.isNotEmpty).toList();

    return ExamInfo(
      id: j['_id']?.toString() ?? '',
      name: j['name']?.toString() ?? '',
      type: j['type']?.toString() ?? 'unit_test',
      academicYear: j['academicYear']?.toString() ?? '',
      status: j['status']?.toString() ?? 'scheduled',
      isResultPublished: j['isResultPublished'] == true,
      examDate: j['examDate'] != null
          ? DateTime.tryParse(j['examDate'].toString())
          : null,
      classIds: classIds,
      schedule: schedule,
    );
  }
}

class ExamScheduleEntry {
  final String? classId;
  final String? className;
  final String? section;
  final String? subjectId;
  final String? subjectName;
  final int maxMarks;
  final int passingMarks;
  final DateTime? date;

  ExamScheduleEntry({
    this.classId,
    this.className,
    this.section,
    this.subjectId,
    this.subjectName,
    required this.maxMarks,
    required this.passingMarks,
    this.date,
  });

  String get classFullName => (section != null && section!.isNotEmpty)
      ? '$className $section'
      : (className ?? '');

  factory ExamScheduleEntry.fromJson(Map<String, dynamic> j) {
    final cls = j['class'];
    final subj = j['subject'];
    return ExamScheduleEntry(
      classId: cls is Map ? cls['_id']?.toString() : cls?.toString(),
      className: cls is Map ? cls['name']?.toString() : null,
      section: cls is Map ? cls['section']?.toString() : null,
      subjectId: subj is Map ? subj['_id']?.toString() : subj?.toString(),
      subjectName: subj is Map ? subj['name']?.toString() : null,
      maxMarks: (j['maxMarks'] as num?)?.toInt() ?? 100,
      passingMarks: (j['passingMarks'] as num?)?.toInt() ?? 35,
      date:
          j['date'] != null ? DateTime.tryParse(j['date'].toString()) : null,
    );
  }
}

// ── Marks entry model ─────────────────────────────────────────────────────────

class ExamMarkEntry {
  double theoryMarks;
  double practicalMarks;
  bool isAbsent;
  String remarks;
  String? answerPaperUrl;
  String? answerPaperFileName;

  ExamMarkEntry({
    this.theoryMarks = 0,
    this.practicalMarks = 0,
    this.isAbsent = false,
    this.remarks = '',
    this.answerPaperUrl,
    this.answerPaperFileName,
  });

  ExamMarkEntry copyWith({
    double? theoryMarks,
    double? practicalMarks,
    bool? isAbsent,
    String? remarks,
    String? answerPaperUrl,
    String? answerPaperFileName,
  }) =>
      ExamMarkEntry(
        theoryMarks: theoryMarks ?? this.theoryMarks,
        practicalMarks: practicalMarks ?? this.practicalMarks,
        isAbsent: isAbsent ?? this.isAbsent,
        remarks: remarks ?? this.remarks,
        answerPaperUrl: answerPaperUrl ?? this.answerPaperUrl,
        answerPaperFileName: answerPaperFileName ?? this.answerPaperFileName,
      );
}

// ── Results models ────────────────────────────────────────────────────────────

class SubjectMark {
  final String subjectName;
  final double theoryMarks;
  final double practicalMarks;
  final double totalMarks;
  final double maxMarks;
  final String grade;
  final bool isAbsent;

  SubjectMark({
    required this.subjectName,
    required this.theoryMarks,
    required this.practicalMarks,
    required this.totalMarks,
    required this.maxMarks,
    required this.grade,
    required this.isAbsent,
  });

  factory SubjectMark.fromJson(Map<String, dynamic> j) {
    final subj = j['subject'];
    return SubjectMark(
      subjectName: subj is Map ? subj['name']?.toString() ?? '' : '',
      theoryMarks: (j['theoryMarks'] as num?)?.toDouble() ?? 0,
      practicalMarks: (j['practicalMarks'] as num?)?.toDouble() ?? 0,
      totalMarks: (j['totalMarks'] as num?)?.toDouble() ?? 0,
      maxMarks: (j['maxMarks'] as num?)?.toDouble() ?? 100,
      grade: j['grade']?.toString() ?? '',
      isAbsent: j['isAbsent'] == true,
    );
  }
}

class ExamStudentResult {
  final String studentId;
  final String studentName;
  final String? admissionNumber;
  final int? rollNumber;
  final double totalMarksObtained;
  final double totalMaxMarks;
  final double percentage;
  final String grade;
  final int rank;
  final List<SubjectMark> marks;

  ExamStudentResult({
    required this.studentId,
    required this.studentName,
    this.admissionNumber,
    this.rollNumber,
    required this.totalMarksObtained,
    required this.totalMaxMarks,
    required this.percentage,
    required this.grade,
    required this.rank,
    required this.marks,
  });

  factory ExamStudentResult.fromJson(Map<String, dynamic> j) {
    final student = j['student'] as Map<String, dynamic>? ?? {};
    final marksList = (j['marks'] as List? ?? [])
        .map((m) => SubjectMark.fromJson(m as Map<String, dynamic>))
        .toList();
    return ExamStudentResult(
      studentId: student['_id']?.toString() ?? '',
      studentName: student['name']?.toString() ?? '',
      admissionNumber: student['admissionNumber']?.toString(),
      rollNumber: (student['rollNumber'] as num?)?.toInt(),
      totalMarksObtained: (j['totalMarksObtained'] as num?)?.toDouble() ?? 0,
      totalMaxMarks: (j['totalMaxMarks'] as num?)?.toDouble() ?? 0,
      percentage: (j['percentage'] as num?)?.toDouble() ?? 0,
      grade: j['grade']?.toString() ?? '',
      rank: (j['rank'] as num?)?.toInt() ?? 0,
      marks: marksList,
    );
  }
}

// ── Provider ──────────────────────────────────────────────────────────────────

class ExamsProvider extends ChangeNotifier {
  // ── Loading states ──────────────────────────────────────────────────────────
  bool _isLoading = true; // skeleton visible from frame 1
  bool get isLoading => _isLoading;

  // Called once from ChangeNotifierProvider.create — chains profile → data
  Future<void> initialize() async {
    await fetchProfile();
    if (!_disposed) fetchExams();
  }

  bool _disposed = false;

  @override
  void dispose() {
    _disposed = true;
    super.dispose();
  }

  bool _isSaving = false;
  bool get isSaving => _isSaving;

  bool _isLoadingStudents = false;
  bool get isLoadingStudents => _isLoadingStudents;

  bool _isActionLoading = false;
  bool get isActionLoading => _isActionLoading;

  bool _isMetaLoading = false;
  bool get isMetaLoading => _isMetaLoading;

  bool _isResultsLoading = false;
  bool get isResultsLoading => _isResultsLoading;

  String? _error;
  String? get error => _error;

  // ── Exam list ───────────────────────────────────────────────────────────────
  List<ExamInfo> _exams = [];
  List<ExamInfo> get exams => _exams;

  // ── Teacher profile ─────────────────────────────────────────────────────────
  bool _isClassTeacher = false;
  bool get isClassTeacher => _isClassTeacher;

  bool _isSubjectTeacher = false;
  bool get isSubjectTeacher => _isSubjectTeacher;

  ClassTeacherInfo? _classTeacherInfo;
  ClassTeacherInfo? get classTeacherInfo => _classTeacherInfo;

  List<SubjectTeacherInfo> _subjectAssignments = [];
  List<SubjectTeacherInfo> get subjectAssignments => _subjectAssignments;

  TeacherPermissions? _permissions;

  bool get canEnterMarks {
    final p = _permissions;
    // Optimistic: allow until profile loads (avoids false "no permission" flash)
    if (p == null) return true;
    return (_isClassTeacher && p.classTeacher.viewAndEnterExamMarks) ||
        (_isSubjectTeacher && p.subjectTeacher.enterExamMarks);
  }

  bool get hasAnyPermission => _isClassTeacher || _isSubjectTeacher;

  // ── Marks entry ─────────────────────────────────────────────────────────────
  List<Student> _students = [];
  List<Student> get students => _students;

  Map<String, ExamMarkEntry> _marksMap = {};
  Map<String, ExamMarkEntry> get marksMap => _marksMap;

  // ── Dropdown metadata for create/edit forms ─────────────────────────────────
  List<ClassOption> _availableClasses = [];
  List<ClassOption> get availableClasses => _availableClasses;

  List<SubjectOption> _availableSubjects = [];
  List<SubjectOption> get availableSubjects => _availableSubjects;

  // ── Results view ─────────────────────────────────────────────────────────────
  List<ExamStudentResult> _results = [];
  List<ExamStudentResult> get results => _results;

  bool _profileLoaded = false;

  // ── Profile ──────────────────────────────────────────────────────────────────

  Future<void> fetchProfile() async {
    if (_profileLoaded) return;
    try {
      final res = await ApiClient.get('/teacher/my-profile');
      final profile =
          TeacherProfile.fromJson(res.data as Map<String, dynamic>);
      _isClassTeacher = profile.isClassTeacher;
      _isSubjectTeacher = profile.isSubjectTeacher;
      _classTeacherInfo = profile.classTeacher;
      _subjectAssignments = profile.subjectTeacher;
      _permissions = profile.permissions;
      _profileLoaded = true;
      notifyListeners();
    } catch (e) {
      debugPrint('ExamsProvider profile error: $e');
    }
  }

  // ── Fetch exams ───────────────────────────────────────────────────────────────

  Future<void> fetchExams({String? status}) async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      final params = <String, dynamic>{};
      if (status != null && status.isNotEmpty) params['status'] = status;

      final res = await ApiClient.get(ApiEndpoints.exams,
          params: params.isNotEmpty ? params : null);
      final List data = (res.data as Map?)?['exams'] as List? ?? [];
      _exams =
          data.map((e) => ExamInfo.fromJson(e as Map<String, dynamic>)).toList();
    } catch (e) {
      _error = ApiClient.errorMessage(e);
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  // ── Teacher schedule filter ───────────────────────────────────────────────────

  List<ExamScheduleEntry> getScheduleForTeacher(ExamInfo exam) {
    final seen = <String>{};
    final result = <ExamScheduleEntry>[];

    void addIfNew(ExamScheduleEntry e) {
      final key = '${e.classId}_${e.subjectId}';
      if (e.classId == null || e.subjectId == null) return;
      if (seen.contains(key)) return;
      seen.add(key);
      result.add(e);
    }

    if (_isClassTeacher && _classTeacherInfo != null) {
      final myClassId = _classTeacherInfo!.classInfo.id;
      for (final s in exam.schedule) {
        if (s.classId == myClassId) addIfNew(s);
      }
    }

    if (_isSubjectTeacher) {
      for (final a in _subjectAssignments) {
        for (final s in exam.schedule) {
          if (s.classId == a.classInfo.id && s.subjectId == a.subject.id) {
            addIfNew(s);
          }
        }
      }
    }

    return result;
  }

  /// Subject IDs this teacher owns (e.g. a Physics teacher → {physicsId}).
  /// Derived from their subject-teacher assignments across all classes.
  Set<String> get ownedSubjectIds => _subjectAssignments
      .map((a) => a.subject.id)
      .where((id) => id.isNotEmpty)
      .toSet();

  bool canEnterMarksForEntry(ExamScheduleEntry entry) {
    if (!canEnterMarks) return false;
    // Optimistic while profile is still loading — show all entries
    if (_permissions == null) return true;
    // Priority 1 — teacher has owned subjects (e.g. Physics teacher).
    // Show ONLY their subjects across every class in the exam, regardless
    // of whether they are also the class teacher. This ensures a Physics
    // teacher who is also class-teacher for 7A sees:
    //   Physics · Class 7A, Physics · Class 10A …  (not all 7A subjects).
    if (ownedSubjectIds.isNotEmpty) {
      return entry.subjectId != null &&
          ownedSubjectIds.contains(entry.subjectId);
    }
    // Priority 2 — pure class teacher (no explicit subject assignments).
    // Show every subject scheduled for their class.
    if (_isClassTeacher && _classTeacherInfo != null) {
      return entry.classId == _classTeacherInfo!.classInfo.id;
    }
    return false;
  }

  bool canViewResultsForClass(ExamInfo exam, String classId) {
    if (_permissions == null) return true;
    // Teacher with owned subjects — can view results for any class where
    // their subject is scheduled in this exam.
    if (ownedSubjectIds.isNotEmpty) {
      return exam.schedule.any((s) =>
          s.classId == classId &&
          s.subjectId != null &&
          ownedSubjectIds.contains(s.subjectId));
    }
    // Pure class teacher — view results for their own class only.
    if (_isClassTeacher && _classTeacherInfo != null) {
      return _classTeacherInfo!.classInfo.id == classId;
    }
    return false;
  }

  // ── Marks entry ───────────────────────────────────────────────────────────────

  Future<void> fetchStudentsAndResults(
    String classId,
    String examId,
    String subjectId,
  ) async {
    _isLoadingStudents = true;
    _students = [];
    _marksMap = {};
    _error = null;

    // Defer the first notification so setState in the caller processes first,
    // preventing the detail view from rebuilding with cleared state mid-frame.
    await Future.microtask(() => notifyListeners());

    try {
      final studRes = await ApiClient.get(
        ApiEndpoints.students,
        params: {'classId': classId, 'limit': 300},
      );
      final List studData =
          (studRes.data as Map?)?['students'] as List? ?? [];
      _students = studData
          .map((j) => Student.fromJson(j as Map<String, dynamic>))
          .toList();
      _marksMap = {for (final s in _students) s.id: ExamMarkEntry()};

      final resRes = await ApiClient.get(
        ApiEndpoints.examResults,
        params: {'examId': examId, 'classId': classId},
      );
      final List results = (resRes.data as Map?)?['results'] as List? ?? [];

      for (final r in results) {
        final rMap = r as Map<String, dynamic>;
        final raw = rMap['student'];
        final studentId =
            raw is Map ? raw['_id']?.toString() : raw?.toString();
        if (studentId == null || !_marksMap.containsKey(studentId)) continue;

        final marks = rMap['marks'] as List? ?? [];
        for (final m in marks) {
          final mMap = m as Map<String, dynamic>;
          final rawSubj = mMap['subject'];
          final mSubjId =
              rawSubj is Map ? rawSubj['_id']?.toString() : rawSubj?.toString();
          if (mSubjId != subjectId) continue;
          final paper = mMap['answerPaper'] as Map?;
          _marksMap[studentId] = ExamMarkEntry(
            theoryMarks: (mMap['theoryMarks'] as num?)?.toDouble() ?? 0,
            practicalMarks: (mMap['practicalMarks'] as num?)?.toDouble() ?? 0,
            isAbsent: mMap['isAbsent'] == true,
            remarks: mMap['remarks']?.toString() ?? '',
            answerPaperUrl: paper?['url']?.toString(),
            answerPaperFileName: paper?['fileName']?.toString(),
          );
          break;
        }
      }
    } catch (e) {
      _error = ApiClient.errorMessage(e);
    } finally {
      _isLoadingStudents = false;
      notifyListeners();
    }
  }

  void updateMark(
    String studentId, {
    double? theory,
    double? practical,
    bool? absent,
    String? remarks,
  }) {
    final entry = _marksMap[studentId];
    if (entry == null) return;
    _marksMap[studentId] = entry.copyWith(
      theoryMarks: theory,
      practicalMarks: practical,
      isAbsent: absent,
      remarks: remarks,
    );
    notifyListeners();
  }

  Future<bool> saveMarks(
      String examId, String classId, String subjectId) async {
    _isSaving = true;
    _error = null;
    await Future.microtask(() => notifyListeners());

    try {
      final marksData = _students.map((s) {
        final m = _marksMap[s.id] ?? ExamMarkEntry();
        return {
          'studentId': s.id,
          'theoryMarks': m.isAbsent ? 0 : m.theoryMarks,
          'practicalMarks': m.isAbsent ? 0 : m.practicalMarks,
          'isAbsent': m.isAbsent,
          'remarks': m.remarks,
        };
      }).toList();

      await ApiClient.post(ApiEndpoints.examMarks, data: {
        'examId': examId,
        'classId': classId,
        'subjectId': subjectId,
        'marksData': marksData,
      });
      return true;
    } catch (e) {
      _error = ApiClient.errorMessage(e);
      return false;
    } finally {
      _isSaving = false;
      notifyListeners();
    }
  }

  Future<bool> uploadAnswerPaper({
    required String examId,
    required String classId,
    required String studentId,
    required String subjectId,
    String? filePath,
    required String fileName,
    Uint8List? bytes,
  }) async {
    if (filePath == null && bytes == null) return false;
    _isActionLoading = true;
    _error = null;
    notifyListeners();
    try {
      final MultipartFile multipart = filePath != null
          ? await MultipartFile.fromFile(filePath, filename: fileName)
          : MultipartFile.fromBytes(bytes!, filename: fileName);
      final formData = FormData.fromMap({
        'examId': examId,
        'classId': classId,
        'studentId': studentId,
        'subjectId': subjectId,
        'answerPaper': multipart,
      });

      final res = await ApiClient.post(ApiEndpoints.examAnswerPaper, data: formData);
      final resultData = (res.data as Map)['result'] as Map?;
      if (resultData != null) {
        final marksList = resultData['marks'] as List? ?? [];
        final updatedMark = marksList.firstWhere(
            (m) => (m['subject'] is Map ? m['subject']['_id'] : m['subject']).toString() == subjectId,
            orElse: () => null);
        
        if (updatedMark != null) {
          final paper = updatedMark['answerPaper'] as Map?;
          final entry = _marksMap[studentId];
          if (entry != null) {
            _marksMap[studentId] = entry.copyWith(
              answerPaperUrl: paper?['url']?.toString(),
              answerPaperFileName: paper?['fileName']?.toString(),
            );
          }
        }
      }
      return true;
    } catch (e) {
      _error = ApiClient.errorMessage(e);
      return false;
    } finally {
      _isActionLoading = false;
      notifyListeners();
    }
  }

  // ── Metadata for create/edit form ─────────────────────────────────────────────

  Future<void> fetchClassesAndSubjects() async {
    if (_availableClasses.isNotEmpty && _availableSubjects.isNotEmpty) return;
    _isMetaLoading = true;
    await Future.microtask(() => notifyListeners());
    try {
      final responses = await Future.wait([
        ApiClient.get(ApiEndpoints.classes),
        ApiClient.get(ApiEndpoints.subjects),
      ]);
      final classData = responses[0].data;
      final subjData = responses[1].data;

      List asList(dynamic d, String key) {
        if (d is Map) return d[key] as List? ?? d['data'] as List? ?? [];
        return d as List? ?? [];
      }

      _availableClasses = asList(classData, 'classes')
          .map((c) => ClassOption.fromJson(c as Map<String, dynamic>))
          .where((c) => c.id.isNotEmpty)
          .toList();

      _availableSubjects = asList(subjData, 'subjects')
          .map((s) => SubjectOption.fromJson(s as Map<String, dynamic>))
          .where((s) => s.id.isNotEmpty)
          .toList();
    } catch (e) {
      debugPrint('fetchClassesAndSubjects error: $e');
    } finally {
      _isMetaLoading = false;
      notifyListeners();
    }
  }

  // ── Create exam ───────────────────────────────────────────────────────────────

  Future<bool> createExam({
    required String name,
    required String type,
    required String status,
    DateTime? examDate,
    required List<ScheduleEntryDraft> schedule,
  }) async {
    _isActionLoading = true;
    _error = null;
    notifyListeners();
    try {
      final classes = schedule.map((s) => s.classId).toSet().toList();
      final scheduleData = schedule.map((s) => {
            'class': s.classId,
            'subject': s.subjectId,
            'maxMarks': s.maxMarks,
            'passingMarks': s.passingMarks,
            if (s.date != null) 'date': s.date!.toIso8601String(),
          }).toList();

      await ApiClient.post(ApiEndpoints.exams, data: {
        'name': name,
        'type': type,
        'status': status,
        'classes': classes,
        'schedule': scheduleData,
        if (examDate != null) 'examDate': examDate.toIso8601String(),
      });
      await fetchExams();
      return true;
    } catch (e) {
      _error = ApiClient.errorMessage(e);
      return false;
    } finally {
      _isActionLoading = false;
      notifyListeners();
    }
  }

  // ── Update exam ───────────────────────────────────────────────────────────────

  Future<bool> updateExam(
    String id, {
    required String name,
    required String type,
    required String status,
    DateTime? examDate,
    required List<ScheduleEntryDraft> schedule,
  }) async {
    _isActionLoading = true;
    _error = null;
    notifyListeners();
    try {
      final classes = schedule.map((s) => s.classId).toSet().toList();
      final scheduleData = schedule.map((s) => {
            'class': s.classId,
            'subject': s.subjectId,
            'maxMarks': s.maxMarks,
            'passingMarks': s.passingMarks,
            if (s.date != null) 'date': s.date!.toIso8601String(),
          }).toList();

      await ApiClient.put(ApiEndpoints.examById(id), data: {
        'name': name,
        'type': type,
        'status': status,
        'classes': classes,
        'schedule': scheduleData,
        if (examDate != null) 'examDate': examDate.toIso8601String(),
      });
      await fetchExams();
      return true;
    } catch (e) {
      _error = ApiClient.errorMessage(e);
      return false;
    } finally {
      _isActionLoading = false;
      notifyListeners();
    }
  }

  // ── Delete exam ───────────────────────────────────────────────────────────────

  Future<bool> deleteExam(String id) async {
    _isActionLoading = true;
    _error = null;
    notifyListeners();
    try {
      await ApiClient.delete(ApiEndpoints.examById(id));
      _exams.removeWhere((e) => e.id == id);
      return true;
    } catch (e) {
      _error = ApiClient.errorMessage(e);
      return false;
    } finally {
      _isActionLoading = false;
      notifyListeners();
    }
  }

  // ── Publish results ───────────────────────────────────────────────────────────

  Future<bool> publishResults(String examId) async {
    _isActionLoading = true;
    _error = null;
    notifyListeners();
    try {
      await ApiClient.post(ApiEndpoints.examPublish(examId));
      final idx = _exams.indexWhere((e) => e.id == examId);
      if (idx >= 0) {
        final e = _exams[idx];
        _exams[idx] = ExamInfo(
          id: e.id,
          name: e.name,
          type: e.type,
          academicYear: e.academicYear,
          status: 'completed',
          isResultPublished: true,
          examDate: e.examDate,
          classIds: e.classIds,
          schedule: e.schedule,
        );
      }
      return true;
    } catch (e) {
      _error = ApiClient.errorMessage(e);
      return false;
    } finally {
      _isActionLoading = false;
      notifyListeners();
    }
  }

  // ── Fetch exam results ────────────────────────────────────────────────────────

  Future<void> fetchExamResults(String examId, {String? classId}) async {
    _isResultsLoading = true;
    _results = [];
    _error = null;
    await Future.microtask(() => notifyListeners());
    try {
      final params = <String, dynamic>{'examId': examId};
      if (classId != null) params['classId'] = classId;
      final res =
          await ApiClient.get(ApiEndpoints.examResults, params: params);
      final List data = (res.data as Map?)?['results'] as List? ?? [];
      _results = data
          .map((r) => ExamStudentResult.fromJson(r as Map<String, dynamic>))
          .toList()
        ..sort((a, b) => a.rank.compareTo(b.rank));
    } catch (e) {
      _error = ApiClient.errorMessage(e);
    } finally {
      _isResultsLoading = false;
      notifyListeners();
    }
  }
}
