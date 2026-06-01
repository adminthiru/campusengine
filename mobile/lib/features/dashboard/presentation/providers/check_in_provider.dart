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

  Timer? _timer;

  /// Restore today's punch state from the server (call on dashboard load).
  Future<void> loadToday() async {
    try {
      final res = await ApiClient.get('/staff-attendance/today');
      _applyRecord(res.data['record']);
    } catch (e) {
      debugPrint('loadToday error: ${ApiClient.errorMessage(e)}');
    } finally {
      _loadedToday = true;
      notifyListeners();
    }
  }

  /// Returns true on success. On failure, [lastError] holds a message.
  Future<bool> handleCheckInOut() {
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
      return true;
    } catch (e) {
      _lastError = e is String ? e : ApiClient.errorMessage(e);
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
