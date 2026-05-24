class LeaveRequest {
  final String id;
  final String leaveType; // 'CL' | 'SL' | 'LOP'
  final String fromDate;
  final String toDate;
  final int days;
  final String reason;
  final String status; // 'pending' | 'approved' | 'rejected'
  final String? adminNote;
  final String? createdAt;

  LeaveRequest({
    required this.id, required this.leaveType, required this.fromDate,
    required this.toDate, required this.days, required this.reason,
    required this.status, this.adminNote, this.createdAt,
  });

  factory LeaveRequest.fromJson(Map<String, dynamic> j) => LeaveRequest(
    id: j['_id'] ?? '',
    leaveType: j['leaveType'] ?? 'CL',
    fromDate: j['fromDate'] ?? '',
    toDate: j['toDate'] ?? '',
    days: j['days'] ?? 1,
    reason: j['reason'] ?? '',
    status: j['status'] ?? 'pending',
    adminNote: j['adminNote'],
    createdAt: j['createdAt'],
  );
}

class LeaveBalance {
  final int totalCL;
  final int totalSL;
  final int usedCL;
  final int usedSL;

  LeaveBalance({
    required this.totalCL, required this.totalSL,
    required this.usedCL, required this.usedSL,
  });

  int get remainingCL => (totalCL - usedCL).clamp(0, totalCL);
  int get remainingSL => (totalSL - usedSL).clamp(0, totalSL);
}
