import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'constants.dart';

class AppTheme {
  static ThemeData get light {
    final base = ThemeData.light(useMaterial3: true);
    return base.copyWith(
      scaffoldBackgroundColor: kBackground,
      colorScheme: ColorScheme.fromSeed(
        seedColor: kPrimary,
        primary: kPrimary,
        surface: kCardBg,
      ),
      textTheme: GoogleFonts.interTextTheme(base.textTheme).copyWith(
        bodyLarge: GoogleFonts.inter(color: kTextPrimary, fontSize: 14),
        bodyMedium: GoogleFonts.inter(color: kTextSecondary, fontSize: 13),
        bodySmall: GoogleFonts.inter(color: kTextMuted, fontSize: 12),
        titleLarge: GoogleFonts.inter(color: kTextPrimary, fontSize: 18, fontWeight: FontWeight.w700),
        titleMedium: GoogleFonts.inter(color: kTextPrimary, fontSize: 16, fontWeight: FontWeight.w600),
        titleSmall: GoogleFonts.inter(color: kTextPrimary, fontSize: 14, fontWeight: FontWeight.w600),
        labelLarge: GoogleFonts.inter(color: Colors.white, fontSize: 14, fontWeight: FontWeight.w600),
      ),
      appBarTheme: AppBarTheme(
        backgroundColor: kCardBg,
        foregroundColor: kTextPrimary,
        elevation: 0,
        scrolledUnderElevation: 0,
        shadowColor: Colors.transparent,
        surfaceTintColor: Colors.transparent,
        titleTextStyle: GoogleFonts.inter(
          color: kTextPrimary, fontSize: 16, fontWeight: FontWeight.w600,
        ),
        shape: const Border(bottom: BorderSide(color: kBorder, width: 1)),
      ),
      cardTheme: CardThemeData(
        color: kCardBg,
        elevation: 0,
        margin: EdgeInsets.zero,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
          side: const BorderSide(color: kBorder, width: 1),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: kCardBg,
        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: const BorderSide(color: kBorder),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: const BorderSide(color: kBorder),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: const BorderSide(color: kPrimary, width: 1.5),
        ),
        labelStyle: GoogleFonts.inter(color: kTextSecondary, fontSize: 13),
        hintStyle: GoogleFonts.inter(color: kTextMuted, fontSize: 13),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: kPrimary,
          foregroundColor: Colors.white,
          elevation: 0,
          minimumSize: const Size(double.infinity, 48),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
          textStyle: GoogleFonts.inter(fontSize: 14, fontWeight: FontWeight.w600),
        ),
      ),
      bottomNavigationBarTheme: const BottomNavigationBarThemeData(
        backgroundColor: kCardBg,
        selectedItemColor: kPrimary,
        unselectedItemColor: kTextMuted,
        selectedLabelStyle: TextStyle(fontSize: 11, fontWeight: FontWeight.w600),
        unselectedLabelStyle: TextStyle(fontSize: 11),
        showUnselectedLabels: true,
        type: BottomNavigationBarType.fixed,
        elevation: 8,
      ),
      dividerTheme: const DividerThemeData(color: kBorder, thickness: 1, space: 0),
      chipTheme: ChipThemeData(
        backgroundColor: kBackground,
        labelStyle: GoogleFonts.inter(fontSize: 12),
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
      ),
    );
  }
}
