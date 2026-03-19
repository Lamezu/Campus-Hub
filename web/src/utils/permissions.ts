import type { UserRole, UserSubrole, CalendarEventType } from '../types';

export type Permission =
  | 'createAnnouncement'
  | 'createAcademicEvent'
  | 'createHolidayEvent'
  | 'createGeneralEvent'
  | 'createStudyGroup'
  | 'pinContent'
  | 'createChannel'
  | 'deleteAnyContent'
  | 'manageUsers';

const BASE_PERMISSIONS: Record<UserRole, Permission[]> = {
  student: [],
  teacher: [
    'createAnnouncement',
    'createAcademicEvent',
    'createGeneralEvent',
    'createStudyGroup',
    'pinContent',
  ],
  admin: [
    'createAnnouncement',
    'createAcademicEvent',
    'createHolidayEvent',
    'createGeneralEvent',
    'createStudyGroup',
    'pinContent',
    'createChannel',
    'deleteAnyContent',
    'manageUsers',
  ],
};

const SUBROLE_EXTRA: Partial<Record<NonNullable<UserSubrole>, Permission[]>> = {
  delegate: ['createGeneralEvent', 'createAcademicEvent', 'createStudyGroup'],
  coordinator: ['createChannel'],
};

export function checkPermission(role: UserRole, subrole: UserSubrole, permission: Permission): boolean {
  const base = BASE_PERMISSIONS[role] ?? [];
  const extra = subrole ? (SUBROLE_EXTRA[subrole] ?? []) : [];
  return base.includes(permission) || extra.includes(permission);
}

export function allowedEventTypes(role: UserRole, subrole: UserSubrole): CalendarEventType[] {
  const types: CalendarEventType[] = [];
  if (checkPermission(role, subrole, 'createAcademicEvent')) types.push('exam', 'class', 'deadline');
  if (checkPermission(role, subrole, 'createHolidayEvent')) types.push('holiday');
  if (checkPermission(role, subrole, 'createGeneralEvent')) types.push('event');
  return types;
}
