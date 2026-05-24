import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../core/api.dart';
import '../../core/constants.dart';
import '../../models/leave.dart';
import '../../widgets/empty_state.dart';

class LeaveScreen extends StatefulWidget {
  const LeaveScreen({super.key});

  @override
  State<LeaveScreen> createState() => _LeaveScreenState();
}

class _LeaveScreenState extends State<LeaveScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tab;
  List<LeaveRequest> _leaves = [];
  bool _loading = true;
  LeaveBalance? _balance;

  @override
  void initState() {
    super.initState();
    _tab = TabController(length: 2, vsync: this);
    _fetch();
  }

  @override
  void dispose() {
    _tab.dispose();
    super.dispose();
  }

  Future<void> _fetch() async {
    setState(() => _loading = true);
    try {
      // Fetch leave history
      final leavesRes = await ApiClient.get('/leaves/my-leaves');
      final raw = leavesRes.data['leaves'] ?? leavesRes.data as List? ?? [];
      final leaves = (raw as List).map((l) => LeaveRequest.fromJson(l)).toList();

      // Fetch school for leave config
      final schoolRes = await ApiClient.get('/school');
      final leaveConfig = schoolRes.data['school']['settings']?['leaveConfig'] ??
          schoolRes.data['school']['leaveConfig'] ?? {};
      final totalCL = leaveConfig['casualLeave'] ?? 12;
      final totalSL = leaveConfig['sickLeave'] ?? 10;

      final now = DateTime.now();
      final thisYear = leaves.where((l) =>
          DateTime.tryParse(l.fromDate)?.year == now.year &&
          l.status == 'approved').toList();
      final usedCL = thisYear.where((l) => l.leaveType == 'CL').fold<int>(0, (a, b) => a + b.days);
      final usedSL = thisYear.where((l) => l.leaveType == 'SL').fold<int>(0, (a, b) => a + b.days);

      setState(() {
        _leaves = leaves;
        _balance = LeaveBalance(
          totalCL: totalCL, totalSL: totalSL, usedCL: usedCL, usedSL: usedSL,
        );
        _loading = false;
      });
    } catch (_) {
      setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Leave Request'),
        bottom: TabBar(
          controller: _tab,
          indicatorColor: kPrimary,
          labelColor: kPrimary,
          unselectedLabelColor: kTextMuted,
          tabs: const [Tab(text: 'Apply'), Tab(text: 'My Leaves')],
        ),
      ),
      body: TabBarView(
        controller: _tab,
        children: [
          _ApplyTab(balance: _balance, onSubmitted: _fetch),
          _HistoryTab(leaves: _leaves, loading: _loading),
        ],
      ),
    );
  }
}

// ─── Apply Tab ────────────────────────────────────────────────────────────────

class _ApplyTab extends StatefulWidget {
  final LeaveBalance? balance;
  final VoidCallback onSubmitted;

  const _ApplyTab({this.balance, required this.onSubmitted});

  @override
  State<_ApplyTab> createState() => _ApplyTabState();
}

class _ApplyTabState extends State<_ApplyTab> {
  final _formKey = GlobalKey<FormState>();
  final _reasonCtrl = TextEditingController();
  DateTime? _from;
  DateTime? _to;
  String _leaveType = 'CL';
  bool _submitting = false;

  @override
  void dispose() {
    _reasonCtrl.dispose();
    super.dispose();
  }

  int get _days {
    if (_from == null || _to == null) return 0;
    return _to!.difference(_from!).inDays + 1;
  }

