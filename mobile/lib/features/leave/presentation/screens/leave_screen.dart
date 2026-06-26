import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:skl_teacher/core/network/api_client.dart';
import 'package:skl_teacher/core/theme/app_colors.dart';
import 'package:skl_teacher/core/theme/app_typography.dart';
import 'package:skl_teacher/core/widgets/skeleton.dart';

class LeaveScreen extends StatefulWidget {
  const LeaveScreen({super.key});

  @override
  State<LeaveScreen> createState() => _LeaveScreenState();
}

class _LeaveScreenState extends State<LeaveScreen> {
  List<dynamic> _leaves = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final res = await ApiClient.get('/leaves/my-leaves');
      setState(() {
        _leaves = res.data['leaves'] as List<dynamic>? ?? [];
      });
    } catch (_) {
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _openApplySheet() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _ApplyLeaveSheet(onSubmitted: _load),
    );
  }

  void _openEditSheet(Map<String, dynamic> leave) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _EditLeaveSheet(leave: leave, onChanged: _load),
    );
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      backgroundColor: isDark ? AppColors.bgDark : AppColors.bgLight,
      floatingActionButton: FloatingActionButton(
        onPressed: _openApplySheet,
        backgroundColor: AppColors.primary,
        child: const Icon(Icons.add, color: Colors.white),
      ),
      body: _loading
          ? const SkeletonList()
          : RefreshIndicator(
              onRefresh: _load,
              child: _leaves.isEmpty
                  ? ListView(
                      physics: const AlwaysScrollableScrollPhysics(),
                      children: [
                        SizedBox(height: MediaQuery.of(context).size.height * 0.3),
                        Center(
                          child: Column(
                            children: [
                              Icon(Icons.event_note_outlined, size: 56, color: AppColors.textMuted),
                              const SizedBox(height: 12),
                              Text('No leave requests yet',
                                  style: AppTypography.s16SemiBold(color: AppColors.textMuted)),
                              const SizedBox(height: 6),
                              Text('Tap + to apply for leave',
                                  style: AppTypography.s13Regular(color: AppColors.textMuted)),
                            ],
                          ),
                        ),
                      ],
                    )
                  : ListView.separated(
                      physics: const AlwaysScrollableScrollPhysics(),
                      padding: const EdgeInsets.all(16).copyWith(bottom: 80),
                      itemCount: _leaves.length,
                      separatorBuilder: (_, __) => const SizedBox(height: 12),
                      itemBuilder: (_, i) => _LeaveCard(
                        leave: _leaves[i],
                        isDark: isDark,
                        onTap: _leaves[i]['status'] == 'pending'
                            ? () => _openEditSheet(_leaves[i])
                            : null,
                      ),
                    ),
            ),
    );
  }
}

// ─── Leave Card ───────────────────────────────────────────────────────────────

class _LeaveCard extends StatelessWidget {
  final Map<String, dynamic> leave;
  final bool isDark;
  final VoidCallback? onTap;

  const _LeaveCard({required this.leave, required this.isDark, this.onTap});

  Color _statusColor(String s) {
    switch (s) {
      case 'approved': return AppColors.accentGreen;
      case 'rejected': return AppColors.accentRed;
      default:         return AppColors.warning;
    }
  }

  String _fmtDate(dynamic d) {
    try { return DateFormat('dd MMM yyyy').format(DateTime.parse(d.toString())); }
    catch (_) { return d?.toString() ?? ''; }
  }

