import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../storage/secure_storage.dart';

class ApiClient {
  static const String _defaultBaseUrl = 'http://172.20.10.5:5000/api';
  static const String _prefKeyBaseUrl = 'server_base_url';

  static Dio? _dioInstance;
  static bool _initialized = false;

  static Dio get _dio {
    _dioInstance ??= Dio(BaseOptions(
      baseUrl: _defaultBaseUrl,
      connectTimeout: const Duration(seconds: 15),
      receiveTimeout: const Duration(seconds: 15),
      headers: {'Content-Type': 'application/json'},
    ));
    return _dioInstance!;
  }

  // Call this to update the server IP at runtime (no rebuild needed)
  static Future<void> setBaseUrl(String ip) async {
    final url = 'http://$ip:5000/api';
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_prefKeyBaseUrl, url);
    _dioInstance = null; // force recreate with new base URL
    _initialized = false;
    final newDio = Dio(BaseOptions(
      baseUrl: url,
      connectTimeout: const Duration(seconds: 15),
      receiveTimeout: const Duration(seconds: 15),
      headers: {'Content-Type': 'application/json'},
    ));
    _dioInstance = newDio;
    await _addInterceptors();
    debugPrint('ApiClient baseUrl updated to: $url');
  }

  static String get currentBaseUrl =>
      _dioInstance?.options.baseUrl ?? _defaultBaseUrl;

  static Future<void> _addInterceptors() async {
    _dio.interceptors.clear();
    _dio.interceptors.add(InterceptorsWrapper(
      onRequest: (options, handler) async {
        final token = await SecureStorageService.instance.getAccessToken();
        if (token != null && token.isNotEmpty) {
          options.headers['Authorization'] = 'Bearer $token';
        }
        handler.next(options);
      },
      onError: (DioException e, handler) {
        debugPrint('API Error: ${e.message} at ${e.requestOptions.path}');
        handler.next(e);
      },
    ));
  }

  static Future<void> init() async {
    if (_initialized) return;
    _initialized = true;

    // Restore saved IP from prefs if available
    final prefs = await SharedPreferences.getInstance();
    final saved = prefs.getString(_prefKeyBaseUrl);
    if (saved != null && saved.isNotEmpty) {
      _dioInstance = Dio(BaseOptions(
        baseUrl: saved,
        connectTimeout: const Duration(seconds: 15),
        receiveTimeout: const Duration(seconds: 15),
        headers: {'Content-Type': 'application/json'},
      ));
    }
    await _addInterceptors();
  }

  static Future<Response> get(String path, {Map<String, dynamic>? params}) async {
    await init();
    return _dio.get(path, queryParameters: params);
  }

  static Future<Response> post(String path, {dynamic data}) async {
    await init();
    return _dio.post(path, data: data);
  }

  static Future<Response> put(String path, {dynamic data}) async {
    await init();
    return _dio.put(path, data: data);
  }

  static Future<Response> delete(String path, {dynamic data}) async {
    await init();
    return _dio.delete(path, data: data);
  }

  static String errorMessage(dynamic e) {
    if (e is DioException) {
      final status = e.response?.statusCode;
      final body   = e.response?.data;

      debugPrint(
        'DioException [${e.type.name}] '
        'status=$status path=${e.requestOptions.path} '
        'body=$body',
      );

      if (body is Map) {
        final msg = body['message'] ?? body['error'];
        if (msg != null) return msg.toString();
      }

      switch (e.type) {
        case DioExceptionType.connectionTimeout:
        case DioExceptionType.sendTimeout:
        case DioExceptionType.receiveTimeout:
          return 'Connection timed out. Check server IP in settings.';
        case DioExceptionType.connectionError:
          return 'Cannot connect to server';
        case DioExceptionType.badResponse:
          return status != null ? 'Server returned $status' : 'Bad server response';
        case DioExceptionType.cancel:
          return 'Request cancelled';
        case DioExceptionType.badCertificate:
          return 'SSL certificate error';
        default:
          return status != null ? 'Error $status' : 'Network error';
      }
    }
    debugPrint('Non-Dio error: ${e.runtimeType}: $e');
    return e.toString();
  }
}
