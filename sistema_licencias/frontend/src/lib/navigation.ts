import type { Role } from './types';

const ACCOUNTS_ROLES: readonly Role[] = ['admin_cuentas', 'admin', 'superadmin'];
const PROCEDURES_ROLES: readonly Role[] = [
  'admin_salud', 'admin_turnos', 'admin_pagos', 'admin_cuentas', 'admin', 'superadmin',
];

/** Decide destinos y enlaces de UI, no permisos: router y servidor siguen validando.
 * Las listas reflejan las allowlists existentes; una identidad desconocida no
 * recibe destino administrativo. Todos los destinos son rutas locales fijas.
 */
export function getNavigation(role: Role | null, mfaEnrollmentRequired = false) {
  const accounts = role !== null && ACCOUNTS_ROLES.includes(role);
  const procedures = role !== null && PROCEDURES_ROLES.includes(role);
  const enrolling = procedures && mfaEnrollmentRequired;
  return {
    home: enrolling ? '/perfil' : accounts ? '/admin/cuentas' : procedures ? '/admin/tramites' : role === 'citizen' ? '/panel' : '/login',
    showAccounts: accounts && !enrolling,
    showProcedures: procedures && !enrolling,
  };
}
