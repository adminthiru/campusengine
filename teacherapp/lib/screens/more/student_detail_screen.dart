import 'package:flutter/material.dart';
import '../../core/constants.dart';
import '../../models/student.dart';
import '../../widgets/app_card.dart';

class StudentDetailScreen extends StatelessWidget {
  final Student student;
  const StudentDetailScreen({super.key, required this.student});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(student.name)),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            // Profile avatar
            Center(
              child: Column(
                children: [
                  CircleAvatar(
                    radius: 40,
                    backgroundColor: kPrimaryLight,
                    backgroundImage: student.photo != null ? NetworkImage(student.photo!) : null,
                    child: student.photo == null
                        ? Text(student.name[0], style: const TextStyle(
                            color: kPrimary, fontSize: 28, fontWeight: FontWeight.w700,
                          ))
                        : null,
                  ),
                  const SizedBox(height: 12),
                  Text(student.name, style: const TextStyle(
                    fontSize: 18, fontWeight: FontWeight.w700, color: kTextPrimary,
                  )),
                  if (student.admissionNumber != null)
                    Text(student.admissionNumber!, style: const TextStyle(
                      fontSize: 13, color: kTextMuted,
                    )),
                ],
              ),
            ),
            const SizedBox(height: 20),

            // Info card
            AppCard(
              child: Column(
                children: [
                  _InfoRow('Gender', student.gender ?? '—'),
                  const Divider(),
                  _InfoRow('Phone', student.phone ?? '—'),
                  if (student.dateOfBirth != null) ...[
                    const Divider(),
                    _InfoRow('Date of Birth', student.dateOfBirth!.substring(0, 10)),
                  ],
                ],
              ),
            ),
            const SizedBox(height: 12),

            // Guardians
            if (student.guardians.isNotEmpty) ...[
              AppCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('Guardians', style: TextStyle(
                      fontSize: 13, fontWeight: FontWeight.w700, color: kTextPrimary,
                    )),
                    const SizedBox(height: 12),
                    ...student.guardians.map((g) => Padding(
                      padding: const EdgeInsets.only(bottom: 10),
                      child: Row(
                        children: [
                          Container(
                            width: 36, height: 36,
                            decoration: BoxDecoration(
                              color: kPrimaryLight, shape: BoxShape.circle,
                            ),
                            child: const Icon(Icons.person_outline, color: kPrimary, size: 18),
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(g.name, style: const TextStyle(
                                  fontSize: 13, fontWeight: FontWeight.w600, color: kTextPrimary,
                                )),
                                if (g.relation != null)
                                  Text(g.relation!, style: const TextStyle(
                                    fontSize: 12, color: kTextMuted,
                                  )),
                              ],
                            ),
                          ),
                          if (g.phone != null)
                            Text(g.phone!, style: const TextStyle(
                              fontSize: 12, color: kTextSecondary,
                            )),
                        ],
                      ),
                    )),
                  ],
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _InfoRow extends StatelessWidget {
  final String label;
  final String value;
  const _InfoRow(this.label, this.value);

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        children: [
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