  String _autoLeaveType() {
    final b = widget.balance;
    if (b == null) return 'CL';
    if (b.remainingCL > 0) return 'CL';
    if (b.remainingSL > 0) return 'SL';
    return 'LOP';
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    if (_from == null || _to == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please select dates'), backgroundColor: kWarning),
      );
      return;
    }
    setState(() => _submitting = true);
    try {
      await ApiClient.post('/leaves', data: {
        'leaveType': _leaveType,
        'fromDate': DateFormat('yyyy-MM-dd').format(_from!),
        'toDate': DateFormat('yyyy-MM-dd').format(_to!),
        'days': _days,
        'reason': _reasonCtrl.text.trim(),
      });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Leave request submitted!'),
            backgroundColor: kSuccess,
          ),
        );
        _reasonCtrl.clear();
        setState(() { _from = null; _to = null; });
        widget.onSubmitted();
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(ApiClient.errorMessage(e)), backgroundColor: kDanger),
        );
      }
    }
    if (mounted) setState(() => _submitting = false);
  }

  Widget _balanceChip(String type, int remaining, int total, Color color) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: color.withOpacity(0.08),
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: color.withOpacity(0.3)),
        ),
        child: Column(
          children: [
            Text('$remaining/$total', style: TextStyle(
              fontSize: 18, fontWeight: FontWeight.w700, color: color,
            )),
            const SizedBox(height: 2),
            Text(type, style: const TextStyle(fontSize: 12, color: kTextMuted)),
          ],
        ),
      ),
    );
  }

  Future<void> _pickDate(bool isFrom) async {
    final picked = await showDatePicker(
      context: context,
      initialDate: isFrom ? (DateTime.now()) : (_from ?? DateTime.now()),
      firstDate: DateTime.now().subtract(const Duration(days: 30)),
      lastDate: DateTime.now().add(const Duration(days: 180)),
      builder: (ctx, child) => Theme(
        data: Theme.of(ctx).copyWith(
          colorScheme: const ColorScheme.light(primary: kPrimary),
        ),
        child: child!,
      ),
    );
    if (picked != null) {
      setState(() {
        if (isFrom) {
          _from = picked;
          if (_to != null && _to!.isBefore(_from!)) _to = null;
          _leaveType = _autoLeaveType();
        } else {
          _to = picked;
        }
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final b = widget.balance;

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Form(
        key: _formKey,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Leave balance
            if (b != null) ...[
              const Text('Leave Balance', style: TextStyle(
                fontSize: 13, fontWeight: FontWeight.w600, color: kTextMuted,
              )),
              const SizedBox(height: 8),
              Row(
                children: [
                  _balanceChip('Casual', b.remainingCL, b.totalCL, kPrimary),
                  const SizedBox(width: 10),
                  _balanceChip('Sick', b.remainingSL, b.totalSL, kSuccess),
                  const SizedBox(width: 10),
                  _balanceChip('LOP', 0, 0, kWarning),
                ],
              ),
              const SizedBox(height: 20),
            ],

            // Leave type
            const Text('Leave Type', style: TextStyle(
              fontSize: 13, fontWeight: FontWeight.w500, color: kTextSecondary,
            )),
            const SizedBox(height: 8),
            Row(
              children: ['CL', 'SL', 'LOP'].map((t) {
                final sel = _leaveType == t;
                return Expanded(
                  child: GestureDetector(
                    onTap: () => setState(() => _leaveType = t),
                    child: Container(
                      margin: const EdgeInsets.only(right: 8),
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      decoration: BoxDecoration(
                        color: sel ? kPrimary : kBackground,
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: sel ? kPrimary : kBorder),
                      ),
                      child: Text(t, textAlign: TextAlign.center, style: TextStyle(
                        fontSize: 13, fontWeight: FontWeight.w600,
                        color: sel ? Colors.white : kTextSecondary,
                      )),
                    ),
                  ),
                );
              }).toList(),
            ),
            const SizedBox(height: 16),

            // Date pickers
            Row(
              children: [
                Expanded(child: _DatePickerField(
                  label: 'From Date',
                  date: _from,
                  onTap: () => _pickDate(true),
                )),
                const SizedBox(width: 12),
                Expanded(child: _DatePickerField(
                  label: 'To Date',
                  date: _to,
                  onTap: () => _pickDate(false),
                  enabled: _from != null,
                )),
              ],
            ),
            if (_days > 0) ...[
              const SizedBox(height: 8),
              Text('$_days day${_days > 1 ? 's' : ''}', style: const TextStyle(
                fontSize: 13, color: kPrimary, fontWeight: FontWeight.w600,
              )),
            ],
            const SizedBox(height: 16),

            // Reason
            const Text('Reason', style: TextStyle(
              fontSize: 13, fontWeight: FontWeight.w500, color: kTextSecondary,
            )),
            const SizedBox(height: 6),
            TextFormField(
              controller: _reasonCtrl,
              maxLines: 3,
              decoration: const InputDecoration(hintText: 'Reason for leave...'),
              validator: (v) => v == null || v.trim().isEmpty ? 'Reason required' : null,
            ),
            const SizedBox(height: 24),

            SizedBox(
              width: double.infinity, height: 48,
              child: ElevatedButton(
                onPressed: _submitting ? null : _submit,
                child: _submitting
                    ? const SizedBox(width: 20, height: 20,
                        child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                    : const Text('Submit Leave Request'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _DatePickerField extends StatelessWidget {
  final String label;
  final DateTime? date;
  final VoidCallback onTap;
  final bool enabled;

  const _DatePickerField({
    required this.label, this.date, required this.onTap, this.enabled = true,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: enabled ? onTap : null,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
        decoration: BoxDecoration(
          color: enabled ? kCardBg : kBackground,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: kBorder),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(label, style: const TextStyle(fontSize: 11, color: kTextMuted)),
            const SizedBox(height: 4),
            Text(
              date != null ? DateFormat('dd MMM yyyy').format(date!) : 'Select',
              style: TextStyle(
                fontSize: 13, fontWeight: FontWeight.w500,
                color: date != null ? kTextPrimary : kTextMuted,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ─── History Tab ──────────────────────────────────────────────────────────────

class _HistoryTab extends StatelessWidget {
  final List<LeaveRequest> leaves;
  final bool loading;

  const _HistoryTab({required this.leaves, required this.loading});

  @override
  Widget build(BuildContext context) {
    if (loading) return const Center(child: CircularProgressIndicator(color: kPrimary));
    if (leaves.isEmpty) {
      return const EmptyState(
      icon: Icons.beach_access_outlined,
      title: 'No leave requests',
      subtitle: 'Your leave history will appear here',
    );
    }

    return ListView.separated(
      padding: const EdgeInsets.all(12),
      itemCount: leaves.length,
      separatorBuilder: (_, __) => const SizedBox(height: 8),
      itemBuilder: (_, i) {
        final l = leaves[i];
        final statusColor = l.status == 'approved' ? kSuccess
            : l.status == 'rejected' ? kDanger : kWarning;
        final borderColor = l.status == 'approved' ? kSuccess
            : l.status == 'rejected' ? kDanger : kWarning;

        return Container(
          decoration: BoxDecoration(
            color: kCardBg,
            borderRadius: BorderRadius.circular(12),
            border: Border(
              left: BorderSide(color: borderColor, width: 4),
              top: const BorderSide(color: kBorder),
              right: const BorderSide(color: kBorder),
              bottom: const BorderSide(color: kBorder),
            ),
          ),
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: kBackground, borderRadius: BorderRadius.circular(6),
                    ),
                    child: Text(l.leaveType, style: const TextStyle(
                      fontSize: 12, fontWeight: FontWeight.w700, color: kPrimary,
                    )),
                  ),
                  const SizedBox(width: 8),
                  Text('${l.days} day${l.days > 1 ? 's' : ''}', style: const TextStyle(
                    fontSize: 13, color: kTextSecondary,
                  )),
                  const Spacer(),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: statusColor.withOpacity(0.1),
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Text(
                      l.status[0].toUpperCase() + l.status.substring(1),
                      style: TextStyle(
                        fontSize: 11, fontWeight: FontWeight.w600, color: statusColor,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              Row(
                children: [
                  const Icon(Icons.calendar_today_outlined, size: 14, color: kTextMuted),
                  const SizedBox(width: 5),
                  Text(
                    '${_fmt(l.fromDate)} – ${_fmt(l.toDate)}',
                    style: const TextStyle(fontSize: 12, color: kTextSecondary),
                  ),
                ],
              ),
              const SizedBox(height: 6),
              Text(l.reason, style: const TextStyle(fontSize: 13, color: kTextPrimary)),
              if (l.adminNote != null && l.adminNote!.isNotEmpty) ...[
                const SizedBox(height: 6),
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: kBackground, borderRadius: BorderRadius.circular(6),
                  ),
                  child: Text('Admin: ${l.adminNote}', style: const TextStyle(
                    fontSize: 12, color: kTextSecondary, fontStyle: FontStyle.italic,
                  )),
                ),
              ],
            ],
          ),
        );
      },
    );
  }

  String _fmt(String date) {
    try { return DateFormat('dd MMM').format(DateTime.parse(date)); }
    catch (_) { return date; }
  }
}
