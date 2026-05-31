// ── App Typography — Inter font throughout the entire application ─────────────
// Uses google_fonts package to load Inter at runtime (cached after first load).
// ─────────────────────────────────────────────────────────────────────────────

import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'app_colors.dart';

class AppTypography {
  AppTypography._();

  // ── Base Inter TextTheme for light mode ──────────────────────────────────
  static TextTheme get lightTextTheme => GoogleFonts.interTextTheme(
    const TextTheme(
      // Display
      displayLarge:  TextStyle(fontSize: 40, fontWeight: FontWeight.w700, letterSpacing: -0.5, color: AppColors.textPrimary),
      displayMedium: TextStyle(fontSize: 32, fontWeight: FontWeight.w700, letterSpacing: -0.5, color: AppColors.textPrimary),
      displaySmall:  TextStyle(fontSize: 30, fontWeight: FontWeight.w600, letterSpacing: -0.4, color: AppColors.textPrimary),
      // Headline
      headlineLarge:  TextStyle(fontSize: 24, fontWeight: FontWeight.w700, letterSpacing: -0.3, color: AppColors.textPrimary),
      headlineMedium: TextStyle(fontSize: 20, fontWeight: FontWeight.w600, letterSpacing: -0.2, color: AppColors.textPrimary),
      headlineSmall:  TextStyle(fontSize: 18, fontWeight: FontWeight.w600, letterSpacing: -0.2, color: AppColors.textPrimary),
      // Title
      titleLarge:  TextStyle(fontSize: 16, fontWeight: FontWeight.w600, letterSpacing: -0.2, color: AppColors.textPrimary),
      titleMedium: TextStyle(fontSize: 14, fontWeight: FontWeight.w500, letterSpacing: -0.2, color: AppColors.textPrimary),
      titleSmall:  TextStyle(fontSize: 12, fontWeight: FontWeight.w500, letterSpacing: -0.1, color: AppColors.textSecondary),
      // Body
      bodyLarge:   TextStyle(fontSize: 16, fontWeight: FontWeight.w400, letterSpacing: -0.2, color: AppColors.textPrimary),
      bodyMedium:  TextStyle(fontSize: 14, fontWeight: FontWeight.w400, letterSpacing: -0.2, color: AppColors.textPrimary),
      bodySmall:   TextStyle(fontSize: 12, fontWeight: FontWeight.w400, letterSpacing: -0.1, color: AppColors.textSecondary),
      // Label
      labelLarge:  TextStyle(fontSize: 14, fontWeight: FontWeight.w500, letterSpacing: -0.1, color: AppColors.textPrimary),
      labelMedium: TextStyle(fontSize: 12, fontWeight: FontWeight.w500, letterSpacing: -0.1, color: AppColors.textSecondary),
      labelSmall:  TextStyle(fontSize: 10, fontWeight: FontWeight.w500, letterSpacing: 0.2,  color: AppColors.textMuted),
    ),
  );

  // ── Dark mode text theme ─────────────────────────────────────────────────
  static TextTheme get darkTextTheme => GoogleFonts.interTextTheme(
    const TextTheme(
      displayLarge:  TextStyle(fontSize: 40, fontWeight: FontWeight.w700, letterSpacing: -0.5, color: AppColors.textWhite),
      displayMedium: TextStyle(fontSize: 32, fontWeight: FontWeight.w700, letterSpacing: -0.5, color: AppColors.textWhite),
      displaySmall:  TextStyle(fontSize: 30, fontWeight: FontWeight.w600, letterSpacing: -0.4, color: AppColors.textWhite),
      headlineLarge:  TextStyle(fontSize: 24, fontWeight: FontWeight.w700, letterSpacing: -0.3, color: AppColors.textWhite),
      headlineMedium: TextStyle(fontSize: 20, fontWeight: FontWeight.w600, letterSpacing: -0.2, color: AppColors.textWhite),
      headlineSmall:  TextStyle(fontSize: 18, fontWeight: FontWeight.w600, letterSpacing: -0.2, color: AppColors.textWhite),
      titleLarge:  TextStyle(fontSize: 16, fontWeight: FontWeight.w600, letterSpacing: -0.2, color: AppColors.textWhite),
      titleMedium: TextStyle(fontSize: 14, fontWeight: FontWeight.w500, letterSpacing: -0.2, color: AppColors.textWhite),
      titleSmall:  TextStyle(fontSize: 12, fontWeight: FontWeight.w500, letterSpacing: -0.1, color: Color(0xFF94A3B8)),
      bodyLarge:   TextStyle(fontSize: 16, fontWeight: FontWeight.w400, letterSpacing: -0.2, color: AppColors.textWhite),
      bodyMedium:  TextStyle(fontSize: 14, fontWeight: FontWeight.w400, letterSpacing: -0.2, color: AppColors.textWhite),
      bodySmall:   TextStyle(fontSize: 12, fontWeight: FontWeight.w400, letterSpacing: -0.1, color: Color(0xFF94A3B8)),
      labelLarge:  TextStyle(fontSize: 14, fontWeight: FontWeight.w500, letterSpacing: -0.1, color: AppColors.textWhite),
      labelMedium: TextStyle(fontSize: 12, fontWeight: FontWeight.w500, letterSpacing: -0.1, color: Color(0xFF94A3B8)),
      labelSmall:  TextStyle(fontSize: 10, fontWeight: FontWeight.w500, letterSpacing: 0.2,  color: Color(0xFF64748B)),
    ),
  );

