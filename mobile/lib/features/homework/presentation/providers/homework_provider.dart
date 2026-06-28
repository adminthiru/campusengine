import 'package:flutter/material.dart';
import '../../../../core/network/api_client.dart';
import '../../../../core/network/api_endpoints.dart';
import '../../../../core/models/homework.dart';
import '../../../../core/models/teacher_profile.dart';
import '../../../../core/models/student.dart';

class HomeworkProvider extends ChangeNotifier {
  bool _disposed = false;

  @override
  void dispose() {
    _disposed = true;
    super.dispose();
  }

  void _notify() {
    if (!_disposed) notifyListeners();
  }

  bool _isLoading = true; // skeleton visible from frame 1
  bool get isLoading => _isLoading;

  // Called once from ChangeNotifierProvider.create — chains profile → data
  Future<void> initialize() async {
    await fetchProfile();
    if (!_disposed) fetchHomework();
  }

  bool _isSaving = false;
  bool get isSaving => _isSaving;

  String? _error;
  String? get error => _error;

  List<Homework> _homeworkList = [];
  List<Homework> get homeworkList => _homeworkList;

  List<ClassInfo> _classes = [];
  List<ClassInfo> get classes => _classes;

  List<SubjectInfo> _subjects = [];
  List<SubjectInfo> get subjects => _subjects;

  // classId → subjects the teacher is allowed to assign homework for in that class
  final Map<String, List<SubjectInfo>> _classSubjectMap = {};

  // Subject IDs the teacher is explicitly assigned to teach (from subjectTeacher entries).
  // Empty means pure class teacher → no subject filter applied to the list.
  Set<String> _ownedSubjectIds = {};

  /// Subjects the teacher can assign homework for in the given class.
  /// Falls back to the flat _subjects list if no class-specific mapping exists.
  List<SubjectInfo> subjectsForClass(String classId) {
    if (classId.isEmpty) return _subjects;
    return _classSubjectMap[classId] ?? _subjects;
  }

  TeacherPermissions? _permissions;
  TeacherPermissions? get permissions => _permissions;

  bool _isClassTeacher = false;
  bool _isSubjectTeacher = false;

  bool get canManage {
    final p = _permissions;
    if (p == null) return true; // optimistic until profile loads
    return (_isClassTeacher && p.classTeacher.assignHomework) ||
        (_isSubjectTeacher && p.subjectTeacher.assignHomework);
  }

  Future<void> fetchProfile() async {
    try {
      final res = await ApiClient.get('/teacher/my-profile');
      final profile = TeacherProfile.fromJson(res.data);

      _permissions = profile.permissions;
      _isClassTeacher = profile.isClassTeacher;
      _isSubjectTeacher = profile.isSubjectTeacher;

      final classMap = <String, ClassInfo>{};
      final subjMap = <String, SubjectInfo>{};
      _classSubjectMap.clear();
      _ownedSubjectIds = {};

      // Step 1 — Subject teacher assignments (highest priority).
      // Build classId → [subjects this teacher teaches in that class].
      for (final st in profile.subjectTeacher) {
        classMap[st.classInfo.id] = st.classInfo;
        subjMap[st.subject.id] = st.subject;
        _ownedSubjectIds.add(st.subject.id);
        _classSubjectMap
            .putIfAbsent(st.classInfo.id, () => [])
            .add(st.subject);
      }

      // Step 2 — Class teacher assignment.
      // Only add all class subjects for this class if the teacher has NO
      // specific subject-teacher entry for it (pure class-teacher role).
      if (profile.classTeacher != null) {
        final ci = profile.classTeacher!.classInfo;
        classMap[ci.id] = ci;
        if (!_classSubjectMap.containsKey(ci.id)) {
          // Pure class teacher — can assign homework for every class subject.
          _classSubjectMap[ci.id] = ci.subjects;
          for (final s in ci.subjects) { subjMap[s.id] = s; }
        }
      }

      _classes = classMap.values.toList();
      _subjects = subjMap.values.toList();

      // Fallback: if still no subjects, fetch school-wide list.
      if (_subjects.isEmpty) {
        final subRes = await ApiClient.get(ApiEndpoints.subjects);
        final List sList = subRes.data['subjects'] ?? [];
        _subjects = sList.map((j) => SubjectInfo.fromJson(j)).toList();
      }

      _notify();
    } catch (e) {
      debugPrint('Error fetching profile: $e');
    }
  }

