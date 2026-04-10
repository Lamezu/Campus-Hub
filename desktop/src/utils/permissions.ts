import type { UserRole, UserSubrole, CalendarEventType } from '@/types';

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

const SUBROLE_EXTRA_PERMISSIONS: Partial<Record<NonNullable<UserSubrole>, Permission[]>> = {
  delegate: [
    'createAcademicEvent',
    'createGeneralEvent',
    'createStudyGroup'
  ],
  coordinator: [
    'createChannel'
  ],
};

export function checkPermission(
  role: UserRole,
  subrole: UserSubrole | undefined,
  permission: Permission
): boolean {
  const base = BASE_PERMISSIONS[role] ?? [];
  const extra = subrole ? (SUBROLE_EXTRA_PERMISSIONS[subrole] ?? []) : [];
  return base.includes(permission) || extra.includes(permission);
}

export function allowedEventTypes(
  role: UserRole,
  subrole: UserSubrole | undefined
): CalendarEventType[] {
  const types: CalendarEventType[] = [];
  if (checkPermission(role, subrole, 'createAcademicEvent')) {
    types.push('exam', 'class', 'deadline');
  }
  if (checkPermission(role, subrole, 'createHolidayEvent')) {
    types.push('holiday');
  }
  if (checkPermission(role, subrole, 'createGeneralEvent')) {
    types.push('event');
  }
  return types;
}

export const SUBROLE_LABELS: Record<NonNullable<UserSubrole>, string> = {
  delegate: 'Delegado/a',
  coordinator: 'Coordinador/a',
};

export const ROLE_LABELS: Record<UserRole, string> = {
  student: 'Alumno/a',
  teacher: 'Profesor/a',
  admin: 'Administración',
};