  @override
  Widget build(BuildContext context) {
    final status     = leave['status'] as String? ?? 'pending';
    final type       = leave['leaveType'] as String? ?? 'Leave';
    final days       = leave['days'] ?? 1;
    final reason     = leave['reason'] as String? ?? '';
    final adminNote  = leave['adminNote'] as String? ?? '';
    final fromDate   = _fmtDate(leave['fromDate']);
    final toDate     = _fmtDate(leave['toDate']);
    final statusColor = _statusColor(status);

    return GestureDetector(
      onTap: onTap,
      child: Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: isDark ? AppColors.cardDark : Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: onTap != null
              ? AppColors.primary.withValues(alpha: 0.3)
              : (isDark ? AppColors.borderDark : AppColors.borderLight),
        ),
        boxShadow: isDark ? [] : AppColors.shadowSm,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header row: type badge + status badge
          Row(
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: AppColors.primary.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(type,
                    style: AppTypography.s12SemiBold(color: AppColors.primary)),
              ),
              const Spacer(),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: statusColor.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(
                      status == 'approved'
                          ? Icons.check_circle_outline
                          : status == 'rejected'
                              ? Icons.cancel_outlined
                              : Icons.hourglass_empty_rounded,
                      size: 12,
                      color: statusColor,
                    ),
                    const SizedBox(width: 4),
                    Text(
                      status[0].toUpperCase() + status.substring(1),
                      style: AppTypography.s12SemiBold(color: statusColor),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),

          // Dates row
          Row(
            children: [
              Icon(Icons.calendar_today_outlined, size: 14, color: AppColors.textMuted),
              const SizedBox(width: 6),
              Text(
                '$fromDate  →  $toDate',
                style: AppTypography.s13Medium(
                    color: isDark ? Colors.white : AppColors.textPrimary),
              ),
              const Spacer(),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: AppColors.primary.withValues(alpha: 0.07),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(
                  '$days day${days > 1 ? "s" : ""}',
                  style: AppTypography.s12SemiBold(color: AppColors.primary),
                ),
              ),
            ],
          ),

          // Reason
          if (reason.isNotEmpty) ...[
            const SizedBox(height: 8),
            Text(reason,
                style: AppTypography.s12Regular(color: AppColors.textMuted),
                maxLines: 2,
                overflow: TextOverflow.ellipsis),
          ],

          // Admin note on rejection
          if (status == 'rejected' && adminNote.isNotEmpty) ...[
            const SizedBox(height: 10),
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: AppColors.accentRed.withValues(alpha: 0.07),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: AppColors.accentRed.withValues(alpha: 0.2)),
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Icon(Icons.info_outline, size: 14, color: AppColors.accentRed),
                  const SizedBox(width: 6),
                  Expanded(
                    child: Text(adminNote,
                        style: AppTypography.s12Regular(color: AppColors.accentRed)),
                  ),
                ],
              ),
            ),
          ],

          // Admin note on approval
          if (status == 'approved' && adminNote.isNotEmpty) ...[
            const SizedBox(height: 10),
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: AppColors.accentGreen.withValues(alpha: 0.07),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: AppColors.accentGreen.withValues(alpha: 0.2)),
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Icon(Icons.check_circle_outline, size: 14, color: AppColors.accentGreen),
                  const SizedBox(width: 6),
                  Expanded(
                    child: Text(adminNote,
                        style: AppTypography.s12Regular(color: AppColors.accentGreen)),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    ));  // closes Container + GestureDetector
  }
}

// ─── Edit Leave Bottom Sheet ──────────────────────────────────────────────────

class _EditLeaveSheet extends StatefulWidget {
  final Map<String, dynamic> leave;
  final VoidCallback onChanged;

  const _EditLeaveSheet({required this.leave, required this.onChanged});

  @override
  State<_EditLeaveSheet> createState() => _EditLeaveSheetState();
}

class _EditLeaveSheetState extends State<_EditLeaveSheet> {
  final _formKey    = GlobalKey<FormState>();
  final _reasonCtrl = TextEditingController();
  late String    _leaveType;
  DateTime?      _from;
  DateTime?      _to;
  bool           _saving   = false;
  bool           _deleting = false;

  @override
  void initState() {
    super.initState();
    _leaveType = widget.leave['leaveType'] as String? ?? 'CL';
    _from = widget.leave['fromDate'] != null
        ? DateTime.tryParse(widget.leave['fromDate'].toString())
        : null;
    _to = widget.leave['toDate'] != null
        ? DateTime.tryParse(widget.leave['toDate'].toString())
        : null;
    _reasonCtrl.text = widget.leave['reason'] as String? ?? '';
  }

