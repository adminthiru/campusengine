import 'package:flutter/material.dart';

class NotificationsScreen extends StatelessWidget {
  const NotificationsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Notifications')),
      body: Center(
        child: Text('Notifications — Coming Soon',
          style: Theme.of(context).textTheme.titleMedium),
      ),
    );
  }
}
