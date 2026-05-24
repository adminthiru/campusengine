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