  @override
  void dispose() {
    _reasonCtrl.dispose();
    super.dispose();
  }

  int get _days {
    if (_from == null || _to == null) return 0;
    return _to!.difference(_from!).inDays + 1;
  }

  Future<void> _pickDate(bool isFrom) async {
    final now = DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: isFrom ? (_from ?? now) : (_to ?? _from ?? now),
      firstDate: now.subtract(const Duration(days: 30)),
      lastDate: now.add(const Duration(days: 90)),
    );
    if (picked == null || !mounted) return;
    setState(() {
      if (isFrom) {
        _from = picked;
        if (_to != null && _to!.isBefore(picked)) _to = picked;
      } else {
        _to = picked;
        if (_from != null && _from!.isAfter(picked)) _from = picked;
      }
    });
  }

  Future<void> _update() async {
    if (!_formKey.currentState!.validate()) return;
    if (_from == null || _to == null) {
      _snack('Please select leave dates', isError: true);
      return;
    }
    setState(() => _saving = true);
    try {
      final id = widget.leave['_id'] as String;
      await ApiClient.put('/leaves/my-leaves/$id', data: {
        'leaveType': _leaveType,
        'fromDate':  _from!.toIso8601String(),
        'toDate':    _to!.toIso8601String(),
        'days':      _days,
        'reason':    _reasonCtrl.text.trim(),
      });
      if (!mounted) return;
      Navigator.pop(context);
      widget.onChanged();
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
        content: Text('Leave request updated'),
        backgroundColor: AppColors.accentGreen,
      ));
    } catch (e) {
      _snack(ApiClient.errorMessage(e), isError: true);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _delete() async {
    setState(() => _deleting = true);
    try {
      final id = widget.leave['_id'] as String;
      await ApiClient.delete('/leaves/my-leaves/$id');
      if (!mounted) return;
      Navigator.pop(context);
      widget.onChanged();
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
        content: Text('Leave request cancelled'),
        backgroundColor: AppColors.warning,
      ));
    } catch (e) {
      _snack(ApiClient.errorMessage(e), isError: true);
    } finally {
      if (mounted) setState(() => _deleting = false);
    }
  }

  void _snack(String msg, {bool isError = false}) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Text(msg),
      backgroundColor: isError ? AppColors.accentRed : AppColors.accentGreen,
    ));
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final fmt    = DateFormat('dd MMM yyyy');
    final bottom = MediaQuery.of(context).viewInsets.bottom;

    return Container(
      decoration: BoxDecoration(
        color: isDark ? AppColors.cardDark : Colors.white,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
      ),
      padding: EdgeInsets.fromLTRB(20, 0, 20, bottom + 24),
      child: Form(
        key: _formKey,
        child: SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Center(
                child: Container(
                  margin: const EdgeInsets.symmetric(vertical: 12),
                  width: 40, height: 4,
                  decoration: BoxDecoration(
                    color: isDark ? AppColors.borderDark : AppColors.borderLight,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),

              Row(
                children: [
                  Expanded(
                    child: Text('Edit Leave Request',
                        style: AppTypography.s18SemiBold(
                            color: isDark ? Colors.white : AppColors.textPrimary)),
                  ),
                  // Delete CTA
                  GestureDetector(
                    onTap: (_deleting || _saving) ? null : _delete,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                      decoration: BoxDecoration(
                        color: AppColors.accentRed.withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: AppColors.accentRed.withValues(alpha: 0.3)),
                      ),
                      child: _deleting
                          ? const SizedBox(width: 14, height: 14,
                              child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.accentRed))
                          : Text('Cancel Leave',
                              style: AppTypography.s13SemiBold(color: AppColors.accentRed)),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 20),

              // Leave Type
              Text('Leave Type',
                  style: AppTypography.s13SemiBold(
                      color: isDark ? Colors.white70 : AppColors.textSecondary)),
              const SizedBox(height: 10),
              Wrap(
                spacing: 8, runSpacing: 8,
                children: [
                  ('CL', 'Casual Leave'),
                  ('SL', 'Sick Leave'),
                  ('LOP', 'Loss of Pay'),
                ].map((entry) {
                  final type = entry.$1;
                  final label = entry.$2;
                  final sel = _leaveType == type;
                  return GestureDetector(
                    onTap: () => setState(() => _leaveType = type),
                    child: AnimatedContainer(
                      duration: const Duration(milliseconds: 150),
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                      decoration: BoxDecoration(
                        color: sel ? AppColors.primary : Colors.transparent,
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(
                          color: sel ? AppColors.primary
                              : (isDark ? AppColors.borderDark : AppColors.borderLight),
                        ),
                      ),
                      child: Text(label,
                          style: AppTypography.s13SemiBold(
                            color: sel ? Colors.white
                                : (isDark ? AppColors.textMuted : AppColors.textSecondary),
                          )),
                    ),
                  );
                }).toList(),
              ),
              const SizedBox(height: 20),

              // Dates
              Text('Leave Dates',
                  style: AppTypography.s13SemiBold(
                      color: isDark ? Colors.white70 : AppColors.textSecondary)),
              const SizedBox(height: 10),
              Row(
                children: [
                  Expanded(child: _DateTile(
                    label: 'From',
                    value: _from != null ? fmt.format(_from!) : 'Select',
                    onTap: () => _pickDate(true),
                    isDark: isDark,
                  )),
                  const SizedBox(width: 12),
                  Expanded(child: _DateTile(
                    label: 'To',
                    value: _to != null ? fmt.format(_to!) : 'Select',
                    onTap: () => _pickDate(false),
                    isDark: isDark,
                  )),
                ],
              ),
              if (_from != null && _to != null) ...[
                const SizedBox(height: 10),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  decoration: BoxDecoration(
                    color: AppColors.primary.withValues(alpha: 0.07),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Row(mainAxisSize: MainAxisSize.min, children: [
                    Icon(Icons.info_outline, size: 14, color: AppColors.primary),
                    const SizedBox(width: 6),
                    Text('$_days day${_days > 1 ? "s" : ""} of leave',
                        style: AppTypography.s13SemiBold(color: AppColors.primary)),
                  ]),
                ),
              ],
              const SizedBox(height: 20),

              // Reason
              Text('Reason',
                  style: AppTypography.s13SemiBold(
                      color: isDark ? Colors.white70 : AppColors.textSecondary)),
              const SizedBox(height: 10),
              TextFormField(
                controller: _reasonCtrl,
                maxLines: 3,
                style: AppTypography.s14Regular(
                    color: isDark ? Colors.white : AppColors.textPrimary),
                decoration: InputDecoration(
                  hintText: 'Enter reason for leave...',
                  hintStyle: AppTypography.s14Regular(color: AppColors.textMuted),
                  filled: true,
                  fillColor: isDark ? AppColors.bgDark : AppColors.bgLight,
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                    borderSide: BorderSide(
                        color: isDark ? AppColors.borderDark : AppColors.borderLight),
                  ),
                  enabledBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                    borderSide: BorderSide(
                        color: isDark ? AppColors.borderDark : AppColors.borderLight),
                  ),
                  focusedBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                    borderSide: BorderSide(color: AppColors.primary, width: 1.5),
                  ),
                  contentPadding: const EdgeInsets.all(14),
                ),
                validator: (v) =>
                    (v == null || v.trim().isEmpty) ? 'Reason is required' : null,
              ),
              const SizedBox(height: 24),

              // Update button
              SizedBox(
                width: double.infinity,
                height: 50,
                child: ElevatedButton(
                  onPressed: (_saving || _deleting) ? null : _update,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.primary,
                    disabledBackgroundColor: AppColors.primary.withValues(alpha: 0.5),
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(14)),
                  ),
                  child: _saving
                      ? const SizedBox(width: 22, height: 22,
                          child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2.5))
                      : Text('Update Request',
                          style: AppTypography.s15SemiBold(color: Colors.white)),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ─── Apply Leave Bottom Sheet ─────────────────────────────────────────────────

