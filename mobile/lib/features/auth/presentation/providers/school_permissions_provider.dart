import 'package:flutter/material.dart';
import '../../../../core/network/api_client.dart';

class SchoolPermissionsProvider extends ChangeNotifier {
  Map<String, dynamic> _studentPerms = {};
  Map<String, dynamic> _parentPerms = {};
  bool _loaded = false;

  bool get loaded => _loaded;
  bool studentCan(String key) => _studentPerms[key] != false;
  bool parentCan(String key) => _parentPerms[key] != false;

  Future<void> fetch() async {
    try {
      final res = await ApiClient.get('/school');
      final school = res.data['school'] as Map<String, dynamic>? ?? {};
      _studentPerms = Map<String, dynamic>.from(school['studentPermissions'] ?? {});
      _parentPerms = Map<String, dynamic>.from(school['parentPermissions'] ?? {});
      _loaded = true;
      notifyListeners();
    } catch (e) {
      debugPrint('SchoolPermissionsProvider fetch error: $e');
    }
  }

  void reset() {
    _studentPerms = {};
    _parentPerms = {};
    _loaded = false;
    notifyListeners();
  }
}
