import 'dart:async';
import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import '../../../../core/network/api_client.dart';

class CheckInProvider extends ChangeNotifier {
  bool _isCheckedIn = false;
  bool get isCheckedIn => _isCheckedIn;

  bool _isLoading = false;
  bool get isLoading => _isLoading;

  DateTime? _checkInTime;
  DateTime? get checkInTime => _checkInTime;

  String _durationString = "00:00:00";
  String get durationString => _durationString;

  Timer? _timer;

  Future<void> handleCheckInOut() async {
    if (_isCheckedIn) {
      await _checkOut();
    } else {
      await _checkIn();
    }
  }

  Future<void> _checkIn() async {
    _isLoading = true;
    notifyListeners();

    try {
      bool serviceEnabled;
      LocationPermission permission;

      // Test if location services are enabled.
      serviceEnabled = await Geolocator.isLocationServiceEnabled();
      if (!serviceEnabled) {
        throw Exception('Location services are disabled.');
      }

      permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
        if (permission == LocationPermission.denied) {
          throw Exception('Location permissions are denied');
        }
      }

      if (permission == LocationPermission.deniedForever) {
        throw Exception('Location permissions are permanently denied, we cannot request permissions.');
      }

      // Fetch the location
      await Geolocator.getCurrentPosition(
        desiredAccuracy: LocationAccuracy.high,
      );

      // Make the actual API call
      await ApiClient.post('/attendance/employee', data: {
        'status': 'present'
      });

      // Once location is fetched, successfully checked in
      _isCheckedIn = true;
      _checkInTime = DateTime.now();
      _startTimer();
    } catch (e) {
      debugPrint('Check in error: $e');
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> _checkOut() async {
    _isLoading = true;
    notifyListeners();
    
    // In a real app we'd call an API here to register check out time.
    // However, the backend currently only marks status: 'present'
    await Future.delayed(const Duration(milliseconds: 500)); 

    _stopTimer();
    _isCheckedIn = false;
    _checkInTime = null;
    _durationString = "00:00:00";

    _isLoading = false;
    notifyListeners();
  }

  void _startTimer() {
    _timer?.cancel();
    _timer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (_checkInTime != null) {
        final duration = DateTime.now().difference(_checkInTime!);
        _durationString = _formatDuration(duration);
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
    String twoDigitMinutes = twoDigits(duration.inMinutes.remainder(60));
    String twoDigitSeconds = twoDigits(duration.inSeconds.remainder(60));
    return "${twoDigits(duration.inHours)}:$twoDigitMinutes:$twoDigitSeconds";
  }

  @override
  void dispose() {
    _stopTimer();
    super.dispose();
  }
}
