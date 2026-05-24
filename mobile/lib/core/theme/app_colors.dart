// ── App Color Tokens (mirrors SKL Web CSS variables) ─────────────────────────
// Web: --primary: #1a56e8 | --accent-red: #ef4444 | --bg: #f0f4f8 etc.
// ─────────────────────────────────────────────────────────────────────────────

import 'package:flutter/material.dart';

class AppColors {
  AppColors._();

  // ── Brand ────────────────────────────────────────────────────────────────
  static const Color primary      = Color(0xFF1A56E8); // --primary
  static const Color primaryDark  = Color(0xFF1240C4); // --primary-dark
  static const Color primaryLight = Color(0xFF3B82F6); // --primary-light

  // ── Accent ───────────────────────────────────────────────────────────────
  static const Color accent       = Color(0xFFF59E0B); // --accent (amber)
  static const Color accentGreen  = Color(0xFF10B981); // --accent-green
  static const Color accentRed    = Color(0xFFEF4444); // --accent-red
  static const Color accentPurple = Color(0xFF8B5CF6); // --accent-purple
  static const Color accentOrange = Color(0xFFF97316); // --accent-orange

  // ── Light Mode Surfaces ───────────────────────────────────────────────────
  static const Color bgLight      = Color(0xFFF0F4F8); // --bg
  static const Color cardLight    = Color(0xFFFFFFFF); // --bg-card
  static const Color borderLight  = Color(0xFFE2E8F0); // --border

  // ── Dark Mode Surfaces ────────────────────────────────────────────────────
  static const Color bgDark       = Color(0xFF0F172A); // --secondary / --bg-sidebar
  static const Color cardDark     = Color(0xFF1E293B); // --bg-sidebar-hover
  static const Color borderDark   = Color(0xFF334155);

  // ── Text ─────────────────────────────────────────────────────────────────
  static const Color textPrimary   = Color(0xFF0F172A); // --text-primary
  static const Color textSecondary = Color(0xFF475569); // --text-secondary
  static const Color textMuted     = Color(0xFF94A3B8); // --text-muted
  static const Color textWhite     = Color(0xFFFFFFFF); // --text-white

  // ── Status ───────────────────────────────────────────────────────────────
  static const Color success = Color(0xFF10B981);
  static const Color warning = Color(0xFFF59E0B);
  static const Color error   = Color(0xFFEF4444);
  static const Color info    = Color(0xFF3B82F6);

  // ── Shadows ──────────────────────────────────────────────────────────────
  static List<BoxShadow> shadowSm = [
    BoxShadow(color: Colors.black.withValues(alpha: 0.08), blurRadius: 3, offset: const Offset(0, 1)),
  ];
  static List<BoxShadow> shadowMd = [
    BoxShadow(color: Colors.black.withValues(alpha: 0.08), blurRadius: 16, offset: const Offset(0, 4)),
  ];
  static List<BoxShadow> shadowLg = [
    BoxShadow(color: Colors.black.withValues(alpha: 0.12), blurRadius: 32, offset: const Offset(0, 8)),
  ];

  // ── Badge backgrounds ────────────────────────────────────────────────────
  static const Color badgeSuccessBg = Color(0xFFF0FDF4);
  static const Color badgeDangerBg  = Color(0xFFFEF2F2);
  static const Color badgeWarningBg = Color(0xFFFFFBEB);
  static const Color badgeInfoBg    = Color(0xFFEFF6FF);
  static const Color badgePurpleBg  = Color(0xFFFAF5FF);
}
