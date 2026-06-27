import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import 'package:skl_teacher/core/network/api_client.dart';
import 'package:skl_teacher/core/theme/app_colors.dart';
import 'package:skl_teacher/core/theme/app_typography.dart';
import 'package:skl_teacher/core/widgets/skeleton.dart';
import 'package:skl_teacher/features/parent/presentation/providers/parent_data_provider.dart';

class ParentLeaveScreen extends StatefulWidget {
  const ParentLeaveScreen({super.key});
  @override
  State<ParentLeaveScreen> createState() => _ParentLeaveScreenState();
}

class _ParentLeaveScreenState extends State<ParentLeaveScreen>
    with SingleTickerProviderStateMixin {
  late final TabController _tab;

  @override
  void initState() {
    super.initState();
    _tab = TabController(length: 2, vsync: this);
  }

  @override
  void dispose() {
    _tab.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Scaffold(
      backgroundColor: isDark ? AppColors.bgDark : AppColors.bgLight,
      body: Column(children: [
        Container(
          color: isDark ? AppColors.cardDark : Colors.white,
          child: TabBar(
            controller: _tab,
            tabs: const [Tab(text: 'Apply Leave'), Tab(text: 'History')],
            indicatorColor: AppColors.primary,
            labelColor: AppColors.primary,
            unselectedLabelColor: AppColors.textMuted,
            labelStyle: AppTypography.s13SemiBold(),
          ),
        ),
        Expanded(
            child: TabBarView(
          controller: _tab,
          children: const [_ApplyTab(), _HistoryTab()],
        )),
      ]),
    );
  }
}

class _ApplyTab extends StatefulWidget {
  const _ApplyTab();
  @override
  State<_ApplyTab> createState() => _ApplyTabState();
}

class _ApplyTabState extends State<_ApplyTab> {
  final _formKey = GlobalKey<FormState>();
  final _reasonCtrl = TextEditingController();
  final Set<String> _selectedIds = {}; // multi-select children
  DateTime? _from, _to;
  bool _loading = false;

  @override
  void dispose() {
    _reasonCtrl.dispose();
    super.dispose();
  }

  int get _days =>
      (_from != null && _to != null) ? _to!.difference(_from!).inDays + 1 : 0;

