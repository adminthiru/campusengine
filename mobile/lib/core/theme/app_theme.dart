// ── App Theme — Light & Dark with Inter font ──────────────────────────────────
// Inter is applied globally via textTheme — every Text widget in the app
// will use Inter automatically without any per-widget font specification.
// ─────────────────────────────────────────────────────────────────────────────

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'app_colors.dart';
import 'app_typography.dart';
import 'app_dimensions.dart';

class AppTheme {
  AppTheme._();

  // ── Light Theme ───────────────────────────────────────────────────────────
  static ThemeData get light => ThemeData(
        useMaterial3: true,
        brightness: Brightness.light,

        // ── Color Scheme ────────────────────────────────────────────────────────
        colorScheme: ColorScheme.fromSeed(
          seedColor: AppColors.primary,
          brightness: Brightness.light,
          primary: AppColors.primary,
          secondary: AppColors.accentGreen,
          error: AppColors.accentRed,
          surface: AppColors.cardLight,
        ),

        // ── Typography — Inter font globally ────────────────────────────────────
        textTheme: AppTypography.lightTextTheme,
        primaryTextTheme: AppTypography.lightTextTheme,

        // ── Scaffold ─────────────────────────────────────────────────────────────
        scaffoldBackgroundColor: AppColors.bgLight,

        // ── AppBar ────────────────────────────────────────────────────────────────
        appBarTheme: AppBarTheme(
          backgroundColor: AppColors.cardLight,
          foregroundColor: AppColors.textPrimary,
          elevation: 0,
          scrolledUnderElevation: 1,
          shadowColor: AppColors.borderLight,
          centerTitle: false,
          titleTextStyle: GoogleFonts.inter(
            fontSize: 18,
            fontWeight: FontWeight.w700,
            color: AppColors.textPrimary,
            letterSpacing: -0.3,
          ),
          iconTheme:
              const IconThemeData(color: AppColors.textPrimary, size: 22),
          systemOverlayStyle: SystemUiOverlayStyle.dark,
        ),

        // ── Bottom Navigation Bar ─────────────────────────────────────────────
        bottomNavigationBarTheme: BottomNavigationBarThemeData(
          backgroundColor: AppColors.cardLight,
          selectedItemColor: AppColors.primary,
          unselectedItemColor: AppColors.textMuted,
          selectedLabelStyle:
              GoogleFonts.inter(fontSize: 11, fontWeight: FontWeight.w600),
          unselectedLabelStyle:
              GoogleFonts.inter(fontSize: 11, fontWeight: FontWeight.w400),
          type: BottomNavigationBarType.fixed,
          elevation: 8,
        ),

        // ── Card ─────────────────────────────────────────────────────────────────
        cardTheme: CardThemeData(
          color: AppColors.cardLight,
          elevation: 0,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppDimensions.radiusLg),
            side: const BorderSide(color: AppColors.borderLight, width: 1),
          ),
          margin: EdgeInsets.zero,
        ),

        // ── Input / Text Field ────────────────────────────────────────────────
        inputDecorationTheme: InputDecorationTheme(
          filled: true,
          fillColor: AppColors.cardLight,
          contentPadding:
              const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          labelStyle: GoogleFonts.inter(
              fontSize: 12,
              fontWeight: FontWeight.w500,
              color: AppColors.textSecondary),
          hintStyle: GoogleFonts.inter(
              fontSize: 14,
              fontWeight: FontWeight.w400,
              color: AppColors.textMuted),
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(AppDimensions.radiusMd),
            borderSide:
                const BorderSide(color: AppColors.borderLight, width: 1.5),
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(AppDimensions.radiusMd),
            borderSide:
                const BorderSide(color: AppColors.borderLight, width: 1.5),
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(AppDimensions.radiusMd),
            borderSide: const BorderSide(color: AppColors.primary, width: 1.5),
          ),
          errorBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(AppDimensions.radiusMd),
            borderSide:
                const BorderSide(color: AppColors.accentRed, width: 1.5),
          ),
          focusedErrorBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(AppDimensions.radiusMd),
            borderSide: const BorderSide(color: AppColors.accentRed, width: 2),
          ),
          errorStyle:
              GoogleFonts.inter(fontSize: 12, color: AppColors.accentRed),
        ),

        // ── Elevated Button ──────────────────────────────────────────────────
        elevatedButtonTheme: ElevatedButtonThemeData(
          style: ElevatedButton.styleFrom(
            backgroundColor: AppColors.primary,
            foregroundColor: Colors.white,
            minimumSize:
                const Size(double.infinity, AppDimensions.buttonHeight),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(AppDimensions.radiusMd),
            ),
            textStyle: const TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w600,
                letterSpacing: -0.2,
                inherit: false),
            elevation: 0,
          ),
        ),

        // ── Outlined Button ──────────────────────────────────────────────────
        outlinedButtonTheme: OutlinedButtonThemeData(
          style: OutlinedButton.styleFrom(
            foregroundColor: AppColors.primary,
            side: const BorderSide(color: AppColors.borderLight, width: 1.5),
            minimumSize:
                const Size(double.infinity, AppDimensions.buttonHeight),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(AppDimensions.radiusMd),
            ),
            textStyle: const TextStyle(
                fontSize: 14, fontWeight: FontWeight.w500, inherit: false),
          ),
        ),

        // ── Text Button ──────────────────────────────────────────────────────
        textButtonTheme: TextButtonThemeData(
          style: TextButton.styleFrom(
            foregroundColor: AppColors.primary,
            textStyle: const TextStyle(
                fontSize: 14, fontWeight: FontWeight.w500, inherit: false),
          ),
        ),

        // ── Chip ─────────────────────────────────────────────────────────────
        chipTheme: ChipThemeData(
          labelStyle:
              GoogleFonts.inter(fontSize: 12, fontWeight: FontWeight.w500),
          shape:
              RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
          side: const BorderSide(color: AppColors.borderLight),
          backgroundColor: AppColors.bgLight,
        ),

        // ── Divider ──────────────────────────────────────────────────────────
        dividerTheme: const DividerThemeData(
          color: AppColors.borderLight,
          thickness: 1,
          space: 0,
        ),

        // ── ListTile ─────────────────────────────────────────────────────────
        listTileTheme: ListTileThemeData(
          contentPadding:
              const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
          titleTextStyle: GoogleFonts.inter(
              fontSize: 14,
              fontWeight: FontWeight.w500,
              color: AppColors.textPrimary),
          subtitleTextStyle: GoogleFonts.inter(
              fontSize: 12,
              fontWeight: FontWeight.w400,
              color: AppColors.textSecondary),
        ),

        // ── SnackBar ─────────────────────────────────────────────────────────
        snackBarTheme: SnackBarThemeData(
          backgroundColor: AppColors.bgDark,
          contentTextStyle:
              GoogleFonts.inter(fontSize: 14, color: Colors.white),
          shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(AppDimensions.radiusMd)),
          behavior: SnackBarBehavior.floating,
        ),

        // ── Dialog ───────────────────────────────────────────────────────────
        dialogTheme: DialogThemeData(
          backgroundColor: AppColors.cardLight,
          shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(AppDimensions.radiusXl)),
          titleTextStyle: GoogleFonts.inter(
              fontSize: 18,
              fontWeight: FontWeight.w700,
              color: AppColors.textPrimary),
          contentTextStyle:
              GoogleFonts.inter(fontSize: 14, color: AppColors.textSecondary),
        ),
      );

  // ── Dark Theme ────────────────────────────────────────────────────────────
  static ThemeData get dark => ThemeData(
        useMaterial3: true,
        brightness: Brightness.dark,
        colorScheme: ColorScheme.fromSeed(
          seedColor: AppColors.primary,
          brightness: Brightness.dark,
          primary: AppColors.primaryLight,
          secondary: AppColors.accentGreen,
          error: AppColors.accentRed,
          surface: AppColors.cardDark,
        ),
        textTheme: AppTypography.darkTextTheme,
        primaryTextTheme: AppTypography.darkTextTheme,
        scaffoldBackgroundColor: AppColors.bgDark,
        appBarTheme: AppBarTheme(
          backgroundColor: AppColors.cardDark,
          foregroundColor: AppColors.textWhite,
          elevation: 0,
          scrolledUnderElevation: 1,
          centerTitle: false,
          titleTextStyle: GoogleFonts.inter(
            fontSize: 18,
            fontWeight: FontWeight.w700,
            color: AppColors.textWhite,
            letterSpacing: -0.3,
          ),
          iconTheme: const IconThemeData(color: AppColors.textWhite, size: 22),
          systemOverlayStyle: SystemUiOverlayStyle.light,
        ),
        bottomNavigationBarTheme: BottomNavigationBarThemeData(
          backgroundColor: AppColors.cardDark,
          selectedItemColor: AppColors.primaryLight,
          unselectedItemColor: const Color(0xFF64748B),
          selectedLabelStyle:
              GoogleFonts.inter(fontSize: 11, fontWeight: FontWeight.w600),
          unselectedLabelStyle:
              GoogleFonts.inter(fontSize: 11, fontWeight: FontWeight.w400),
          type: BottomNavigationBarType.fixed,
          elevation: 8,
        ),
        cardTheme: CardThemeData(
          color: AppColors.cardDark,
          elevation: 0,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppDimensions.radiusLg),
            side: const BorderSide(color: AppColors.borderDark, width: 1),
          ),
          margin: EdgeInsets.zero,
        ),
        inputDecorationTheme: InputDecorationTheme(
          filled: true,
          fillColor: const Color(0xFF1E293B),
          contentPadding:
              const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          labelStyle: GoogleFonts.inter(
              fontSize: 12,
              fontWeight: FontWeight.w500,
              color: const Color(0xFF94A3B8)),
          hintStyle: GoogleFonts.inter(
              fontSize: 14,
              fontWeight: FontWeight.w400,
              color: const Color(0xFF64748B)),
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(AppDimensions.radiusMd),
            borderSide:
                const BorderSide(color: AppColors.borderDark, width: 1.5),
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(AppDimensions.radiusMd),
            borderSide:
                const BorderSide(color: AppColors.borderDark, width: 1.5),
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(AppDimensions.radiusMd),
            borderSide:
                const BorderSide(color: AppColors.primaryLight, width: 1.5),
          ),
          errorBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(AppDimensions.radiusMd),
            borderSide:
                const BorderSide(color: AppColors.accentRed, width: 1.5),
          ),
          focusedErrorBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(AppDimensions.radiusMd),
            borderSide: const BorderSide(color: AppColors.accentRed, width: 2),
          ),
          errorStyle:
              GoogleFonts.inter(fontSize: 12, color: AppColors.accentRed),
        ),
        elevatedButtonTheme: ElevatedButtonThemeData(
          style: ElevatedButton.styleFrom(
            backgroundColor: AppColors.primaryLight,
            foregroundColor: Colors.white,
            minimumSize:
                const Size(double.infinity, AppDimensions.buttonHeight),
            shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(AppDimensions.radiusMd)),
            textStyle: const TextStyle(
                fontSize: 14, fontWeight: FontWeight.w600, inherit: false),
            elevation: 0,
          ),
        ),
        outlinedButtonTheme: OutlinedButtonThemeData(
          style: OutlinedButton.styleFrom(
            foregroundColor: AppColors.primaryLight,
            side: const BorderSide(color: AppColors.borderDark, width: 1.5),
            minimumSize:
                const Size(double.infinity, AppDimensions.buttonHeight),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(AppDimensions.radiusMd),
            ),
            textStyle: const TextStyle(
                fontSize: 14, fontWeight: FontWeight.w500, inherit: false),
          ),
        ),
        textButtonTheme: TextButtonThemeData(
          style: TextButton.styleFrom(
            foregroundColor: AppColors.primaryLight,
            textStyle: const TextStyle(
                fontSize: 14, fontWeight: FontWeight.w500, inherit: false),
          ),
        ),
        dividerTheme: const DividerThemeData(
            color: AppColors.borderDark, thickness: 1, space: 0),
        snackBarTheme: SnackBarThemeData(
          backgroundColor: const Color(0xFF1E293B),
          contentTextStyle:
              GoogleFonts.inter(fontSize: 14, color: Colors.white),
          shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(AppDimensions.radiusMd)),
          behavior: SnackBarBehavior.floating,
        ),
        dialogTheme: DialogThemeData(
          backgroundColor: AppColors.cardDark,
          shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(AppDimensions.radiusXl)),
          titleTextStyle: GoogleFonts.inter(
              fontSize: 18,
              fontWeight: FontWeight.w700,
              color: AppColors.textWhite),
          contentTextStyle:
              GoogleFonts.inter(fontSize: 14, color: const Color(0xFF94A3B8)),
        ),
      );
}
