import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/constants.dart';
import '../../providers/auth_provider.dart';
import '../../providers/teacher_profile_provider.dart';
import '../../widgets/app_card.dart';
import '../auth/change_password_screen.dart';
import '../auth/login_screen.dart';

class ProfileScreen extends StatelessWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final profile = context.watch<TeacherProfileProvider>().profile;
    final user = auth.user;
    final emp = profile?.employee;

    return Scaffold(
      appBar: AppBar(title: const Text('Profile')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            // Avatar + name
            Center(
              child: Column(
                children: [
                  CircleAvatar(
                    radius: 44,
                    backgroundColor: kPrimaryLight,
                    backgroundImage: (emp?.photo ?? user?.avatar) != null
                        ? NetworkImage(emp?.photo ?? user!.avatar!)
                        : null,
                    child: (emp?.photo == null && user?.avatar == null)
                        ? Text(
                            user?.name.isNotEmpty == true
                                ? user!.name[0].toUpperCase() : 'T',
                            style: const TextStyle(
                              color: kPrimary, fontSize: 32, fontWeight: FontWeight.w700,
                            ),
                          )
                        : null,
                  ),
                  const SizedBox(height: 14),
                  Text(user?.name ?? '—', style: const TextStyle(
                    fontSize: 18, fontWeight: FontWeight.w700, color: kTextPrimary,
                  )),
                  if (emp?.designation != null)
                    Text(emp!.designation!, style: const TextStyle(
                      fontSize: 13, color: kTextMuted,
                    )),
                  const SizedBox(height: 6),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                    decoration: BoxDecoration(
                      color: kPrimaryLight, borderRadius: BorderRadius.circular(20),
                    ),
                    child: Text(
                      profile?.isClassTeacher == true
                          ? 'Class Teacher'
                          : profile?.isSubjectTeacher == true
                              ? 'Subject Teacher'
                              : 'Teacher',
                      style: const TextStyle(
                        fontSize: 12, fontWeight: FontWeight.w600, color: kPrimary,
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),

            // Info card
            AppCard(
              child: Column(
                children: [
                  _InfoRow(Icons.badge_outlined, 'Employee ID', emp?.employeeId ?? '—'),
                  const Divider(),
                  _InfoRow(Icons.email_outlined, 'Email', user?.email ?? '—'),
                  if (user?.phone != null) ...[
                    const Divider(),
                    _InfoRow(Icons.phone_outlined, 'Phone', user!.phone!),
                  ],
                  if (emp?.department != null) ...[
                    const Divider(),
                    _InfoRow(Icons.business_outlined, 'Department', emp!.department!),
                  ],
                ],
              ),
            ),
            const SizedBox(height: 12),

            // School card
            if (user?.school != null)
              AppCard(
                child: _InfoRow(
                  Icons.school_outlined, 'School', user!.school!.name,
                ),
              ),
            const SizedBox(height: 20),

            // Actions
            _ActionButton(
              icon: Icons.lock_outline,
              label: 'Change Password',
              color: kPrimary,
              onTap: () => Navigator.push(context,
                  MaterialPageRoute(builder: (_) => const ChangePasswordScreen())),
            ),
            const SizedBox(height: 10),
            _ActionButton(
              icon: Icons.logout_rounded,
              label: 'Logout',
              color: kDanger,
              onTap: () async {
                await context.read<AuthProvider>().logout();
                if (context.mounted) {
                  context.read<TeacherProfileProvider>().reset();
                  Navigator.of(context).pushAndRemoveUntil(
                    MaterialPageRoute(builder: (_) => const LoginScreen()),
                    (_) => false,
                  );
                }
              },
            ),
          ],
        ),
      ),
    );
  }
}

class _InfoRow extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;

  const _InfoRow(this.icon, this.label, this.value);

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        children: [
          Icon(icon, size: 16, color: kTextMuted),
          const SizedBox(width: 10),
          Text(label, style: const TextStyle(fontSize: 13, color: kTextMuted)),
          const Spacer(),
          Text(value, style: const TextStyle(
            fontSize: 13, fontWeight: FontWeight.w500, color: kTextPrimary,
          )),
        ],
      ),
    );
  }
}

class _ActionButton extends StatelessWidget {
  final IconData icon;
  final String label;
  final Color color;
  final VoidCallback onTap;

  const _ActionButton({
    required this.icon, required this.label,
    required this.color, required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        decoration: BoxDecoration(
          color: kCardBg,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: kBorder),
        ),
        child: Row(
          children: [
            Icon(icon, color: color, size: 18),
            const SizedBox(width: 12),
            Text(label, style: TextStyle(
              fontSize: 14, fontWeight: FontWeight.w500, color: color,
            )),
            const Spacer(),
            Icon(Icons.chevron_right, color: color.withOpacity(0.5), size: 18),
          ],
        ),
      ),
    );
  }
}
