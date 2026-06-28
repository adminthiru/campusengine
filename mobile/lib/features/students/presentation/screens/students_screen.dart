import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:skl_teacher/core/network/api_client.dart';
import 'package:skl_teacher/core/theme/app_colors.dart';
import 'package:skl_teacher/core/theme/app_typography.dart';
import 'package:skl_teacher/core/widgets/skeleton.dart';
import 'package:skl_teacher/features/profile/presentation/providers/profile_provider.dart';
import 'package:skl_teacher/features/students/presentation/screens/student_detail_screen.dart';

class StudentsScreen extends StatefulWidget {
  /// When provided (subject teacher flow) the screen filters by this class.
  final String? classId;
  final String? className;

  const StudentsScreen({super.key, this.classId, this.className});

  @override
  State<StudentsScreen> createState() => _StudentsScreenState();
}

class _StudentsScreenState extends State<StudentsScreen> {
  List<dynamic> _students = [];
  List<dynamic> _filtered = [];
  bool _loading = true;
  String _search = '';

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  Future<void> _load() async {
    final profile = context.read<ProfileProvider>().profile;
    // Prefer explicit classId (subject teacher), fallback to class teacher class
    final classId = widget.classId?.isNotEmpty == true
        ? widget.classId
        : profile?.classTeacher?.classInfo.id;
    setState(() => _loading = true);
    try {
      final params = <String, dynamic>{'limit': '200'};
      if (classId != null && classId.isNotEmpty) params['classId'] = classId;
      final res = await ApiClient.get('/students', params: params);
      final list = res.data['students'] as List<dynamic>? ?? [];
      setState(() {
        _students = list;
        _filtered = list;
        _loading = false;
      });
    } catch (_) {
      setState(() => _loading = false);
    }
  }

  void _onSearch(String q) {
    setState(() {
      _search = q;
      if (q.isEmpty) {
        _filtered = _students;
      } else {
        final lower = q.toLowerCase();
        _filtered = _students.where((s) {
          final name = (s['name'] as String? ?? '').toLowerCase();
          final adm = (s['admissionNumber'] as String? ?? '').toLowerCase();
          return name.contains(lower) || adm.contains(lower);
        }).toList();
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final profile = context.watch<ProfileProvider>().profile;
    // Use explicit className (subject teacher) > class teacher class > fallback
    final classLabel = widget.className?.isNotEmpty == true
        ? widget.className!
        : profile?.classTeacher != null
            ? profile!.classTeacher!.classInfo.fullName
            : 'All Students';

    return Scaffold(
      backgroundColor: isDark ? AppColors.bgDark : AppColors.bgLight,
      body: Column(
        children: [
          // ── Header ──────────────────────────────────────────────────────
          Container(
            color: isDark ? AppColors.cardDark : Colors.white,
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Text('Class: ',
                        style: AppTypography.s14Regular(
                            color: AppColors.textMuted)),
                    Text(classLabel,
                        style: AppTypography.s14SemiBold(
                            color:
                                isDark ? Colors.white : AppColors.textPrimary)),
                    const Spacer(),
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 10, vertical: 4),
                      decoration: BoxDecoration(
                        color: AppColors.primary.withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(
                        '${_filtered.length} students',
                        style:
                            AppTypography.s12SemiBold(color: AppColors.primary),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                // Search bar
                Container(
                  height: 42,
                  decoration: BoxDecoration(
                    color: isDark
                        ? AppColors.borderDark.withValues(alpha: 0.4)
                        : const Color(0xFFF1F5F9),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: TextField(
                    onChanged: _onSearch,
                    style: AppTypography.s14Regular(
                        color: isDark ? Colors.white : AppColors.textPrimary),
                    decoration: InputDecoration(
                      hintText: 'Search by name or admission no.',
                      hintStyle:
                          AppTypography.s14Regular(color: AppColors.textMuted),
                      prefixIcon: Icon(Icons.search,
                          color: AppColors.textMuted, size: 20),
                      border: InputBorder.none,
                      contentPadding: const EdgeInsets.symmetric(vertical: 10),
                    ),
                  ),
                ),
              ],
            ),
          ),
          // ── List ─────────────────────────────────────────────────────────
          Expanded(
            child: _loading
                ? const SkeletonList()
                : _filtered.isEmpty
                    ? Center(
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(Icons.people_outline,
                                size: 56, color: AppColors.textMuted),
                            const SizedBox(height: 12),
                            Text(
                              _search.isEmpty
                                  ? 'No students found'
                                  : 'No results for "$_search"',
                              style: AppTypography.s16SemiBold(
                                  color: AppColors.textMuted),
                            ),
                          ],
                        ),
                      )
                    : RefreshIndicator(
                        onRefresh: _load,
                        child: ListView.builder(
                          physics: const AlwaysScrollableScrollPhysics(),
                          padding: const EdgeInsets.all(16),
                          itemCount: _filtered.length,
                          itemBuilder: (_, i) => GestureDetector(
                            onTap: () {
                              final student = _filtered[i];
                              final id = student['_id'] as String? ?? '';
                              final name = student['name'] as String? ?? '';
                              Navigator.push(
                                context,
                                MaterialPageRoute(
                                  builder: (_) => StudentDetailScreen(
                                    studentId: id,
                                    studentName: name,
                                  ),
                                ),
                              );
                            },
                            child: _StudentCard(
                                student: _filtered[i], isDark: isDark),
                          ),
                        ),
                      ),
          ),
        ],
      ),
    );
  }
}

class _StudentCard extends StatelessWidget {
  final dynamic student;
  final bool isDark;
  const _StudentCard({required this.student, required this.isDark});

  @override
  Widget build(BuildContext context) {
    final name = student['name'] as String? ?? '';
    final gender = student['gender'] as String? ?? '';
    final cls = student['currentClass'];
    final classLabel =
        cls is Map ? '${cls['name'] ?? ''} ${cls['section'] ?? ''}'.trim() : '';
    final roll = student['rollNumber'] as String? ?? '';

    final avatarColor = gender.toLowerCase() == 'female'
        ? const Color(0xFFEC4899)
        : AppColors.primary;

    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: isDark ? AppColors.cardDark : Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
            color: isDark ? AppColors.borderDark : AppColors.borderLight),
        boxShadow: isDark ? [] : AppColors.shadowSm,
      ),
      child: Row(
        children: [
          CircleAvatar(
            radius: 18,
            backgroundColor: avatarColor.withValues(alpha: 0.1),
            child: Text(
              name.isNotEmpty ? name[0].toUpperCase() : '?',
              style: AppTypography.s14Bold(color: avatarColor),
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(name,
                    style: AppTypography.s14SemiBold(
                        color: isDark ? Colors.white : AppColors.textPrimary)),
                if (roll.isNotEmpty) ...[
                  const SizedBox(height: 2),
                  Text('Roll: $roll',
                      style: AppTypography.s12Regular(
                          color: AppColors.textMuted)),
                ],
              ],
            ),
          ),
          Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (classLabel.isNotEmpty)
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
                  decoration: BoxDecoration(
                    color: AppColors.primary.withValues(alpha: 0.08),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Text(classLabel,
                      style: AppTypography.s12SemiBold(
                          color: AppColors.primary)),
                ),
              const SizedBox(width: 4),
              Icon(Icons.chevron_right, size: 16, color: AppColors.textMuted),
            ],
          ),
        ],
      ),
    );
  }
}