class _ApplyLeaveSheet extends StatefulWidget {
  final VoidCallback onSubmitted;
  const _ApplyLeaveSheet({required this.onSubmitted});

  @override
  State<_ApplyLeaveSheet> createState() => _ApplyLeaveSheetState();
}

class _ApplyLeaveSheetState extends State<_ApplyLeaveSheet> {
  final _formKey    = GlobalKey<FormState>();
  final _reasonCtrl = TextEditingController();
  String    _leaveType = 'CL';
  DateTime? _from;
  DateTime? _to;
  bool      _loading        = false;
  bool      _balanceLoading = true;
  Map<String, dynamic> _balance = {};

  @override
  void initState() {
    super.initState();
    _loadBalance();
  }

  Future<void> _loadBalance() async {
    try {
      final res = await ApiClient.get('/leaves/my-balance');
      if (mounted) {
        setState(() {
          _balance = (res.data['balance'] as Map<String, dynamic>?) ?? {};
          // If CL has 0 available, default to SL or LOP
          final clAvail = _balance['cl']?['available'] ?? 1;
          if (clAvail == 0) _leaveType = 'SL';
        });
      }
    } catch (_) {
    } finally {
      if (mounted) setState(() => _balanceLoading = false);
    }
  }

  int _available(String type) {
    if (type == 'CL') return _balance['cl']?['available'] ?? 0;
    if (type == 'SL') return _balance['sl']?['available'] ?? 0;
    return 999; // LOP has no limit
  }

