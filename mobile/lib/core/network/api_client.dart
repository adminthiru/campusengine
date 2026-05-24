import 'dart:io';
import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import '../storage/secure_storage.dart';

class ApiClient {
  static final Dio _dio = Dio(BaseOptions(
    baseUrl: kIsWeb
        ? 'http://localhost:5000/api'
        : (Platform.isAndroid
            ? 'http://10.0.2.2:5000/api'
            : 'http://localhost:5000/api'),
    connectTimeout: const Duration(seconds: 15),
    receiveTimeout: const Duration(seconds: 15),
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
      final data = e.response?.data;
      if (data is Map && data['message'] != null) return data['message'];
      if (e.type == DioExceptionType.connectionTimeout ||
          e.type == DioExceptionType.receiveTimeout) {
        return 'Connection timed out';
      }
      if (e.type == DioExceptionType.connectionError) return 'Cannot connect to server';
    }
    return 'Something went wrong';
  }
}