  Future<void> fetchHomework({String? classId, String? date, String? status}) async {
    _isLoading = true;
    _error = null;
    _notify();

    try {
      final queryParams = <String, dynamic>{};
      if (classId != null && classId != 'all') queryParams['classId'] = classId;
      if (date != null && date.isNotEmpty) queryParams['date'] = date;
      if (status != null && status.isNotEmpty) queryParams['status'] = status;

      final res = await ApiClient.get(ApiEndpoints.homework, params: queryParams);
      debugPrint('fetchHomework response: status=${res.statusCode} count=${(res.data['homework'] as List?)?.length}');
      final List data = res.data['homework'] ?? [];
      // Dedupe by id so the same homework can never appear twice in the list.
      final seen = <String>{};
      _homeworkList = data
          .map((j) => Homework.fromJson(j))
          .where((hw) => hw.id.isEmpty || seen.add(hw.id))
          .toList();

      // Filter to teacher's own subjects when they have explicit assignments.
      // Pure class teachers (_ownedSubjectIds empty) see all homework for their class.
      if (_ownedSubjectIds.isNotEmpty) {
        _homeworkList = _homeworkList.where((hw) {
          final sid = hw.subject?.id ?? '';
          return sid.isEmpty || _ownedSubjectIds.contains(sid);
        }).toList();
      }
      debugPrint('Parsed ${_homeworkList.length} homework items (subject filter: ${_ownedSubjectIds.isNotEmpty}).');
    } catch (e) {
      debugPrint('fetchHomework ERROR: $e');
      _error = ApiClient.errorMessage(e);
    } finally {
      _isLoading = false;
      _notify();
    }
  }

  Future<Homework?> fetchDetail(String id) async {
    _isLoading = true;
    _error = null;
    _notify();
    try {
      final res = await ApiClient.get(ApiEndpoints.homeworkById(id));
      final hw = Homework.fromJson(res.data['homework']);
      return hw;
    } catch (e) {
      _error = ApiClient.errorMessage(e);
      return null;
    } finally {
      _isLoading = false;
      _notify();
    }
  }

  Future<List<HwSubmission>> fetchSubmissions(String id) async {
    try {
      final res = await ApiClient.get(ApiEndpoints.homeworkSubmissions(id));
      final List data = res.data['submissions'] ?? [];
      return data.map((j) => HwSubmission.fromJson(j)).toList();
    } catch (e) {
      debugPrint('Error fetching submissions: $e');
      return [];
    }
  }
  
  Future<List<Student>> fetchStudents(String classId) async {
    try {
      final res = await ApiClient.get(ApiEndpoints.students, params: {'classId': classId, 'limit': 300});
      final List data = res.data['students'] ?? [];
      return data.map((j) => Student.fromJson(j)).toList();
    } catch (e) {
      debugPrint('Error fetching students: $e');
      return [];
    }
  }

  Future<bool> addHomework(Map<String, dynamic> payload) async {
    _isSaving = true;
    _error = null;
    _notify();
    try {
      await ApiClient.post(ApiEndpoints.homework, data: payload);
      return true;
    } catch (e) {
      _error = ApiClient.errorMessage(e);
      return false;
    } finally {
      _isSaving = false;
      _notify();
    }
  }

  Future<bool> editHomework(String id, Map<String, dynamic> payload) async {
    _isSaving = true;
    _error = null;
    _notify();
    try {
      await ApiClient.put(ApiEndpoints.homeworkById(id), data: payload);
      return true;
    } catch (e) {
      _error = ApiClient.errorMessage(e);
      return false;
    } finally {
      _isSaving = false;
      _notify();
    }
  }

  Future<bool> deleteHomework(String id) async {
    _isSaving = true;
    _error = null;
    _notify();
    try {
      await ApiClient.delete(ApiEndpoints.homeworkById(id));
      return true;
    } catch (e) {
      _error = ApiClient.errorMessage(e);
      return false;
    } finally {
      _isSaving = false;
      _notify();
    }
  }

  Future<bool> updateSubmissionStatus(String hwId, String studentId, String status) async {
    try {
      await ApiClient.put(ApiEndpoints.submissionUpdate(hwId, studentId), data: {'status': status});
      return true;
    } catch (e) {
      _error = ApiClient.errorMessage(e);
      return false;
    }
  }

  Future<bool> notifyParents(String hwId) async {
    try {
      await ApiClient.post(ApiEndpoints.homeworkNotify(hwId));
      return true;
    } catch (e) {
      _error = ApiClient.errorMessage(e);
      return false;
    }
  }
}
