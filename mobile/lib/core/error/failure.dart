// ── Failure Types — sealed class for typed error handling ────────────────────

abstract class Failure {
  const Failure(this.message);
  final String message;

  @override
  String toString() => message;
}

/// No internet connectivity
class NetworkFailure extends Failure {
  const NetworkFailure([super.message = 'No internet connection. Please check your network.']);
}

/// HTTP 4xx / 5xx errors from the server
class ServerFailure extends Failure {
  const ServerFailure([super.message = 'Something went wrong. Please try again.']);
  ServerFailure.withCode(int code) : super(_messageForCode(code));

  static String _messageForCode(int code) => switch (code) {
    400 => 'Invalid request. Please check your input.',
    401 => 'Session expired. Please log in again.',
    403 => 'You are not authorized to perform this action.',
    404 => 'The requested resource was not found.',
    408 => 'Request timed out. Please try again.',
    422 => 'Validation failed. Please check your input.',
    429 => 'Too many requests. Please wait and try again.',
    500 => 'Internal server error. Please try again later.',
    502 || 503 => 'Service temporarily unavailable.',
    _ => 'Something went wrong (code $code).',
  };
}

/// JWT / session issues
class AuthFailure extends Failure {
  const AuthFailure([super.message = 'Authentication failed. Please log in again.']);
}

/// Hive / local storage errors
class CacheFailure extends Failure {
  const CacheFailure([super.message = 'Failed to load cached data.']);
}

/// Form / input validation errors
class ValidationFailure extends Failure {
  const ValidationFailure(super.message);
}

/// Resource not found (404)
class NotFoundFailure extends Failure {
  const NotFoundFailure([super.message = 'Resource not found.']);
}

/// Timeout errors
class TimeoutFailure extends Failure {
  const TimeoutFailure([super.message = 'Request timed out. Please try again.']);
}

/// Unknown / unexpected errors
class UnknownFailure extends Failure {
  const UnknownFailure([super.message = 'An unexpected error occurred.']);
}