  @override
  void dispose() {
    _reasonCtrl.dispose();
    super.dispose();
  }

  int get _days {
    if (_from == null || _to == null) return 0;
    return _to!.difference(_from!).inDays + 1;
  }

  Future<void> _pickDate(bool isFrom) async {
    final now = DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: isFrom ? (_from ?? now) : (_to ?? _from ?? now),
      firstDate: now.subtract(const Duration(days: 30)),
      lastDate: now.add(const Duration(days: 90)),
    );
    if (picked == null || !mounted) return;
    setState(() {
      if (isFrom) {
        _from = picked;
        if (_to != null && _to!.isBefore(picked)) _to = picked;
      } else {
        _to = picked;
        if (_from != null && _from!.isAfter(picked)) _from = picked;
      }
    });
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    if (_from == null || _to == null) {
      _snack('Please select leave dates', isError: true);
      return;
    }
    setState(() => _loading = true);
    try {
      await ApiClient.post('/leaves', data: {
        'leaveType': _leaveType,
        'fromDate':  _from!.toIso8601String(),
        'toDate':    _to!.toIso8601String(),
        'days':      _days,
        'reason':    _reasonCtrl.text.trim(),
      });
      if (!mounted) return;
      Navigator.pop(context);
      widget.onSubmitted();
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
        content: Text('Leave request submitted'),
        backgroundColor: AppColors.accentGreen,
      ));
    } catch (e) {
      _snack(ApiClient.errorMessage(e), isError: true);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _snack(String msg, {bool isError = false}) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Text(msg),
      backgroundColor: isError ? AppColors.accentRed : AppColors.accentGreen,
    ));
  }

  @override
  Widget build(BuildContext context) {
    final isDark  = Theme.of(context).brightness == Brightness.dark;
    final fmt     = DateFormat('dd MMM yyyy');
    final bottom  = MediaQuery.of(context).viewInsets.bottom;

    return Container(
      decoration: BoxDecoration(
        color: isDark ? AppColors.cardDark : Colors.white,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
      ),
      padding: EdgeInsets.fromLTRB(20, 0, 20, bottom + 24),
      child: Form(
        key: _formKey,
        child: SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              // Handle bar
              Center(
                child: Container(
                  margin: const EdgeInsets.symmetric(vertical: 12),
                  width: 40, height: 4,
                  decoration: BoxDecoration(
                    color: isDark ? AppColors.borderDark : AppColors.borderLight,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),

              // Title
              Text('Apply for Leave',
                  style: AppTypography.s18SemiBold(
                      color: isDark ? Colors.white : AppColors.textPrimary)),
              const SizedBox(height: 20),

              // Leave Balance Strip
              if (_balanceLoading)
                const Center(child: SizedBox(width: 20, height: 20,
                    child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.primary)))
              else
                Row(
                  children: [
                    _BalanceChip(
                      label: 'CL Available',
                      value: _balance['cl']?['available'] ?? 0,
                      total: _balance['cl']?['allocated'] ?? 0,
                      isDark: isDark,
                    ),
                    const SizedBox(width: 10),
                    _BalanceChip(
                      label: 'SL Available',
                      value: _balance['sl']?['available'] ?? 0,
                      total: _balance['sl']?['allocated'] ?? 0,
                      isDark: isDark,
                    ),
                  ],
                ),
              const SizedBox(height: 20),

              // Leave Type
              Text('Leave Type',
                  style: AppTypography.s13SemiBold(
                      color: isDark ? Colors.white70 : AppColors.textSecondary)),
              const SizedBox(height: 10),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  ('CL', 'Casual Leave'),
                  ('SL', 'Sick Leave'),
                  ('LOP', 'Loss of Pay'),
                ].map((entry) {
                  final type  = entry.$1;
                  final label = entry.$2;
                  final avail = _available(type);
                  final sel     = _leaveType == type;
                  final disabled = !_balanceLoading && avail == 0 && type != 'LOP';
                  return GestureDetector(
                    onTap: disabled ? null : () => setState(() => _leaveType = type),
                    child: AnimatedContainer(
                      duration: const Duration(milliseconds: 150),
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                      decoration: BoxDecoration(
                        color: disabled
                            ? (isDark ? AppColors.cardDark : AppColors.bgLight)
                            : sel ? AppColors.primary : Colors.transparent,
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(
                          color: disabled
                              ? (isDark ? AppColors.borderDark : AppColors.borderLight)
                              : sel ? AppColors.primary
                                  : (isDark ? AppColors.borderDark : AppColors.borderLight),
                        ),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(label,
                              style: AppTypography.s13SemiBold(
                                color: disabled
                                    ? AppColors.textMuted
                                    : sel ? Colors.white
                                        : (isDark ? AppColors.textMuted : AppColors.textSecondary),
                              )),
                          if (disabled) ...[
                            const SizedBox(width: 4),
                            Text('(0)', style: AppTypography.s11Regular(color: AppColors.accentRed)),
                          ],
                        ],
                      ),
                    ),
                  );
                }).toList(),
              ),
              const SizedBox(height: 20),

              // Dates
              Text('Leave Dates',
                  style: AppTypography.s13SemiBold(
                      color: isDark ? Colors.white70 : AppColors.textSecondary)),
              const SizedBox(height: 10),
              Row(
                children: [
                  Expanded(child: _DateTile(
                    label: 'From',
                    value: _from != null ? fmt.format(_from!) : 'Select',
                    onTap: () => _pickDate(true),
                    isDark: isDark,
                  )),
                  const SizedBox(width: 12),
                  Expanded(child: _DateTile(
                    label: 'To',
                    value: _to != null ? fmt.format(_to!) : 'Select',
                    onTap: () => _pickDate(false),
                    isDark: isDark,
                  )),
                ],
              ),
              if (_from != null && _to != null) ...[
                const SizedBox(height: 10),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  decoration: BoxDecoration(
                    color: AppColors.primary.withValues(alpha: 0.07),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.info_outline, size: 14, color: AppColors.primary),
                      const SizedBox(width: 6),
                      Text('$_days day${_days > 1 ? "s" : ""} of leave',
                          style: AppTypography.s13SemiBold(color: AppColors.primary)),
                    ],
                  ),
                ),
              ],
              const SizedBox(height: 20),

              // Reason
              Text('Reason',
                  style: AppTypography.s13SemiBold(
                      color: isDark ? Colors.white70 : AppColors.textSecondary)),
              const SizedBox(height: 10),
              TextFormField(
                controller: _reasonCtrl,
                maxLines: 3,
                style: AppTypography.s14Regular(
                    color: isDark ? Colors.white : AppColors.textPrimary),
                decoration: InputDecoration(
                  hintText: 'Enter reason for leave...',
                  hintStyle: AppTypography.s14Regular(color: AppColors.textMuted),
                  filled: true,
                  fillColor: isDark ? AppColors.bgDark : AppColors.bgLight,
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                    borderSide: BorderSide(
                      color: isDark ? AppColors.borderDark : AppColors.borderLight,
                    ),
                  ),
                  enabledBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                    borderSide: BorderSide(
                      color: isDark ? AppColors.borderDark : AppColors.borderLight,
                    ),
                  ),
                  focusedBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                    borderSide: BorderSide(color: AppColors.primary, width: 1.5),
                  ),
                  contentPadding: const EdgeInsets.all(14),
                ),
                validator: (v) =>
                    (v == null || v.trim().isEmpty) ? 'Reason is required' : null,
              ),
              const SizedBox(height: 24),

              // Submit button
              SizedBox(
                width: double.infinity,
                height: 50,
                child: ElevatedButton(
                  onPressed: _loading ? null : _submit,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.primary,
                    disabledBackgroundColor: AppColors.primary.withValues(alpha: 0.5),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(14),
                    ),
                  ),
                  child: _loading
                      ? const SizedBox(
                          width: 22, height: 22,
                          child: CircularProgressIndicator(
                              color: Colors.white, strokeWidth: 2.5),
                        )
                      : Text('Submit Leave Request',
                          style: AppTypography.s15SemiBold(color: Colors.white)),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ─── Balance Chip ─────────────────────────────────────────────────────────────

