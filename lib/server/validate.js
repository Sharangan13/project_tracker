import { HttpError } from './errors.js';
import { ROLES, STATUSES } from '../shared.js';

const bad = (msg) => new HttpError(400, msg);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const USERNAME_RE = /^[a-z0-9._-]{3,30}$/;

export function username(v) {
  const s = String(v ?? '').trim().toLowerCase();
  if (!USERNAME_RE.test(s)) throw bad('Username must be 3–30 characters: letters, numbers, dots, dashes or underscores.');
  return s;
}

export function newPassword(v, label = 'Password') {
  const s = typeof v === 'string' ? v : '';
  if (s.length < 8 || s.length > 128) throw bad(`${label} must be 8–128 characters.`);
  return s;
}

// Login does not enforce the minimum (so old short passwords can still sign in), only a sane maximum.
export function loginPassword(v) {
  const s = typeof v === 'string' ? v : '';
  if (!s || s.length > 128) throw new HttpError(401, 'Incorrect username or password.');
  return s;
}

const clean = (v) => String(v ?? '').replace(/\s+/g, ' ').trim();

export function displayName(v) {
  const s = clean(v);
  if (s.length < 1 || s.length > 60) throw bad('Name must be 1–60 characters.');
  return s;
}
export function teamName(v) {
  const s = clean(v);
  if (s.length < 2 || s.length > 60) throw bad('Team name must be 2–60 characters.');
  return s;
}
export function taskLabel(v) {
  const s = clean(v);
  if (s.length < 1 || s.length > 60) throw bad('Task name must be 1–60 characters.');
  return s;
}
export function note(v) {
  const s = String(v ?? '').trim();
  if (s.length > 500) throw bad('Notes can be at most 500 characters.');
  return s;
}
export function uuid(v, what = 'Item') {
  const s = String(v ?? '');
  if (!UUID_RE.test(s)) throw new HttpError(404, `${what} not found.`);
  return s.toLowerCase();
}
export function optionalUuid(v, what) {
  return v === null || v === undefined || v === '' ? null : uuid(v, what);
}
export function role(v) {
  if (!ROLES.includes(v)) throw bad('Role must be “leader” or “member”.');
  return v;
}
export function status(v) {
  if (!STATUSES.includes(v)) throw bad('Status must be “pending” or “completed”.');
  return v;
}
export function bool(v, what = 'Value') {
  if (typeof v !== 'boolean') throw bad(`${what} must be true or false.`);
  return v;
}

// Team codes are shown as ABCD-EFGH; accept any case and separators.
export function normalizeTeamCode(v) {
  const s = String(v ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return /^[A-Z0-9]{8}$/.test(s) ? s : null;
}
