export interface AnnouncementCategory {
  id: string;
  label: string;
  color: string;
}

export const ANNOUNCEMENT_CATEGORIES: AnnouncementCategory[] = [
  { id: 'general', label: 'General', color: '#8E8E93' },
  { id: 'erasmus', label: 'Erasmus+', color: '#007AFF' },
  { id: 'matricula', label: 'Enrollment', color: '#34C759' },
  { id: 'eventos', label: 'Events', color: '#AF52DE' },
  { id: 'fct', label: 'FCT', color: '#FF6B35' },
  { id: 'becas', label: 'Scholarships', color: '#5AC8FA' },
  { id: 'evaluacion', label: 'Evaluation', color: '#FF3B30' },
];

export function getCategoryConfig(categoryId: string | null | undefined): AnnouncementCategory {
  return ANNOUNCEMENT_CATEGORIES.find(c => c.id === categoryId) ?? ANNOUNCEMENT_CATEGORIES[0];
}
