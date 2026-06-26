import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:skl_teacher/core/network/api_client.dart';
import 'package:skl_teacher/core/theme/app_colors.dart';
import 'package:skl_teacher/core/theme/app_typography.dart';
import 'package:skl_teacher/core/widgets/skeleton.dart';

class LibraryScreen extends StatefulWidget {
  const LibraryScreen({super.key});

  @override
  State<LibraryScreen> createState() => _LibraryScreenState();
}

class _LibraryScreenState extends State<LibraryScreen> {
  List<dynamic> _issues = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final res = await ApiClient.get('/library/my-issues');
      setState(() {
        _issues = res.data['issues'] as List<dynamic>? ?? [];
      });
    } catch (_) {
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _openIssueDetail(Map<String, dynamic> issue) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _IssueDetailSheet(issue: issue, onRenewalRequested: _load),
    );
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      backgroundColor: isDark ? AppColors.bgDark : AppColors.bgLight,
      appBar: AppBar(
        backgroundColor: isDark ? AppColors.cardDark : Colors.white,
        elevation: 0,
        title: Text(
          'My Library',
          style: AppTypography.s18SemiBold(
            color: isDark ? Colors.white : AppColors.textPrimary,
          ),
        ),
        iconTheme: IconThemeData(
          color: isDark ? Colors.white : AppColors.textPrimary,
        ),
      ),
      body: _loading
          ? const SkeletonList()
          : RefreshIndicator(
              onRefresh: _load,
              child: _issues.isEmpty
                  ? ListView(
                      physics: const AlwaysScrollableScrollPhysics(),
                      children: [
                        SizedBox(height: MediaQuery.of(context).size.height * 0.3),
                        Center(
                          child: Column(
                            children: [
                              Icon(Icons.menu_book_outlined, size: 56, color: AppColors.textMuted),
                              const SizedBox(height: 12),
                              Text(
                                'No books issued',
                                style: AppTypography.s16SemiBold(color: AppColors.textMuted),
                              ),
                              const SizedBox(height: 6),
                              Text(
                                'Books issued to you will appear here',
                                style: AppTypography.s13Regular(color: AppColors.textMuted),
                              ),
                            ],
                          ),
                        ),
                      ],
                    )
                  : ListView.separated(
                      physics: const AlwaysScrollableScrollPhysics(),
                      padding: const EdgeInsets.all(16).copyWith(bottom: 80),
                      itemCount: _issues.length,
                      separatorBuilder: (_, __) => const SizedBox(height: 12),
                      itemBuilder: (_, i) => _IssueCard(
                        issue: _issues[i],
                        isDark: isDark,
                        onTap: () => _openIssueDetail(_issues[i]),
                      ),
                    ),
            ),
    );
  }
}

// ─── Issue Card ───────────────────────────────────────────────────────────────

class _IssueCard extends StatelessWidget {
  final Map<String, dynamic> issue;
  final bool isDark;
  final VoidCallback onTap;

  const _IssueCard({
    required this.issue,
    required this.isDark,
    required this.onTap,
  });

  Color _statusColor(String s) {
    switch (s) {
      case 'returned': return AppColors.accentGreen;
      case 'overdue':
      case 'lost':     return AppColors.accentRed;
      case 'damaged':  return AppColors.accentOrange;
      default:         return AppColors.primary;
    }
  }

  String _fmtDate(dynamic d) {
    try { return DateFormat('dd MMM yyyy').format(DateTime.parse(d.toString())); }
    catch (_) { return d?.toString() ?? '—'; }
  }

  int _daysOverdue(dynamic dueDate) {
    try {
      final due = DateTime.parse(dueDate.toString());
      final now = DateTime.now();
      if (now.isBefore(due)) return 0;
      return now.difference(due).inDays;
    } catch (_) { return 0; }
  }

  bool _isOverdue(Map<String, dynamic> issue) {
    if (issue['status'] != 'issued') return false;
    try {
      final due = DateTime.parse(issue['dueDate'].toString());
      return DateTime.now().isAfter(due);
    } catch (_) { return false; }
  }

