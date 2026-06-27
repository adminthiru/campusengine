import 'package:dio/dio.dart';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:skl_teacher/core/network/api_client.dart';
import 'package:skl_teacher/core/theme/app_colors.dart';
import 'package:skl_teacher/core/theme/app_typography.dart';

/// Lets a student OR a parent update a homework submission — set the status and
/// upload/view/remove attachment files (PDF or image). Returns true if anything
/// changed so the caller can refresh its list. Backend endpoints are
/// role-agnostic, so this is shared by both the student and parent apps.
Future<bool> showHomeworkSubmissionSheet(
  BuildContext context, {
  required String homeworkId,
  required String studentId,
  required String title,
  Map? submission,
}) async {
  final changed = await showModalBottomSheet<bool>(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (_) => _HomeworkSubmissionSheet(
      homeworkId: homeworkId,
      studentId: studentId,
      title: title,
      submission: submission,
    ),
  );
  return changed ?? false;
}

class _HomeworkSubmissionSheet extends StatefulWidget {
  final String homeworkId;
  final String studentId;
  final String title;
  final Map? submission;
  const _HomeworkSubmissionSheet({
    required this.homeworkId,
    required this.studentId,
    required this.title,
    this.submission,
  });

  @override
  State<_HomeworkSubmissionSheet> createState() =>
      _HomeworkSubmissionSheetState();
}

class _HomeworkSubmissionSheetState extends State<_HomeworkSubmissionSheet> {
  late String _status;
  late List<Map> _attachments;
  bool _changed = false;
  bool _busy = false;

  static const _statuses = [
    ('pending', 'Pending'),
    ('in_progress', 'In Progress'),
    ('completed', 'Submitted'),
  ];

  @override
  void initState() {
    super.initState();
    _status = (widget.submission?['status'] as String?) ?? 'pending';
    _attachments = (widget.submission?['attachments'] is List)
        ? List<Map>.from(
            (widget.submission!['attachments'] as List).whereType<Map>())
        : <Map>[];
  }