class _BalanceChip extends StatelessWidget {
  final String label;
  final int value;
  final int total;
  final bool isDark;

  const _BalanceChip({
    required this.label,
    required this.value,
    required this.total,
    required this.isDark,
  });

  @override
  Widget build(BuildContext context) {
    final isEmpty = value == 0;
    final color   = isEmpty ? AppColors.accentRed : AppColors.accentGreen;

    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.08),
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: color.withValues(alpha: 0.25)),
        ),
        child: Row(
          children: [
            Icon(
              isEmpty ? Icons.remove_circle_outline : Icons.check_circle_outline,
              size: 18,
              color: color,
            ),
            const SizedBox(width: 8),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(label,
                      style: AppTypography.s11Regular(color: AppColors.textMuted)),
                  const SizedBox(height: 2),
                  Text(
                    '$value / $total days',
                    style: AppTypography.s13SemiBold(color: color),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ─── Date Tile ────────────────────────────────────────────────────────────────

class _DateTile extends StatelessWidget {
  final String label;
  final String value;
  final VoidCallback onTap;
  final bool isDark;

  const _DateTile({
    required this.label,
    required this.value,
    required this.onTap,
    required this.isDark,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: isDark ? AppColors.bgDark : AppColors.bgLight,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: isDark ? AppColors.borderDark : AppColors.borderLight,
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(label,
                style: AppTypography.s11Regular(color: AppColors.textMuted)),
            const SizedBox(height: 4),
            Row(
              children: [
                Icon(Icons.calendar_today_outlined,
                    size: 13, color: AppColors.primary),
                const SizedBox(width: 6),
                Expanded(
                  child: Text(value,
                      style: AppTypography.s13SemiBold(
                        color: isDark ? Colors.white : AppColors.textPrimary,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
