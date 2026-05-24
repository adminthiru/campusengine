import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:skl_teacher/app/app.dart';

void main() {
  testWidgets('App launches and shows splash screen', (WidgetTester tester) async {
    await tester.pumpWidget(const SKLTeacherApp());
    await tester.pump();
    expect(find.byType(MaterialApp), findsOneWidget);
  });
}
