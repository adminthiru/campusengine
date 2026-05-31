import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import '../storage/secure_storage.dart';

class ApiClient {
  static final Dio _dio = Dio(BaseOptions(
    baseUrl:
        kIsWeb ? 'http://localhost:5000/api' : 'http://172.20.10.2:5000/api',
    connectTimeout: const Duration(seconds: 60),
    receiveTimeout: const Duration(seconds: 60),
    headers: {'Content-Type': 'application/json'},
  ));

  static bool _initialized = false;

  static Future<void> init() async {
    if (_initialized) return;
    _initialized = true;
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

  static Future<Response> get(String path,
      {Map<String, dynamic>? params}) async {
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
      final body = e.response?.data;

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
          return 'Connection timed out';
        case DioExceptionType.connectionError:
          return 'Cannot connect to server';
        case DioExceptionType.badResponse:
          return status != null
              ? 'Server returned $status'
              : 'Bad server response';
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
