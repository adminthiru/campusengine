class TimetableEntry {
  final String id;
  final String day;
  final int period;
  final String? startTime;
  final String? endTime;
  final SubjectRef? subject;
  final ClassRef? classRef;

  TimetableEntry({
    required this.id, required this.day, required this.period,
    this.startTime, this.endTime, this.subject, this.classRef,
  });

  factory TimetableEntry.fromJson(Map<String, dynamic> j) => TimetableEntry(
    id: j['_id'] ?? '',
    day: j['day'] ?? '',
    period: j['period'] ?? 1,
    startTime: j['startTime'],
    endTime: j['endTime'],
    subject: j['subject'] is Map ? SubjectRef.fromJson(j['subject']) : null,
    classRef: j['class'] is Map ? ClassRef.fromJson(j['class']) : null,
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

  String get fullName => section != null && section!.isNotEmpty ? '$name $section' : name;

  factory ClassRef.fromJson(Map<String, dynamic> j) => ClassRef(
    id: j['_id'] ?? '',
    name: j['name'] ?? '',
    section: j['section'],
  );
}
