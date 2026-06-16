import 'dart:async';
import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import '../../../../core/network/api_client.dart';

/// Handles geo-tagged self check-in / check-out for teachers & staff.
///
/// Both punches capture the current GPS location + time and are persisted on
/// the server (`/staff-attendance/*`), so admins can track staff login time
/// and location. State is restored from the server on load so the card stays
/// correct across app restarts.
class CheckInProvider extends ChangeNotifier {
  bool _isCheckedIn = false;
  bool get isCheckedIn => _isCheckedIn;

  bool _isLoading = false;
  bool get isLoading => _isLoading;

  bool _loadedToday = false;
  bool get loadedToday => _loadedToday;

  DateTime? _checkInTime;
  DateTime? get checkInTime => _checkInTime;

  DateTime? _checkOutTime;
  DateTime? get checkOutTime => _checkOutTime;

  String? _lastError;
  String? get lastError => _lastError;

  String _durationString = "00:00:00";
  String get durationString => _durationString;

  // School timing config (loaded from server)
  Map<String, dynamic> _timing = {};
  Map<String, dynamic> get timing => _timing;

  /// Whether the staff check-in feature is enabled for this school.
  /// Defaults to enabled until the config loads (avoids a flash of "disabled").
  bool get checkInEnabled => _timing['enabled'] != false;

  Timer? _timer;

  /// Restore today's punch state from the server (call on dashboard load).
  Future<void> loadToday() async {
    try {
      final res = await ApiClient.get('/staff-attendance/today');
      _applyRecord(res.data['record']);
      if (res.data['timing'] != null) {
        _timing = Map<String, dynamic>.from(res.data['timing'] as Map);
      }
    } catch (e) {
      debugPrint('loadToday error: ${ApiClient.errorMessage(e)}');
    } finally {
      _loadedToday = true;
      notifyListeners();
    }
  }

  /// Returns null if within check-in window, or a user-facing error string.
  String? _checkInWindowError() {
    final onTimeBy  = (_timing['onTimeBy']      as String?) ?? '10:00';
    final schoolEnd = (_timing['schoolEndTime'] as String?) ?? '16:00';

    final now     = DateTime.now();
    final nowMins = now.hour * 60 + now.minute;

    final startMin = _toMins(onTimeBy);
    final endMin   = _toMins(schoolEnd);

    if (nowMins < startMin) {
      return 'School starts by ${_toAmPm(onTimeBy)}. You can check in after that.';
    }
    if (nowMins >= endMin) {
      return 'School is finished by ${_toAmPm(schoolEnd)}. You can check in tomorrow by ${_toAmPm(onTimeBy)} only.';
    }
    return null;
  }

  static int _toMins(String t) {
    final parts = t.split(':');
    if (parts.length < 2) return 0;
    return (int.tryParse(parts[0]) ?? 0) * 60 + (int.tryParse(parts[1]) ?? 0);
  }

  static String _toAmPm(String t) {
    final parts = t.split(':');
    if (parts.length < 2) return t;
    final h = int.tryParse(parts[0]) ?? 0;
    final m = int.tryParse(parts[1]) ?? 0;
    final period = h >= 12 ? 'PM' : 'AM';
    final hour   = h % 12 == 0 ? 12 : h % 12;
    return '$hour:${m.toString().padLeft(2, '0')} $period';
  }

  /// Returns true on success. On failure, [lastError] holds a message.
  Future<bool> handleCheckInOut() {
    // Only validate window for check-in; checkout is always allowed
    if (!_isCheckedIn) {
      final windowError = _checkInWindowError();
      if (windowError != null) {
        _lastError = windowError;
        notifyListeners();
        return Future.value(false);
      }
    }
    return _isCheckedIn ? _punch(checkOut: true) : _punch(checkOut: false);
  }

  Future<bool> _punch({required bool checkOut}) async {
    _isLoading = true;
    _lastError = null;
    notifyListeners();
    try {
      final pos = await _resolveLocation();
      final path =
          checkOut ? '/staff-attendance/check-out' : '/staff-attendance/check-in';
      final res = await ApiClient.post(path, data: {
        'lat': pos.latitude,
        'lng': pos.longitude,
        'accuracy': pos.accuracy,
      });
      _applyRecord(res.data['record']);
      // If server says already done (e.g. auto-checkout already ran),
      // treat as success — state is synced, no error shown
      return true;
    } catch (e) {
      // If server already processed this punch, refresh state silently
      final msg = ApiClient.errorMessage(e);
      if (msg.toLowerCase().contains('already checked')) {
        await loadToday();
        return true; // not an error — just a stale state sync
      }
      _lastError = msg;
      debugPrint('check-in/out error: $_lastError');
      return false;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  /// Resolves the current GPS position, prompting for permission as needed.
  /// Throws a user-facing [String] message on any failure.
  Future<Position> _resolveLocation() async {
    final serviceEnabled = await Geolocator.isLocationServiceEnabled();
    if (!serviceEnabled) {
      throw 'Location is turned off. Please enable GPS and try again.';
    }

    var permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
    }
    if (permission == LocationPermission.denied) {
      throw 'Location permission denied. Allow location access to check in.';
    }
    if (permission == LocationPermission.deniedForever) {
      throw 'Location permission is permanently denied. Enable it in Settings.';
    }

    return Geolocator.getCurrentPosition(
      locationSettings: const LocationSettings(
        accuracy: LocationAccuracy.high,
        timeLimit: Duration(seconds: 20),
      ),
    );
  }

  /// Maps a server record onto local state.
  void _applyRecord(dynamic record) {
    if (record == null) {
      _isCheckedIn = false;
      _checkInTime = null;
      _checkOutTime = null;
      _stopTimer();
      _durationString = "00:00:00";
      return;
    }

    final ci = record['checkIn'];
    final co = record['checkOut'];
    _checkInTime = _parseTime(ci?['time']);
    _checkOutTime = _parseTime(co?['time']);

    // Considered "checked in" only when there's a check-in and no check-out.
    _isCheckedIn = _checkInTime != null && _checkOutTime == null;

    if (_isCheckedIn) {
      _startTimer();
    } else {
      _stopTimer();
      _durationString = (_checkInTime != null && _checkOutTime != null)
          ? _formatDuration(_checkOutTime!.difference(_checkInTime!))
          : "00:00:00";
    }
  }

  DateTime? _parseTime(dynamic value) {
    if (value == null) return null;
    return DateTime.tryParse(value.toString())?.toLocal();
  }

  void _startTimer() {
    _timer?.cancel();
    if (_checkInTime != null) {
      _durationString = _formatDuration(DateTime.now().difference(_checkInTime!));
    }
    _timer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (_checkInTime != null) {
        _durationString =
            _formatDuration(DateTime.now().difference(_checkInTime!));
        notifyListeners();
      }
    });
  }

  void _stopTimer() {
    _timer?.cancel();
    _timer = null;
  }

  String _formatDuration(Duration duration) {
    String twoDigits(int n) => n.toString().padLeft(2, "0");
    final h = twoDigits(duration.inHours);
    final m = twoDigits(duration.inMinutes.remainder(60));
    final s = twoDigits(duration.inSeconds.remainder(60));
    return "$h:$m:$s";
  }

  @override
  void dispose() {
    _stopTimer();
    super.dispose();
  }
}