  Future<void> _pickDate(bool isFrom) async {
    final now = DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: isFrom ? (_from ?? now) : (_to ?? _from ?? now),
      firstDate: now.subtract(const Duration(days: 7)),
      lastDate: now.add(const Duration(days: 60)),
    );
    if (picked == null) return;
    setState(() {
      if (isFrom) {
        _from = picked;
        if (_to?.isBefore(picked) == true) _to = picked;
      } else {
        _to = picked;
        if (_from?.isAfter(picked) == true) _from = picked;
      }
    });
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    if (_selectedIds.isEmpty) {
      _snack('Select at least one child', isError: true);
      return;
    }
    if (_from == null || _to == null) {
      _snack('Select dates', isError: true);
      return;
    }
    setState(() => _loading = true);
    // One leave request per selected child (each is approved independently).
    int ok = 0;
    String? lastErr;
    for (final id in _selectedIds) {
      try {
        await ApiClient.post('/parent/student-leave', data: {
          'studentId': id,
          'fromDate': _from!.toIso8601String(),
          'toDate': _to!.toIso8601String(),
          'days': _days,
          'reason': _reasonCtrl.text.trim(),
        });
        ok++;
      } catch (e) {
        lastErr = ApiClient.errorMessage(e);
      }
    }
    if (!mounted) return;
    if (ok > 0) {
      _snack('Leave request submitted for $ok student${ok > 1 ? "s" : ""}');
      setState(() {
        _from = null;
        _to = null;
        _selectedIds.clear();
        _reasonCtrl.clear();
      });
    } else {
      _snack(lastErr ?? 'Could not submit leave request', isError: true);
    }
    setState(() => _loading = false);
  }

  void _snack(String msg, {bool isError = false}) =>
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text(msg),
        backgroundColor: isError ? AppColors.accentRed : AppColors.accentGreen,
      ));

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final children = context.watch<ParentDataProvider>().children;
    final fmt = DateFormat('dd MMM yyyy');

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Form(
          key: _formKey,
          child:
              Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            const SizedBox(height: 4),
            Row(children: [
              Text(children.length > 1 ? 'Select Children' : 'Select Child',
                  style: AppTypography.s14SemiBold(
                      color: isDark ? Colors.white : AppColors.textPrimary)),
              if (children.length > 1) ...[
                const SizedBox(width: 6),
                Text('(select one or more)',
                    style: AppTypography.s12Regular(color: AppColors.textMuted)),
              ],
            ]),
            const SizedBox(height: 10),
            if (children.isEmpty)
              Text('No children linked to your account',
                  style: AppTypography.s13Regular(color: AppColors.textMuted))
            else
              ...children.map((c) {
                final sel = _selectedIds.contains(c.id);
                return GestureDetector(
                  onTap: () => setState(() {
                    if (sel) {
                      _selectedIds.remove(c.id);
                    } else {
                      _selectedIds.add(c.id);
                    }
                  }),
                  child: AnimatedContainer(
                    duration: const Duration(milliseconds: 150),
                    margin: const EdgeInsets.only(bottom: 8),
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: sel
                          ? AppColors.primary.withValues(alpha: 0.08)
                          : (isDark ? AppColors.cardDark : Colors.white),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(
                        color: sel
                            ? AppColors.primary
                            : (isDark
                                ? AppColors.borderDark
                                : AppColors.borderLight),
                        width: sel ? 2 : 1,
                      ),
                    ),
                    child: Row(children: [
                      CircleAvatar(
                        radius: 18,
                        backgroundColor:
                            AppColors.primary.withValues(alpha: 0.1),
                        child: Text(c.initial,
                            style:
                                AppTypography.s14Bold(color: AppColors.primary)),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                          child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                            Text(c.name,
                                style: AppTypography.s14SemiBold(
                                    color: isDark
                                        ? Colors.white
                                        : AppColors.textPrimary)),
                            Text(c.classLabel,
                                style: AppTypography.s12Regular(
                                    color: AppColors.textMuted)),
                          ])),
                      Icon(
                          sel
                              ? Icons.check_circle
                              : Icons.radio_button_unchecked,
                          color: sel ? AppColors.primary : AppColors.textMuted,
                          size: 20),
                    ]),
                  ),
                );
              }),
            const SizedBox(height: 20),
            Text('Leave Dates',
                style: AppTypography.s14SemiBold(
                    color: isDark ? Colors.white : AppColors.textPrimary)),
            const SizedBox(height: 10),
            Row(children: [
              Expanded(
                  child: _DateCard(
                      label: 'From',
                      date: _from != null ? fmt.format(_from!) : 'Select',
                      onTap: () => _pickDate(true),
                      isDark: isDark)),
              const SizedBox(width: 12),
              Expanded(
                  child: _DateCard(
                      label: 'To',
                      date: _to != null ? fmt.format(_to!) : 'Select',
                      onTap: () => _pickDate(false),
                      isDark: isDark)),
            ]),
            if (_from != null && _to != null) ...[
              const SizedBox(height: 10),
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                decoration: BoxDecoration(
                  color: AppColors.primary.withValues(alpha: 0.07),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Row(mainAxisSize: MainAxisSize.min, children: [
                  Icon(Icons.info_outline, size: 16, color: AppColors.primary),
                  const SizedBox(width: 8),
                  Text('$_days day${_days > 1 ? "s" : ""} of leave',
                      style:
                          AppTypography.s13SemiBold(color: AppColors.primary)),
                ]),
              ),
            ],
            const SizedBox(height: 20),
            Text('Reason',
                style: AppTypography.s14SemiBold(
                    color: isDark ? Colors.white : AppColors.textPrimary)),
            const SizedBox(height: 10),
            TextFormField(
              controller: _reasonCtrl,
              maxLines: 4,
              decoration: InputDecoration(
                hintText: 'Enter reason for leave...',
                hintStyle: AppTypography.s14Regular(color: AppColors.textMuted),
                filled: true,
                fillColor: isDark ? AppColors.cardDark : Colors.white,
                border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                    borderSide: BorderSide(
                        color: isDark
                            ? AppColors.borderDark
                            : AppColors.borderLight)),
                enabledBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                    borderSide: BorderSide(
                        color: isDark
                            ? AppColors.borderDark
                            : AppColors.borderLight)),
              ),
              validator: (v) =>
                  (v == null || v.trim().isEmpty) ? 'Reason is required' : null,
            ),
            const SizedBox(height: 28),
            SizedBox(
              width: double.infinity,
              height: 50,
              child: ElevatedButton(
                onPressed: _loading ? null : _submit,
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.primary,
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(14)),
                ),
                child: _loading
                    ? const SizedBox(
                        width: 22,
                        height: 22,
                        child: CircularProgressIndicator(
                            color: Colors.white, strokeWidth: 2.5))
                    : Text('Submit Leave Request',
                        style: AppTypography.s15SemiBold(color: Colors.white)),
              ),
            ),
          ])),
    );
  }
}