  @override
  Widget build(BuildContext context) {
    final book     = issue['book'] as Map<String, dynamic>? ?? {};
    final status   = issue['status'] as String? ?? 'issued';
    final dueDate  = issue['dueDate'];
    final fine     = (issue['calculatedFine'] ?? issue['fine'] ?? 0) as num;
    final isOD     = _isOverdue(issue);
    final days     = isOD ? _daysOverdue(dueDate) : 0;
    final statusColor = _statusColor(status);

    final hasPendingRenewal = (issue['renewalRequests'] as List<dynamic>? ?? [])
        .any((r) => (r as Map<String, dynamic>)['status'] == 'pending');

    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: isDark ? AppColors.cardDark : Colors.white,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
            color: isOD
                ? AppColors.accentRed.withValues(alpha: 0.35)
                : (isDark ? AppColors.borderDark : AppColors.borderLight),
          ),
          boxShadow: isDark ? [] : AppColors.shadowSm,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Header: book title + status badge
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  width: 40,
                  height: 40,
                  decoration: BoxDecoration(
                    color: AppColors.primary.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: const Icon(Icons.menu_book_outlined, color: AppColors.primary, size: 22),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        book['title'] as String? ?? '—',
                        style: AppTypography.s14SemiBold(
                          color: isDark ? Colors.white : AppColors.textPrimary,
                        ),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                      if ((book['author'] as String?)?.isNotEmpty == true) ...[
                        const SizedBox(height: 2),
                        Text(
                          book['author'] as String,
                          style: AppTypography.s12Regular(color: AppColors.textMuted),
                        ),
                      ],
                    ],
                  ),
                ),
                const SizedBox(width: 8),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
                  decoration: BoxDecoration(
                    color: statusColor.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    status.toUpperCase(),
                    style: AppTypography.s11SemiBold(color: statusColor),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),

            // Due date row
            Row(
              children: [
                Icon(Icons.calendar_today_outlined,
                    size: 14,
                    color: isOD ? AppColors.accentRed : AppColors.textMuted),
                const SizedBox(width: 6),
                Text(
                  'Due: ${_fmtDate(dueDate)}',
                  style: AppTypography.s13Medium(
                    color: isOD
                        ? AppColors.accentRed
                        : (isDark ? Colors.white70 : AppColors.textPrimary),
                  ),
                ),
                if (isOD) ...[
                  const SizedBox(width: 8),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                    decoration: BoxDecoration(
                      color: AppColors.accentRed.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: Text(
                      '$days day${days != 1 ? "s" : ""} overdue',
                      style: AppTypography.s11SemiBold(color: AppColors.accentRed),
                    ),
                  ),
                ],
              ],
            ),

            // Fine row
            if (fine > 0) ...[
              const SizedBox(height: 6),
              Row(
                children: [
                  Icon(Icons.currency_rupee, size: 14, color: AppColors.accentOrange),
                  const SizedBox(width: 4),
                  Text(
                    'Fine: ₹$fine',
                    style: AppTypography.s13SemiBold(color: AppColors.accentOrange),
                  ),
                ],
              ),
            ],

            // Pending renewal badge
            if (hasPendingRenewal) ...[
              const SizedBox(height: 8),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: AppColors.warning.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.hourglass_empty_rounded, size: 12, color: AppColors.warning),
                    const SizedBox(width: 4),
                    Text(
                      'Renewal Pending',
                      style: AppTypography.s11SemiBold(color: AppColors.warning),
                    ),
                  ],
                ),
              ),
            ],

            // Tap hint for issued books
            if (status == 'issued') ...[
              const SizedBox(height: 8),
              Row(
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  Text(
                    'Tap to view details',
                    style: AppTypography.s11Regular(color: AppColors.textMuted),
                  ),
                  const SizedBox(width: 4),
                  Icon(Icons.chevron_right, size: 14, color: AppColors.textMuted),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }
}

// ─── Issue Detail Bottom Sheet ────────────────────────────────────────────────

class _IssueDetailSheet extends StatefulWidget {
  final Map<String, dynamic> issue;
  final VoidCallback onRenewalRequested;

