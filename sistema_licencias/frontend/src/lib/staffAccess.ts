import type { Role } from './types';

/** Refleja permisos existentes para presentar la UI; nunca concede permisos en API. */
export function staffAccess(role: Role | undefined) {
  const general = role === 'admin' || role === 'superadmin';
  return {
    payments: general || role === 'admin_pagos',
    health: general || role === 'admin_salud',
    appointments: general || role === 'admin_turnos',
    licenses: general || role === 'admin_turnos',
  };
}
