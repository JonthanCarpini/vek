import { NextRequest } from 'next/server';
import { getStaffFromRequest, getCustomerFromRequest, StaffRole, StaffPayload, CustomerPayload } from './auth';
import { forbidden, unauthorized } from './api';

export function requireStaff(req: NextRequest, roles?: StaffRole[]):
  | { ok: true; staff: StaffPayload }
  | { ok: false; res: Response } {
  const staff = getStaffFromRequest(req);
  if (!staff) return { ok: false, res: unauthorized() };
  if (roles && !roles.includes(staff.role)) return { ok: false, res: forbidden() };
  return { ok: true, staff };
}

export function requireCustomer(req: NextRequest):
  | { ok: true; customer: CustomerPayload }
  | { ok: false; res: Response } {
  const customer = getCustomerFromRequest(req);
  if (!customer) return { ok: false, res: unauthorized('Login necessário') };
  return { ok: true, customer };
}

export const ROLES = {
  ANY_STAFF: ['super_admin', 'admin', 'manager', 'waiter', 'kitchen', 'cashier'] as StaffRole[],
  MANAGER_UP: ['super_admin', 'admin', 'manager'] as StaffRole[],
  KITCHEN: ['super_admin', 'admin', 'manager', 'kitchen'] as StaffRole[],
  WAITER: ['super_admin', 'admin', 'manager', 'waiter'] as StaffRole[],
  CASHIER: ['super_admin', 'admin', 'manager', 'cashier'] as StaffRole[],
};
