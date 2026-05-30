class AppUser {
  final String id;
  final String name;
  final String email;
  final String? phone;
  final String role;
  final String? avatar;
  final String? employeeId;
  final String? studentId;
  final String? parentId;
  final SchoolInfo? school;
  final bool firstLogin;

  AppUser({
    required this.id,
    required this.name,
    required this.email,
    this.phone,
    required this.role,
    this.avatar,
    this.employeeId,
    this.studentId,
    this.parentId,
    this.school,
    this.firstLogin = false,
  });

  factory AppUser.fromJson(Map<String, dynamic> j) => AppUser(
    id: j['_id'] ?? '',
    name: j['name'] ?? '',
    email: j['email'] ?? '',
    phone: j['phone'],
    role: j['role'] ?? 'teacher',
    avatar: j['avatar'],
    employeeId: j['employeeId'] is Map ? j['employeeId']['_id'] : j['employeeId'],
    studentId: j['studentId'] is Map ? j['studentId']['_id'] : j['studentId'],
    parentId: j['parentId'] is Map ? j['parentId']['_id'] : j['parentId'],
    school: j['school'] is Map ? SchoolInfo.fromJson(j['school']) : null,
    firstLogin: j['firstLogin'] ?? false,
  );
}

class SchoolInfo {
  final String id;
  final String name;
  final String? code;
  final String? logo;

  SchoolInfo({required this.id, required this.name, this.code, this.logo});

  factory SchoolInfo.fromJson(Map<String, dynamic> j) => SchoolInfo(
    id: j['_id'] ?? '',
    name: j['name'] ?? '',
    code: j['code'],
    logo: j['logo'],
  );
}
