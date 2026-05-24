import 'package:flutter_test/flutter_test.dart';
import 'package:teacherapp/main.dart';

void main() {
  testWidgets('App smoke test', (WidgetTester tester) async {
    await tester.pumpWidget(const TeacherApp());
    expect(find.byType(TeacherApp), findsOneWidget);
  });
}
