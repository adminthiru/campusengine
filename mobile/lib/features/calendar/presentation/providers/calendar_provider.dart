import 'package:flutter/material.dart';
import '../../../../core/network/api_client.dart';
import '../../../../core/network/api_endpoints.dart';

// ── Type config (mirrors admin frontend TYPE_CONFIG) ─────────────────────────

class EventTypeConfig {
  final String label;
  final Color color;
  final Color bg;
  const EventTypeConfig(this.label, this.color, this.bg);
}

const Map<String, EventTypeConfig> kTypeConfig = {
  'holiday':  EventTypeConfig('Holiday',  Color(0xFFEF4444), Color(0xFFFEF2F2)),
  'event':    EventTypeConfig('Event',    Color(0xFF8B5CF6), Color(0xFFF5F3FF)),
  'exam_day': EventTypeConfig('Exam Day', Color(0xFFF59E0B), Color(0xFFFFFBEB)),
  'meeting':  EventTypeConfig('Meeting',  Color(0xFF10B981), Color(0xFFECFDF5)),
  'other':    EventTypeConfig('Other',    Color(0xFF64748B), Color(0xFFF8FAFC)),
};

EventTypeConfig typeConfigFor(String type) =>
    kTypeConfig[type] ?? kTypeConfig['other']!;

// ── Model ─────────────────────────────────────────────────────────────────────

class CalendarEvent {
  final String id;
  final String title;
  final DateTime date;
  final DateTime? endDate;
  final String type;
  final String? description;

  const CalendarEvent({
    required this.id,
    required this.title,
    required this.date,
    this.endDate,
    required this.type,
    this.description,
  });

  factory CalendarEvent.fromJson(Map<String, dynamic> j) {
    DateTime date;
    try {
      date = DateTime.parse(j['date'].toString()).toLocal();
    } catch (_) {
      date = DateTime.now();
    }
    DateTime? endDate;
    try {
      if (j['endDate'] != null) {
        endDate = DateTime.parse(j['endDate'].toString()).toLocal();
      }
    } catch (_) {
      endDate = null;
    }
    return CalendarEvent(
      id: j['_id']?.toString() ?? '',
      title: j['title']?.toString() ?? '',
      date: date,
      endDate: endDate,
      type: j['type']?.toString() ?? 'event',
      description: j['description']?.toString(),
    );
  }

  Color get color => typeConfigFor(type).color;
  Color get bg    => typeConfigFor(type).bg;
  String get typeLabel => typeConfigFor(type).label;
}

const List<String> kMonthNames = [
  'January', 'February', 'March',     'April',   'May',      'June',
  'July',    'August',   'September', 'October', 'November', 'December',
];

// ── Provider ──────────────────────────────────────────────────────────────────

class CalendarProvider extends ChangeNotifier {
  // ── Month view ──────────────────────────────────────────────────────────────
  bool _isMonthLoading = false;
  bool get isMonthLoading => _isMonthLoading;

  String? _monthError;
  String? get monthError => _monthError;

  /// Events for the currently loaded month, keyed by day-of-month (1–31).
  Map<int, List<CalendarEvent>> _eventsByDay = {};
  Map<int, List<CalendarEvent>> get eventsByDay => _eventsByDay;

  int _loadedMonthYear = 0;
  int _loadedMonth     = 0;

  List<CalendarEvent> eventsForDay(int day) => _eventsByDay[day] ?? [];

  Future<void> fetchMonth(int year, int month, {bool force = false}) async {
    if (!force && _loadedMonthYear == year && _loadedMonth == month) return;
    _isMonthLoading = true;
    _monthError = null;
    notifyListeners();
    try {
      final res = await ApiClient.get(
        ApiEndpoints.calendar,
        params: {'year': year, 'month': month},
      );
      final raw = res.data;
      final List data = (raw is Map ? raw['events'] : null) as List? ?? [];
      final events = <CalendarEvent>[];
      for (final e in data) {
        try {
          if (e is Map<String, dynamic>) {
            events.add(CalendarEvent.fromJson(e));
          }
        } catch (_) {}
      }
      _eventsByDay = {};
      for (final ev in events) {
        (_eventsByDay[ev.date.day] ??= []).add(ev);
      }
      _loadedMonthYear = year;
      _loadedMonth     = month;
    } catch (e) {
      _monthError = ApiClient.errorMessage(e);
    } finally {
      _isMonthLoading = false;
      notifyListeners();
    }
  }

  // ── List / year view ────────────────────────────────────────────────────────
  bool _isYearLoading = false;
  bool get isYearLoading => _isYearLoading;

  String? _yearError;
  String? get yearError => _yearError;

  /// All events for the loaded year, grouped by month name.
  Map<String, List<CalendarEvent>> _groupedByMonth = {};
  Map<String, List<CalendarEvent>> get groupedByMonth => _groupedByMonth;

  int _loadedYear = 0;

  Future<void> fetchYear(int year, {bool force = false}) async {
    if (!force && _loadedYear == year) return;
    _isYearLoading = true;
    _yearError = null;
    notifyListeners();
    try {
      final res = await ApiClient.get(
        ApiEndpoints.calendar,
        params: {'year': year},
      );
      final raw = res.data;
      final List data = (raw is Map ? raw['events'] : null) as List? ?? [];
      final events = <CalendarEvent>[];
      for (final e in data) {
        try {
          if (e is Map<String, dynamic>) {
            events.add(CalendarEvent.fromJson(e));
          }
        } catch (_) {}
      }
      events.sort((a, b) => a.date.compareTo(b.date));

      _groupedByMonth = {};
      for (final ev in events) {
        final monthName = kMonthNames[ev.date.month - 1];
        (_groupedByMonth[monthName] ??= []).add(ev);
      }
      _loadedYear = year;
    } catch (e) {
      _yearError = ApiClient.errorMessage(e);
    } finally {
      _isYearLoading = false;
      notifyListeners();
    }
  }
}
