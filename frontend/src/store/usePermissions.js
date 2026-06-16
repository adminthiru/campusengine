import { useAuth } from './AuthContext';
import { MODULES } from '../config/modules';

const FULL_ROLES = ['admin', 'correspondent', 'super_admin'];

// Central permission helper for the custom-staff RBAC.
//   can(moduleKey, action)  → boolean
//   allowedModules()        → module entries the user may view
// Full roles (admin/correspondent) and legacy roles are unrestricted here — the
// existing per-route role lists already govern them; only `custom` staff are
// gated by their permission matrix.
export function usePermissions() {
  const { user } = useAuth();
  const isFull   = !!user && (FULL_ROLES.includes(user.role) || user.accessType === 'full');
  const isCustom = !!user && (user.accessType === 'custom' || user.role === 'staff');

  const can = (moduleKey, action = 'view') => {
    if (!user) return false;
    if (isFull) return true;
    if (isCustom) return !!user.permissions?.[moduleKey]?.[action];
    return true; // legacy roles
  };

  const allowedModules = () => {
    if (!isCustom) return MODULES;
    return MODULES.filter(m => user.permissions?.[m.key]?.view);
  };

  const firstAllowedPath = () => {
    if (!isCustom) return '/dashboard';
    const m = MODULES.find(mm => user.permissions?.[mm.key]?.view);
    return m ? m.path : '/settings/profile';
  };

  return { user, isFull, isCustom, can, allowedModules, firstAllowedPath };
}
