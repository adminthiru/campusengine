import 'package:flutter/material.dart';

class ExamsScreen extends StatelessWidget {
  const ExamsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Exams')),
      body: Center(
        child: Text('Exams — Coming Soon',
          style: Theme.of(context).textTheme.titleMedium),
      ),
    );
  }
}
