class Homework {
  final String id;
  final String title;
  final String? description;
  final String? assignedDate;
  final String? dueDate;
  final String status;
  final String assignedTo;
  final SubjectRef? subject;
  final ClassRef? classRef;
  final String? createdAt;
  final String? notifiedAt;
  final List<StudentRef> students;
  final UserRef? createdBy;

  Homework({
    required this.id,
    required this.title,
    this.description,
    this.assignedDate,
    this.dueDate,
    this.status = 'active',
    this.assignedTo = 'all',
    this.subject,
    this.classRef,
    this.createdAt,
    this.notifiedAt,
    this.students = const [],
    this.createdBy,
  });

  factory Homework.fromJson(Map<String, dynamic> j) => Homework(
    id: j['_id'] ?? '',
    title: j['title'] ?? '',
    description: j['description'],
    assignedDate: j['assignedDate'],
    dueDate: j['dueDate'],
    status: j['status'] ?? 'active',
    assignedTo: j['assignedTo'] ?? 'all',
    subject: j['subject'] is Map ? SubjectRef.fromJson(j['subject']) : null,
    classRef: j['class'] is Map ? ClassRef.fromJson(j['class']) : null,
    createdAt: j['createdAt'],
    notifiedAt: j['notifiedAt'],
    students: (j['students'] as List? ?? []).map((s) => s is Map<String, dynamic> ? StudentRef.fromJson(s) : StudentRef(id: s.toString(), name: 'Unknown')).toList(),
    createdBy: j['createdBy'] is Map ? UserRef.fromJson(j['createdBy']) : null,
  );
}

class UserRef {
  final String id;
  final String name;

  UserRef({required this.id, required this.name});

  factory UserRef.fromJson(Map<String, dynamic> j) => UserRef(
    id: j['_id'] ?? '',
    name: j['name'] ?? '',
  );
}

class StudentRef {
  final String id;
  final String name;
  final String? admissionNumber;

  StudentRef({required this.id, required this.name, this.admissionNumber});

  factory StudentRef.fromJson(Map<String, dynamic> j) => StudentRef(
    id: j['_id'] ?? '',
    name: j['name'] ?? '',
    admissionNumber: j['admissionNumber'],
  );
}

class SubjectRef {
  final String id;
  final String name;
  final String? color;

  SubjectRef({required this.id, required this.name, this.color});

  factory SubjectRef.fromJson(Map<String, dynamic> j) => SubjectRef(
    id: j['_id'] ?? '',
    name: j['name'] ?? '',
    color: j['color'],
  );
}

class ClassRef {
  final String id;
  final String name;
  final String? section;

  ClassRef({required this.id, required this.name, this.section});

  String get fullName =>
      section != null && section!.isNotEmpty ? '$name $section' : name;

  factory ClassRef.fromJson(Map<String, dynamic> j) => ClassRef(
    id: j['_id'] ?? '',
    name: j['name'] ?? '',
    section: j['section'],
  );
}

class HwSubmission {
  final String id;
  final StudentRef? student;
  final String status;
  final String? submittedAt;
  final List<dynamic> attachments;

  HwSubmission({
    required this.id,
    this.student,
    this.status = 'pending',
    this.submittedAt,
    this.attachments = const [],
  });

  factory HwSubmission.fromJson(Map<String, dynamic> j) => HwSubmission(
    id: j['_id'] ?? '',
    student: j['student'] is Map ? StudentRef.fromJson(j['student']) : (j['student'] != null ? StudentRef(id: j['student'].toString(), name: 'Unknown') : null),
    status: j['status'] ?? 'pending',
    submittedAt: j['submittedAt'],
    attachments: j['attachments'] ?? [],
  );
}
