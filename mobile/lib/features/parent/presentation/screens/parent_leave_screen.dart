import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import 'package:skl_teacher/core/network/api_client.dart';
import 'package:skl_teacher/core/theme/app_colors.dart';
import 'package:skl_teacher/features/parent/presentation/providers/parent_data_provider.dart';

class ParentLeaveScreen extends StatefulWidget {
  const ParentLeaveScreen({super.key});
  @override
  State<ParentLeaveScreen> createState() => _ParentLeaveScreenState();
}

class _ParentLeaveScreenState extends State<ParentLeaveScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tab;

  List<dynamic> _history = [];
  bool _loadingHistory = true;
  bool _submitting = false;

  int _selectedChildIndex = 0;

  final _fromCtrl   = TextEditingController();
  final _toCtrl     = TextEditingController();
  final _reasonCtrl = TextEditingController();
  final _formKey    = GlobalKey<FormState>();

  @override
  void initState() {
    super.initState();
    _tab = TabController(length: 2, vsync: this);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final pp = context.read<ParentDataProvider>();
      if (pp.children.isEmpty && !pp.loading) {
        pp.fetchChildren().then((_) => _loadHistory());
      } else {
        _loadHistory();
      }
    });
  }

  @override
  void dispose() {
    _tab.dispose();
    _fromCtrl.dispose();
    _toCtrl.dispose();
    _reasonCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadHistory() async {
    setState(() => _loadingHistory = true);
    try {
      final res = await ApiClient.get('/parent/student-leave');
      setState(() {
        _history = res.data['leaves'] as List<dynamic>? ?? [];
        _loadingHistory = false;
      });
    } catch (_) {
      setState(() => _loadingHistory = false);
    }
  }

  Future<void> _pickDate(TextEditingController ctrl) async {
    final d = await showDatePicker(
      context: context,
      initialDate: DateTime.now(),
      firstDate: DateTime.now().subtract(const Duration(days: 30)),
      lastDate: DateTime.now().add(const Duration(days: 90)),
    );
    if (d != null) {
      ctrl.text =
          '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';
    }
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    final pp = context.read<ParentDataProvider>();
    if (pp.children.isEmpty) return;
    final child = pp.children[_selectedChildIndex];

    setState(() => _submitting = true);
    try {
      await ApiClient.post('/parent/student-leave', data: {
        'studentId': child.id,
        'fromDate': _fromCtrl.text,
        'toDate': _toCtrl.text,
        'reason': _reasonCtrl.text,
      });
      _fromCtrl.clear();
      _toCtrl.clear();
      _reasonCtrl.clear();
      await _loadHistory();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Leave request submitted'),
            backgroundColor: Colors.green,
          ),
        );
        _tab.animateTo(1);
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(ApiClient.errorMessage(e)),
            backgroundColor: Colors.red,
          ),
        );
      }
    }
    setState(() => _submitting = false);
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        TabBar(
          controller: _tab,
          tabs: const [Tab(text: 'Apply Leave'), Tab(text: 'History')],
        ),
        Expanded(
          child: TabBarView(
            controller: _tab,
            children: [_buildForm(context), _buildHistory(context)],
          ),
        ),
      ],
    );
  }

  Widget _buildForm(BuildContext context) {
    final pp = context.watch<ParentDataProvider>();

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Form(
        key: _formKey,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (pp.children.length > 1) ...[
              Text('Select Child', style: GoogleFonts.inter(fontSize: 13, color: AppColors.textMuted)),
              const SizedBox(height: 8),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12),
                decoration: BoxDecoration(
                  border: Border.all(color: AppColors.borderLight),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: DropdownButton<int>(
                  value: _selectedChildIndex,
                  isExpanded: true,
                  underline: const SizedBox(),
                  items: List.generate(pp.children.length, (i) => DropdownMenuItem(
                    value: i,
                    child: Text(pp.children[i].name, style: GoogleFonts.inter()),
                  )),
                  onChanged: (v) => setState(() => _selectedChildIndex = v ?? 0),
                ),
              ),
              const SizedBox(height: 16),
            ] else if (pp.children.isNotEmpty) ...[
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: AppColors.primary.withValues(alpha: 0.07),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Row(
                  children: [
                    CircleAvatar(
                      radius: 16,
                      backgroundColor: AppColors.primary.withValues(alpha: 0.15),
                      child: Text(
                        pp.children[0].name.substring(0, 1).toUpperCase(),
                        style: GoogleFonts.inter(fontSize: 14, fontWeight: FontWeight.w700, color: AppColors.primary),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(pp.children[0].name,
                            style: GoogleFonts.inter(fontSize: 14, fontWeight: FontWeight.w600)),
                        Text(pp.children[0].classLabel,
                            style: GoogleFonts.inter(fontSize: 12, color: AppColors.textMuted)),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),
            ],
            _dateField('From Date', _fromCtrl),
            const SizedBox(height: 12),
            _dateField('To Date', _toCtrl),
            const SizedBox(height: 12),
            TextFormField(
              controller: _reasonCtrl,
              maxLines: 3,
              decoration: const InputDecoration(
                labelText: 'Reason',
                hintText: 'Reason for leave',
              ),
              validator: (v) =>
                  (v == null || v.trim().isEmpty) ? 'Reason required' : null,
            ),
            const SizedBox(height: 20),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: _submitting ? null : _submit,
                child: _submitting
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(
                            color: Colors.white, strokeWidth: 2),
                      )
                    : Text('Submit Leave Request',
                        style: GoogleFonts.inter(fontWeight: FontWeight.w600)),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _dateField(String label, TextEditingController ctrl) {
    return TextFormField(
      controller: ctrl,
      readOnly: true,
      onTap: () => _pickDate(ctrl),
      decoration: InputDecoration(
        labelText: label,
        suffixIcon: const Icon(Icons.calendar_today_outlined, size: 18),
      ),
      validator: (v) =>
          (v == null || v.isEmpty) ? '$label required' : null,
    );
  }

  Widget _buildHistory(BuildContext context) {
    if (_loadingHistory) return const Center(child: CircularProgressIndicator());
    if (_history.isEmpty) {
      return Center(
        child: Text('No leave requests',
            style: GoogleFonts.inter(color: AppColors.textMuted)),
      );
    }
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: _history.length,
      itemBuilder: (_, i) {
        final l = _history[i];
        final status = l['status'] as String? ?? 'pending';
        final color = status == 'approved'
            ? AppColors.accentGreen
            : status == 'rejected'
                ? AppColors.accentRed
                : AppColors.warning;
        final studentName = l['student']?['name'] as String? ?? '';
        return Container(
          margin: const EdgeInsets.only(bottom: 10),
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: isDark ? AppColors.cardDark : Colors.white,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(
                color: isDark ? AppColors.borderDark : AppColors.borderLight),
          ),
          child: Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (studentName.isNotEmpty)
                      Text(studentName,
                          style: GoogleFonts.inter(
                              fontSize: 13,
                              fontWeight: FontWeight.w600,
                              color: AppColors.primary)),
                    Text(
                      '${_fmtDate(l['fromDate'])} → ${_fmtDate(l['toDate'])}',
                      style: GoogleFonts.inter(
                          fontSize: 14, fontWeight: FontWeight.w600),
                    ),
                    Text(
                      '${l['days'] ?? ''} day(s) · ${l['reason'] ?? ''}',
                      style: GoogleFonts.inter(
                          fontSize: 12, color: AppColors.textMuted),
                    ),
                  ],
                ),
              ),
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: color.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  status[0].toUpperCase() + status.substring(1),
                  style: GoogleFonts.inter(
                      fontSize: 12,
                      color: color,
                      fontWeight: FontWeight.w600),
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  String _fmtDate(dynamic d) {
    try {
      final dt = DateTime.parse(d.toString());
      return '${dt.day}/${dt.month}/${dt.year}';
    } catch (_) {
      return d?.toString() ?? '';
    }
  }
}
