import { expect, it } from 'vitest';
import { staffAccess } from './staffAccess';
import type { Role } from './types';

// Expectativas independientes del mapa de UI, tomadas de los permisos actuales de API.
it.each([
  ['citizen', false, false, false, false],
  ['admin_cuentas', false, false, false, false],
  ['admin_pagos', true, false, false, false],
  ['admin_salud', false, true, false, false],
  ['admin_turnos', false, false, true, true],
  ['admin', true, true, true, true],
  ['superadmin', true, true, true, true],
] as const)('capacidades de %s respetan los permisos existentes', (role, payments, health, appointments, licenses) => {
  expect(staffAccess(role)).toEqual({ payments, health, appointments, licenses });
});

it.each([undefined, 'unknown', '__proto__'])('sin un rol conocido (%s) no muestra operaciones', (role) => {
  expect(staffAccess(role as Role | undefined)).toEqual({ payments: false, health: false, appointments: false, licenses: false });
});
