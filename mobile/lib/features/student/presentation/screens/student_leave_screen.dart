import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:skl_teacher/core/network/api_client.dart';
import 'package:skl_teacher/core/theme/app_colors.dart';

class StudentLeaveScreen extends StatefulWidget {
  const StudentLeaveScreen({super.key});
  @override
  State<StudentLeaveScreen> createState() => _StudentLeaveScreenState();
}

class _StudentLeaveScreenState extends State<StudentLeaveScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tab;
  List<dynamic> _history = [];
  bool _loadingHistory = true;
  bool _submitting = false;

  final _fromCtrl   = TextEditingController();
  final _toCtrl     = TextEditingController();
  final _reasonCtrl = TextEditingController();
  final _formKey    = GlobalKey<FormState>();

  @override
  void initState() {
    super.initState();
    _tab = TabController(length: 2, vsync: this);
    _loadHistory();
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
    try {
      final res = await ApiClient.get('/student/leave');
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
    if (d != null) ctrl.text = '${d.year}-${d.month.toString().padLeft(2,'0')}-${d.day.toString().padLeft(2,'0')}';
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _submitting = true);
    try {
      await ApiClient.post('/student/leave', data: {
        'fromDate': _fromCtrl.text,
        'toDate': _toCtrl.text,
        'reason': _reasonCtrl.text,
      });
      _fromCtrl.clear(); _toCtrl.clear(); _reasonCtrl.clear();
      await _loadHistory();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Leave request submitted'), backgroundColor: Colors.green),
        );
        _tab.animateTo(1);
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(ApiClient.errorMessage(e)), backgroundColor: Colors.red),
        );
      }
    }
    setState(() => _submitting = false);
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        TabBar(controller: _tab, tabs: const [Tab(text: 'Apply Leave'), Tab(text: 'History')]),
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
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Form(
        key: _formKey,
        child: Column(
          children: [
            _dateField('From Date', _fromCtrl),
            const SizedBox(height: 12),
            _dateField('To Date', _toCtrl),
            const SizedBox(height: 12),
            TextFormField(
              controller: _reasonCtrl,
              maxLines: 3,
              decoration: const InputDecoration(labelText: 'Reason', hintText: 'Reason for leave'),
              validator: (v) => (v == null || v.trim().isEmpty) ? 'Reason required' : null,
            ),
            const SizedBox(height: 20),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: _submitting ? null : _submit,
                child: _submitting
                    ? const SizedBox(width: 20, height: 20,
                        child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                    : Text('Submit Leave Request', style: GoogleFonts.inter(fontWeight: FontWeight.w600)),
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
      validator: (v) => (v == null || v.isEmpty) ? '$label required' : null,
    );
  }

  Widget _buildHistory(BuildContext context) {
    if (_loadingHistory) return const Center(child: CircularProgressIndicator());
    if (_history.isEmpty) {
      return Center(child: Text('No leave requests', style: GoogleFonts.inter(color: AppColors.textMuted)));
    }
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: _history.length,
      itemBuilder: (_, i) {
        final l = _history[i];
        final status = l['status'] as String? ?? 'pending';
        final color = status == 'approved' ? AppColors.accentGreen
                    : status == 'rejected' ? AppColors.accentRed
                    : AppColors.warning;
        return Container(
          margin: const EdgeInsets.only(bottom: 10),
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: isDark ? AppColors.cardDark : Colors.white,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: isDark ? AppColors.borderDark : AppColors.borderLight),
          ),
          child: Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('${_fmtDate(l['fromDate'])} → ${_fmtDate(l['toDate'])}',
                        style: GoogleFonts.inter(fontSize: 14, fontWeight: FontWeight.w600)),
                    Text('${l['days'] ?? ''} day(s) · ${l['reason'] ?? ''}',
                        style: GoogleFonts.inter(fontSize: 12, color: AppColors.textMuted)),
                  ],
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: color.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  status[0].toUpperCase() + status.substring(1),
                  style: GoogleFonts.inter(fontSize: 12, color: color, fontWeight: FontWeight.w600),
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  String _fmtDate(dynamic d) {
    try { final dt = DateTime.parse(d.toString()); return '${dt.day}/${dt.month}/${dt.year}'; }
    catch (_) { return d?.toString() ?? ''; }
  }
}