  // ── Scale Typography Helpers ─────────────────────────────────────────────
  static TextStyle _base(double size, FontWeight weight, double height, Color? color) {
    return GoogleFonts.inter(
      fontSize: size,
      fontWeight: weight,
      height: height / size,
      letterSpacing: -0.02 * size,
      color: color,
    );
  }

  // Size 10
  static TextStyle s10Regular({Color? color}) => _base(10, FontWeight.w400, 16, color);
  static TextStyle s10Medium({Color? color}) => _base(10, FontWeight.w500, 16, color);
  static TextStyle s10SemiBold({Color? color}) => _base(10, FontWeight.w600, 16, color);
  static TextStyle s10Bold({Color? color}) => _base(10, FontWeight.w700, 16, color);

  // Size 11
  static TextStyle s11Regular({Color? color}) => _base(11, FontWeight.w400, 17, color);
  static TextStyle s11Medium({Color? color}) => _base(11, FontWeight.w500, 17, color);
  static TextStyle s11SemiBold({Color? color}) => _base(11, FontWeight.w600, 17, color);
  static TextStyle s11Bold({Color? color}) => _base(11, FontWeight.w700, 17, color);

  // Size 12
  static TextStyle s12Regular({Color? color}) => _base(12, FontWeight.w400, 18, color);
  static TextStyle s12Medium({Color? color}) => _base(12, FontWeight.w500, 18, color);
  static TextStyle s12SemiBold({Color? color}) => _base(12, FontWeight.w600, 18, color);
  static TextStyle s12Bold({Color? color}) => _base(12, FontWeight.w700, 18, color);

  // Size 13
  static TextStyle s13Regular({Color? color}) => _base(13, FontWeight.w400, 19, color);
  static TextStyle s13Medium({Color? color}) => _base(13, FontWeight.w500, 19, color);
  static TextStyle s13SemiBold({Color? color}) => _base(13, FontWeight.w600, 19, color);
  static TextStyle s13Bold({Color? color}) => _base(13, FontWeight.w700, 19, color);

  // Size 14
  static TextStyle s14Regular({Color? color}) => _base(14, FontWeight.w400, 20, color);
  static TextStyle s14Medium({Color? color}) => _base(14, FontWeight.w500, 20, color);
  static TextStyle s14SemiBold({Color? color}) => _base(14, FontWeight.w600, 20, color);
  static TextStyle s14Bold({Color? color}) => _base(14, FontWeight.w700, 20, color);

  // Size 15
  static TextStyle s15Regular({Color? color}) => _base(15, FontWeight.w400, 22, color);
  static TextStyle s15Medium({Color? color}) => _base(15, FontWeight.w500, 22, color);
  static TextStyle s15SemiBold({Color? color}) => _base(15, FontWeight.w600, 22, color);
  static TextStyle s15Bold({Color? color}) => _base(15, FontWeight.w700, 22, color);

  // Size 16
  static TextStyle s16Regular({Color? color}) => _base(16, FontWeight.w400, 24, color);
  static TextStyle s16Medium({Color? color}) => _base(16, FontWeight.w500, 24, color);
  static TextStyle s16SemiBold({Color? color}) => _base(16, FontWeight.w600, 24, color);
  static TextStyle s16Bold({Color? color}) => _base(16, FontWeight.w700, 24, color);

  // Size 18
  static TextStyle s18Regular({Color? color}) => _base(18, FontWeight.w400, 28, color);
  static TextStyle s18Medium({Color? color}) => _base(18, FontWeight.w500, 28, color);
  static TextStyle s18SemiBold({Color? color}) => _base(18, FontWeight.w600, 28, color);
  static TextStyle s18Bold({Color? color}) => _base(18, FontWeight.w700, 28, color);

  // Size 20
  static TextStyle s20Regular({Color? color}) => _base(20, FontWeight.w400, 30, color);
  static TextStyle s20Medium({Color? color}) => _base(20, FontWeight.w500, 30, color);
  static TextStyle s20SemiBold({Color? color}) => _base(20, FontWeight.w600, 30, color);
  static TextStyle s20Bold({Color? color}) => _base(20, FontWeight.w700, 30, color);

  // Size 24
  static TextStyle s24Regular({Color? color}) => _base(24, FontWeight.w400, 32, color);
  static TextStyle s24Medium({Color? color}) => _base(24, FontWeight.w500, 32, color);
  static TextStyle s24SemiBold({Color? color}) => _base(24, FontWeight.w600, 32, color);
  static TextStyle s24Bold({Color? color}) => _base(24, FontWeight.w700, 32, color);

  // Size 30
  static TextStyle s30Regular({Color? color}) => _base(30, FontWeight.w400, 38, color);
  static TextStyle s30Medium({Color? color}) => _base(30, FontWeight.w500, 38, color);
  static TextStyle s30SemiBold({Color? color}) => _base(30, FontWeight.w600, 38, color);
  static TextStyle s30Bold({Color? color}) => _base(30, FontWeight.w700, 38, color);

  // Size 32
  static TextStyle s32Regular({Color? color}) => _base(32, FontWeight.w400, 40, color);
  static TextStyle s32Medium({Color? color}) => _base(32, FontWeight.w500, 40, color);
  static TextStyle s32SemiBold({Color? color}) => _base(32, FontWeight.w600, 40, color);
  static TextStyle s32Bold({Color? color}) => _base(32, FontWeight.w700, 40, color);

  // Backward compatibility convenience method
  static TextStyle inter({
    double size = 14,
    FontWeight weight = FontWeight.w400,
    Color? color,
    double letterSpacing = -0.02,
    double? height,
  }) =>
      GoogleFonts.inter(
        fontSize: size,
        fontWeight: weight,
        color: color,
        letterSpacing: letterSpacing * size,
        height: height,
      );
}
