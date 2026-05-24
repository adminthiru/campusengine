import 'package:flutter/material.dart';

class LeaveScreen extends StatelessWidget {
  const LeaveScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Leave')),
      body: Center(
        child: Text('Leave — Coming Soon',
          style: Theme.of(context).textTheme.titleMedium),
      ),
    );
  }
}
