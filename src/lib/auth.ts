import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { NextRequest } from 'next/server';

const STAFF_SECRET = process.env.JWT_SECRET || 'dev-staff-secret-change-me-please-32c';
const SESSION_SECRET = process.env.JWT_SESSION_SECRET || 'dev-session-secret-change-me-32chars';

export type StaffRole = 'super_admin' | 'admin' | 'manager' | 'waiter' | 'kitchen' | 'cashier';

export interface StaffPayload {
  sub: string;
  role: StaffRole;
  unitId: string | null;
  name: string;
}

export interface SessionPayload {
  sid: string; // table session id
  tid: string; // table id
  uid: string; // unit id
  name: string;
}

export function hashPassword(plain: string) {
  return bcrypt.hash(plain, 10);
}
export function comparePassword(plain: string, hash: string) {
  return bcrypt.compare(plain, hash);
}

export function signStaff(p: StaffPayload, expiresIn: string = '12h') {
  return jwt.sign(p, STAFF_SECRET, { expiresIn } as jwt.SignOptions);
}
export function verifyStaff(token: string): StaffPayload | null {
  try { return jwt.verify(token, STAFF_SECRET) as StaffPayload; } catch { return null; }
}

export function signSession(p: SessionPayload, expiresIn: string = '4h') {
  return jwt.sign(p, SESSION_SECRET, { expiresIn } as jwt.SignOptions);
}
export function verifySession(token: string): SessionPayload | null {
  try { return jwt.verify(token, SESSION_SECRET) as SessionPayload; } catch { return null; }
}

function extractBearer(req: NextRequest): string | null {
  const auth = req.headers.get('authorization') || '';
  if (auth.startsWith('Bearer ')) return auth.slice(7);
  const cookie = req.cookies.get('md_token')?.value;
  return cookie || null;
}
function extractSessionToken(req: NextRequest): string | null {
  const auth = req.headers.get('x-session-token') || '';
  if (auth) return auth;
  return req.cookies.get('md_session')?.value || null;
}

export function getStaffFromRequest(req: NextRequest): StaffPayload | null {
  const t = extractBearer(req);
  return t ? verifyStaff(t) : null;
}
export function getSessionFromRequest(req: NextRequest): SessionPayload | null {
  const t = extractSessionToken(req);
  return t ? verifySession(t) : null;
}

export function hasRole(staff: StaffPayload | null, roles: StaffRole[]) {
  return !!staff && roles.includes(staff.role);
}
