import 'package:flutter/material.dart';

class HomeworkScreen extends StatelessWidget {
  const HomeworkScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Center(
        child: Text('Homework — Coming Soon',
          style: Theme.of(context).textTheme.titleMedium),
      ),
    );
  }
}