class _DateCard extends StatelessWidget {
  final String label, date;
  final VoidCallback onTap;
  final bool isDark;
  const _DateCard(
      {required this.label,
      required this.date,
      required this.onTap,
      required this.isDark});

  @override
  Widget build(BuildContext context) => GestureDetector(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: isDark ? AppColors.cardDark : Colors.white,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(
                color: isDark ? AppColors.borderDark : AppColors.borderLight),
          ),
          child:
              Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(label,
                style: AppTypography.s12Regular(color: AppColors.textMuted)),
            const SizedBox(height: 4),
            Row(children: [
              Icon(Icons.calendar_today_outlined,
                  size: 14, color: AppColors.primary),
              const SizedBox(width: 6),
              Expanded(
                  child: Text(date,
                      style: AppTypography.s13SemiBold(
                          color: isDark ? Colors.white : AppColors.textPrimary),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis)),
            ]),
          ]),
        ),
      );
}

class _HistoryTab extends StatefulWidget {
  const _HistoryTab();
  @override
  State<_HistoryTab> createState() => _HistoryTabState();
}

class _HistoryTabState extends State<_HistoryTab> {
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
      final res = await ApiClient.get('/parent/student-leave');
      setState(() {
        _leaves = res.data['leaves'] as List<dynamic>? ?? [];
        _loading = false;
      });
    } catch (_) {
      setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    if (_loading) {
      return const SkeletonList();
    }
    if (_leaves.isEmpty) {
      return Center(
          child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
        Icon(Icons.event_busy_outlined, size: 56, color: AppColors.textMuted),
        const SizedBox(height: 12),
        Text('No leave requests',
            style: AppTypography.s16SemiBold(color: AppColors.textMuted)),
      ]));
    }
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView.builder(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(16),
        itemCount: _leaves.length,
        itemBuilder: (_, i) {
          final l = _leaves[i];
          final status = l['status'] as String? ?? 'pending';
          final color = status == 'approved'
              ? AppColors.accentGreen
              : status == 'rejected'
                  ? AppColors.accentRed
                  : AppColors.warning;
          final studentName = l['student']?['name'] as String? ?? 'Student';

          return Container(
            margin: const EdgeInsets.only(bottom: 12),
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: isDark ? AppColors.cardDark : Colors.white,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(
                  color: isDark ? AppColors.borderDark : AppColors.borderLight),
              boxShadow: isDark ? [] : AppColors.shadowSm,
            ),
            child:
                Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(children: [
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: AppColors.primary.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Text(studentName,
                      style:
                          AppTypography.s12SemiBold(color: AppColors.primary)),
                ),
                const Spacer(),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: color.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(status[0].toUpperCase() + status.substring(1),
                      style: AppTypography.s12SemiBold(color: color)),
                ),
              ]),
              const SizedBox(height: 8),
              Row(children: [
                Icon(Icons.calendar_today_outlined,
                    size: 13, color: AppColors.textMuted),
                const SizedBox(width: 4),
                Text('${_fmtDate(l['fromDate'])} – ${_fmtDate(l['toDate'])}',
                    style: AppTypography.s13Regular(
                        color: isDark ? Colors.white : AppColors.textPrimary)),
                const Spacer(),
                Text('${l['days'] ?? 1} day(s)',
                    style: AppTypography.s13SemiBold(color: AppColors.primary)),
              ]),
              if (l['reason'] != null &&
                  (l['reason'] as String).isNotEmpty) ...[
                const SizedBox(height: 6),
                Text(l['reason'],
                    style: AppTypography.s12Regular(color: AppColors.textMuted),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis),
              ],
            ]),
          );
        },
      ),
    );
  }

  String _fmtDate(dynamic d) {
    try {
      return DateFormat('dd MMM').format(DateTime.parse(d.toString()));
    } catch (_) {
      return d?.toString() ?? '';
    }
  }
}