  void _snack(String msg, {bool error = false}) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Text(msg),
      backgroundColor: error ? AppColors.accentRed : AppColors.accentGreen,
    ));
  }

  Future<void> _setStatus(String s) async {
    if (_busy || s == _status) return;
    setState(() => _busy = true);
    try {
      final res = await ApiClient.post('/homework/${widget.homeworkId}/submit',
          data: {'studentId': widget.studentId, 'status': s});
      final sub = res.data is Map ? res.data['submission'] : null;
      setState(() {
        _status = (sub?['status'] as String?) ?? s;
        _changed = true;
      });
    } catch (e) {
      _snack(ApiClient.errorMessage(e), error: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _upload() async {
    if (_busy) return;
    final result = await FilePicker.pickFiles(
      type: FileType.custom,
      allowedExtensions: ['pdf', 'jpg', 'jpeg', 'png', 'webp'],
      withData: true,
    );
    if (result == null || result.files.isEmpty) return;
    final f = result.files.single;
    final bytes = f.bytes;
    if (bytes == null) {
      _snack('Could not read the selected file', error: true);
      return;
    }
    setState(() => _busy = true);
    try {
      final form = FormData.fromMap(
          {'file': MultipartFile.fromBytes(bytes, filename: f.name)});
      final res = await ApiClient.post(
          '/homework/${widget.homeworkId}/submissions/${widget.studentId}/attachment',
          data: form);
      final sub = res.data is Map ? res.data['submission'] : null;
      setState(() {
        if (sub?['attachments'] is List) {
          _attachments =
              List<Map>.from((sub['attachments'] as List).whereType<Map>());
        }
        _changed = true;
      });
      _snack('File uploaded');
    } catch (e) {
      _snack(ApiClient.errorMessage(e), error: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _delete(String attachmentId) async {
    if (_busy) return;
    setState(() => _busy = true);
    try {
      final res = await ApiClient.delete(
          '/homework/${widget.homeworkId}/submissions/${widget.studentId}/attachment/$attachmentId');
      final sub = res.data is Map ? res.data['submission'] : null;
      setState(() {
        _attachments = (sub?['attachments'] is List)
            ? List<Map>.from((sub['attachments'] as List).whereType<Map>())
            : <Map>[];
        _changed = true;
      });
    } catch (e) {
      _snack(ApiClient.errorMessage(e), error: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _open(String url) async {
    if (url.isEmpty) return;
    final uri = Uri.parse(ApiClient.fileUrl(url));
    try {
      if (await launchUrl(uri, mode: LaunchMode.externalApplication)) return;
    } catch (_) {}
    try {
      await launchUrl(uri, mode: LaunchMode.platformDefault);
    } catch (_) {
      _snack('Could not open the file', error: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
      child: Container(
        decoration: BoxDecoration(
          color: isDark ? AppColors.cardDark : Colors.white,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
        ),
        padding: const EdgeInsets.fromLTRB(20, 12, 20, 24),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Center(
            child: Container(
              width: 40,
              height: 4,
              margin: const EdgeInsets.only(bottom: 16),
              decoration: BoxDecoration(
                color: AppColors.textMuted.withValues(alpha: 0.3),
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),
          Align(
            alignment: Alignment.centerLeft,
            child: Text('Submit Homework',
                style: AppTypography.s16Bold(
                    color: isDark ? Colors.white : AppColors.textPrimary)),
          ),
          const SizedBox(height: 2),
          Align(
            alignment: Alignment.centerLeft,
            child: Text(widget.title,
                style: AppTypography.s13Regular(color: AppColors.textMuted),
                maxLines: 2,
                overflow: TextOverflow.ellipsis),
          ),
          const SizedBox(height: 16),

          // ── Status ──────────────────────────────────────────────────────
          Align(
            alignment: Alignment.centerLeft,
            child: Text('STATUS',
                style: AppTypography.s11SemiBold(color: AppColors.textMuted)),
          ),
          const SizedBox(height: 8),
          Row(
            children: _statuses.map((s) {
              final selected = _status == s.$1;
              return Expanded(
                child: Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: InkWell(
                    onTap: _busy ? null : () => _setStatus(s.$1),
                    borderRadius: BorderRadius.circular(10),
                    child: Container(
                      padding: const EdgeInsets.symmetric(vertical: 10),
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                        color: selected
                            ? AppColors.primary
                            : (isDark
                                ? AppColors.bgDark
                                : const Color(0xFFF1F5F9)),
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(
                            color: selected
                                ? AppColors.primary
                                : (isDark
                                    ? AppColors.borderDark
                                    : AppColors.borderLight)),
                      ),
                      child: Text(s.$2,
                          textAlign: TextAlign.center,
                          style: AppTypography.s12SemiBold(
                              color: selected
                                  ? Colors.white
                                  : (isDark
                                      ? Colors.white70
                                      : AppColors.textSecondary))),
                    ),
                  ),
                ),
              );
            }).toList(),
          ),
          const SizedBox(height: 18),

          // ── Attachments ─────────────────────────────────────────────────
          Align(
            alignment: Alignment.centerLeft,
            child: Text('ATTACHMENTS',
                style: AppTypography.s11SemiBold(color: AppColors.textMuted)),
          ),
          const SizedBox(height: 8),
          ..._attachments.map((a) {
            final url = (a['url'] as String?) ?? '';
            final name = (a['name'] as String?) ?? 'Attachment';
            final id = (a['_id'] as String?) ?? '';
            final isImage = a['fileType'] == 'image';
            return Container(
              margin: const EdgeInsets.only(bottom: 8),
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              decoration: BoxDecoration(
                color: AppColors.primary.withValues(alpha: isDark ? 0.16 : 0.07),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Row(children: [
                Icon(isImage ? Icons.image_outlined : Icons.picture_as_pdf,
                    color: AppColors.primary, size: 20),
                const SizedBox(width: 10),
                Expanded(
                  child: InkWell(
                    onTap: () => _open(url),
                    child: Text(name,
                        style: AppTypography.s13SemiBold(
                            color: AppColors.primary),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis),
                  ),
                ),
                IconButton(
                  visualDensity: VisualDensity.compact,
                  icon: const Icon(Icons.delete_outline,
                      color: AppColors.accentRed, size: 20),
                  onPressed: (_busy || id.isEmpty) ? null : () => _delete(id),
                ),
              ]),
            );
          }),
          const SizedBox(height: 4),
          SizedBox(
            width: double.infinity,
            child: OutlinedButton.icon(
              onPressed: _busy ? null : _upload,
              icon: const Icon(Icons.upload_file, size: 18),
              label: const Text('Upload PDF / Image'),
              style: OutlinedButton.styleFrom(
                foregroundColor: AppColors.primary,
                padding: const EdgeInsets.symmetric(vertical: 12),
                side: const BorderSide(color: AppColors.primary),
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12)),
              ),
            ),
          ),
          const SizedBox(height: 14),
          SizedBox(
            width: double.infinity,
            height: 48,
            child: ElevatedButton(
              onPressed: () => Navigator.pop(context, _changed),
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.primary,
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(14)),
              ),
              child: _busy
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(
                          color: Colors.white, strokeWidth: 2))
                  : Text('Done',
                      style: AppTypography.s15SemiBold(color: Colors.white)),
            ),
          ),
        ]),
      ),
    );
  }
}
