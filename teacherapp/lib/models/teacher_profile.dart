class TeacherProfile {
  final EmployeeInfo employee;
  final ClassTeacherInfo? classTeacher;
  final List<SubjectTeacherInfo> subjectTeacher;
  final TeacherPermissions permissions;
  final bool isClassTeacher;
  final bool isSubjectTeacher;

  TeacherProfile({
    required this.employee,
    this.classTeacher,
    required this.subjectTeacher,
    required this.permissions,
    required this.isClassTeacher,
    required this.isSubjectTeacher,
  });

  factory TeacherProfile.fromJson(Map<String, dynamic> j) => TeacherProfile(
    employee: EmployeeInfo.fromJson(j['employee'] ?? {}),
    classTeacher: j['classTeacher'] != null
        ? ClassTeacherInfo.fromJson(j['classTeacher'])
        : null,
    subjectTeacher: (j['subjectTeacher'] as List? ?? [])
        .map((e) => SubjectTeacherInfo.fromJson(e))
        .toList(),
    permissions: TeacherPermissions.fromJson(j['permissions'] ?? {}),
    isClassTeacher: j['isClassTeacher'] ?? false,
    isSubjectTeacher: j['isSubjectTeacher'] ?? false,
  );
}

class EmployeeInfo {
  final String id;
  final String name;
  final String? employeeId;
  final String? designation;
  final String? photo;
  final String? department;

  EmployeeInfo({
    required this.id, required this.name, this.employeeId,
    this.designation, this.photo, this.department,
  });

  factory EmployeeInfo.fromJson(Map<String, dynamic> j) => EmployeeInfo(
    id: j['_id'] ?? '',
    name: j['name'] ?? '',
    employeeId: j['employeeId'],
    designation: j['designation'],
    photo: j['photo'],
    department: j['department'],
  );
}

class ClassTeacherInfo {
  final ClassInfo classInfo;

  ClassTeacherInfo({required this.classInfo});

  factory ClassTeacherInfo.fromJson(Map<String, dynamic> j) => ClassTeacherInfo(
    classInfo: ClassInfo.fromJson(j['class'] ?? {}),
  );
}

class ClassInfo {
  final String id;
  final String name;
  final String? section;
  final List<SubjectInfo> subjects;

  ClassInfo({required this.id, required this.name, this.section, this.subjects = const []});

  String get fullName => section != null && section!.isNotEmpty ? '$name $section' : name;

  factory ClassInfo.fromJson(Map<String, dynamic> j) => ClassInfo(
    id: j['_id'] ?? '',
    name: j['name'] ?? '',
    section: j['section'],
    subjects: (j['subjects'] as List? ?? [])
        .map((s) => SubjectInfo.fromJson(s))
        .toList(),
  );
}

class SubjectInfo {
  final String id;
  final String name;
  final String? code;
  final String? color;

  SubjectInfo({required this.id, required this.name, this.code, this.color});

  factory SubjectInfo.fromJson(Map<String, dynamic> j) => SubjectInfo(
    id: j['_id'] ?? '',
    name: j['name'] ?? '',
    code: j['code'],
    color: j['color'],
  );
}

class SubjectTeacherInfo {
  final ClassInfo classInfo;
  final SubjectInfo subject;

  SubjectTeacherInfo({required this.classInfo, required this.subject});

  factory SubjectTeacherInfo.fromJson(Map<String, dynamic> j) => SubjectTeacherInfo(
    classInfo: ClassInfo.fromJson(j['class'] ?? {}),
    subject: SubjectInfo.fromJson(j['subject'] ?? {}),
  );
}

class TeacherPermissions {
  final ClassTeacherPerms classTeacher;
  final SubjectTeacherPerms subjectTeacher;

  TeacherPermissions({required this.classTeacher, required this.subjectTeacher});

  factory TeacherPermissions.fromJson(Map<String, dynamic> j) => TeacherPermissions(
    classTeacher: ClassTeacherPerms.fromJson(j['classTeacher'] ?? {}),
    subjectTeacher: SubjectTeacherPerms.fromJson(j['subjectTeacher'] ?? {}),
  );
}

class ClassTeacherPerms {
  final bool markStudentAttendance;
  final bool markOwnAttendance;
  final bool viewStudents;
  final bool viewFeeStatus;
  final bool assignHomework;
  final bool viewAndEnterExamMarks;
  final bool viewTimetable;

  ClassTeacherPerms({
    this.markStudentAttendance = true,
    this.markOwnAttendance = true,
    this.viewStudents = true,
    this.viewFeeStatus = true,
    this.assignHomework = true,
    this.viewAndEnterExamMarks = true,
    this.viewTimetable = true,
  });

  factory ClassTeacherPerms.fromJson(Map<String, dynamic> j) => ClassTeacherPerms(
    markStudentAttendance: j['markStudentAttendance'] ?? true,
    markOwnAttendance: j['markOwnAttendance'] ?? true,
    viewStudents: j['viewStudents'] ?? true,
    viewFeeStatus: j['viewFeeStatus'] ?? true,
    assignHomework: j['assignHomework'] ?? true,
    viewAndEnterExamMarks: j['viewAndEnterExamMarks'] ?? true,
    viewTimetable: j['viewTimetable'] ?? true,
  );
}

class SubjectTeacherPerms {
  final bool markOwnAttendance;
  final bool assignHomework;
  final bool viewSubjectStudents;
  final bool enterExamMarks;
  final bool viewTimetable;

  SubjectTeacherPerms({
    this.markOwnAttendance = true,
    this.assignHomework = true,
    this.viewSubjectStudents = true,
    this.enterExamMarks = true,
    this.viewTimetable = true,
  });

  factory SubjectTeacherPerms.fromJson(Map<String, dynamic> j) => SubjectTeacherPerms(
    markOwnAttendance: j['markOwnAttendance'] ?? true,
    assignHomework: j['assignHomework'] ?? true,
    viewSubjectStudents: j['viewSubjectStudents'] ?? true,
    enterExamMarks: j['enterExamMarks'] ?? true,
    viewTimetable: j['viewTimetable'] ?? true,
  );
}
