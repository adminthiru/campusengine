import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

// Web/Chrome uses localhost; Android emulator uses 10.0.2.2
final String kBaseUrl = kIsWeb
    ? 'http://localhost:5000/api'
    : 'http://10.0.2.2:5000/api';

// Brand colors — matches admin web UI exactly
const Color kPrimary       = Color(0xFF1A56E8);
const Color kPrimaryLight  = Color(0xFFEFF6FF);
const Color kPrimaryDark   = Color(0xFF1E40AF);
const Color kSuccess       = Color(0xFF10B981);
const Color kSuccessLight  = Color(0xFFF0FDF4);
const Color kWarning       = Color(0xFFF59E0B);
const Color kWarningLight  = Color(0xFFFFFBEB);
const Color kDanger        = Color(0xFFEF4444);
const Color kDangerLight   = Color(0xFFFEF2F2);
const Color kBackground    = Color(0xFFF4F6FB);
const Color kCardBg        = Color(0xFFFFFFFF);
const Color kTextPrimary   = Color(0xFF0F172A);
const Color kTextSecondary = Color(0xFF64748B);
const Color kTextMuted     = Color(0xFF94A3B8);
const Color kBorder        = Color(0xFFE2E8F0);
const Color kPurple        = Color(0xFF8B5CF6);
const Color kPurpleLight   = Color(0xFFF5F3FF);
const Color kCyan          = Color(0xFF06B6D4);
const Color kCyanLight     = Color(0xFFECFEFF);