  const _IssueDetailSheet({
    required this.issue,
    required this.onRenewalRequested,
  });

  @override
  State<_IssueDetailSheet> createState() => _IssueDetailSheetState();
}

class _IssueDetailSheetState extends State<_IssueDetailSheet> {
  DateTime? _newDueDate;
  bool _requesting = false;

  String _fmtDate(dynamic d) {
    try { return DateFormat('dd MMM yyyy').format(DateTime.parse(d.toString())); }
    catch (_) { return d?.toString() ?? '—'; }
  }

  bool get _canRequestRenewal {
    final status = widget.issue['status'] as String? ?? '';
    if (status != 'issued') return false;
    final renewals = widget.issue['renewalRequests'] as List<dynamic>? ?? [];
    return !renewals.any((r) => (r as Map<String, dynamic>)['status'] == 'pending');
  }

  Future<void> _pickNewDueDate() async {
    final now = DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: now.add(const Duration(days: 7)),
      firstDate: now.add(const Duration(days: 1)),
      lastDate: now.add(const Duration(days: 90)),
    );
    if (picked == null || !mounted) return;
    setState(() => _newDueDate = picked);
  }

  Future<void> _requestRenewal() async {
    if (_newDueDate == null) {
      _snack('Please select a new due date', isError: true);
      return;
    }
    setState(() => _requesting = true);
    try {
      final id = widget.issue['_id'] as String;
      await ApiClient.post('/library/my-issues/$id/renewal', data: {
        'newDueDate': _newDueDate!.toIso8601String(),
      });
      if (!mounted) return;
      Navigator.pop(context);
      widget.onRenewalRequested();
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
        content: Text('Renewal request submitted'),
        backgroundColor: AppColors.accentGreen,
      ));
    } catch (e) {
      _snack(ApiClient.errorMessage(e), isError: true);
    } finally {
      if (mounted) setState(() => _requesting = false);
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
    final bottom  = MediaQuery.of(context).viewInsets.bottom;
    final book    = widget.issue['book'] as Map<String, dynamic>? ?? {};
    final status  = widget.issue['status'] as String? ?? 'issued';
    final fine    = (widget.issue['calculatedFine'] ?? widget.issue['fine'] ?? 0) as num;
    final fmt     = DateFormat('dd MMM yyyy');

    return Container(
      decoration: BoxDecoration(
        color: isDark ? AppColors.cardDark : Colors.white,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
      ),
      padding: EdgeInsets.fromLTRB(20, 0, 20, bottom + 24),
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

            Text(
              'Book Details',
              style: AppTypography.s18SemiBold(
                color: isDark ? Colors.white : AppColors.textPrimary,
              ),
            ),
            const SizedBox(height: 20),

            // Book info card
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: AppColors.primary.withValues(alpha: 0.06),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: AppColors.primary.withValues(alpha: 0.15)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    book['title'] as String? ?? '—',
                    style: AppTypography.s16SemiBold(color: AppColors.primary),
                  ),
                  if ((book['author'] as String?)?.isNotEmpty == true) ...[
                    const SizedBox(height: 4),
                    Text(
                      book['author'] as String,
                      style: AppTypography.s13Regular(color: AppColors.textMuted),
                    ),
                  ],
                  if ((book['category'] as String?)?.isNotEmpty == true) ...[
                    const SizedBox(height: 4),
                    Text(
                      book['category'] as String,
                      style: AppTypography.s12Regular(color: AppColors.textSecondary),
                    ),
                  ],
                ],
              ),
            ),
            const SizedBox(height: 20),

            // Issue details
            _DetailRow(
              label: 'Status',
              value: status.toUpperCase(),
              isDark: isDark,
              valueColor: _statusColor(status),
            ),
            _DetailRow(
              label: 'Issue Date',
              value: _fmtDate(widget.issue['issueDate']),
              isDark: isDark,
            ),
            _DetailRow(
              label: 'Due Date',
              value: _fmtDate(widget.issue['dueDate']),
              isDark: isDark,
            ),
            if (widget.issue['returnDate'] != null)
              _DetailRow(
                label: 'Return Date',
                value: _fmtDate(widget.issue['returnDate']),
                isDark: isDark,
              ),
            if (fine > 0)
              _DetailRow(
                label: 'Fine',
                value: '₹$fine',
                isDark: isDark,
                valueColor: AppColors.accentOrange,
              ),

            // Renewal section — only for issued books
            if (_canRequestRenewal) ...[
              const SizedBox(height: 24),
              Divider(
                color: isDark ? AppColors.borderDark : AppColors.borderLight,
              ),
              const SizedBox(height: 16),
              Text(
                'Request Renewal',
                style: AppTypography.s15SemiBold(
                  color: isDark ? Colors.white : AppColors.textPrimary,
                ),
              ),
              const SizedBox(height: 12),
              Text(
                'Select a new due date for your renewal request. The admin will review and approve or reject it.',
                style: AppTypography.s13Regular(color: AppColors.textMuted),
              ),
              const SizedBox(height: 14),

              // New due date picker
              GestureDetector(
                onTap: _pickNewDueDate,
                child: Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: isDark ? AppColors.bgDark : AppColors.bgLight,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(
                      color: _newDueDate != null
                          ? AppColors.primary
                          : (isDark ? AppColors.borderDark : AppColors.borderLight),
                    ),
                  ),
                  child: Row(
                    children: [
                      Icon(
                        Icons.calendar_today_outlined,
                        size: 18,
                        color: _newDueDate != null ? AppColors.primary : AppColors.textMuted,
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          _newDueDate != null
                              ? fmt.format(_newDueDate!)
                              : 'Select new due date',
                          style: AppTypography.s14Regular(
                            color: _newDueDate != null
                                ? (isDark ? Colors.white : AppColors.textPrimary)
                                : AppColors.textMuted,
                          ),
                        ),
                      ),
                      Icon(
                        Icons.chevron_right,
                        size: 18,
                        color: AppColors.textMuted,
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 20),

              // Submit button
              SizedBox(
                width: double.infinity,
                height: 50,
                child: ElevatedButton(
                  onPressed: _requesting ? null : _requestRenewal,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.primary,
                    disabledBackgroundColor: AppColors.primary.withValues(alpha: 0.5),
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(14)),
                  ),
                  child: _requesting
                      ? const SizedBox(
                          width: 22, height: 22,
                          child: CircularProgressIndicator(
                              color: Colors.white, strokeWidth: 2.5))
                      : Text(
                          'Request Renewal',
                          style: AppTypography.s15SemiBold(color: Colors.white),
                        ),
                ),
              ),
            ],

            // Already has pending renewal
            if (!_canRequestRenewal && status == 'issued') ...[
              const SizedBox(height: 16),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: AppColors.warning.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: AppColors.warning.withValues(alpha: 0.3)),
                ),
                child: Row(
                  children: [
                    Icon(Icons.hourglass_empty_rounded, size: 18, color: AppColors.warning),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        'A renewal request is already pending approval.',
                        style: AppTypography.s13Regular(color: AppColors.warning),
                      ),
                    ),
                  ],
                ),
              ),
            ],

            const SizedBox(height: 8),
          ],
        ),
      ),
    );
  }

  Color _statusColor(String s) {
    switch (s) {
      case 'returned': return AppColors.accentGreen;
      case 'overdue':
      case 'lost':     return AppColors.accentRed;
      case 'damaged':  return AppColors.accentOrange;
      default:         return AppColors.primary;
    }
  }
}

// ─── Detail Row ───────────────────────────────────────────────────────────────

class _DetailRow extends StatelessWidget {
  final String label;
  final String value;
  final bool isDark;
  final Color? valueColor;

  const _DetailRow({
    required this.label,
    required this.value,
    required this.isDark,
    this.valueColor,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        children: [
          SizedBox(
            width: 110,
            child: Text(
              label,
              style: AppTypography.s13Regular(color: AppColors.textMuted),
            ),
          ),
          Expanded(
            child: Text(
              value,
              style: AppTypography.s13SemiBold(
                color: valueColor ?? (isDark ? Colors.white : AppColors.textPrimary),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
