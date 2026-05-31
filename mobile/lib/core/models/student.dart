class Student {
  final String id;
  final String name;
  final String? admissionNumber;
  final String? photo;
  final String? phone;
  final String? gender;
  final String? dateOfBirth;
  final List<Guardian> guardians;

  Student({
    required this.id, required this.name, this.admissionNumber,
    this.photo, this.phone, this.gender, this.dateOfBirth,
    this.guardians = const [],
  });

  factory Student.fromJson(Map<String, dynamic> j) => Student(
    id: j['_id'] ?? '',
    name: j['name'] ?? '',
    admissionNumber: j['admissionNumber'],
    photo: j['photo'],
    phone: j['phone'],
    gender: j['gender'],
    dateOfBirth: j['dateOfBirth'],
    guardians: (j['guardians'] as List? ?? [])
        .whereType<Map>()
        .map((g) => Guardian.fromJson(Map<String, dynamic>.from(g)))
        .toList(),
  );
}

class Guardian {
  final String name;
  final String? phone;
  final String? relation;

  Guardian({required this.name, this.phone, this.relation});

  factory Guardian.fromJson(Map<String, dynamic> j) => Guardian(
    name: j['name'] ?? '',
    phone: j['phone'],
    relation: j['relation'],
  );
}
