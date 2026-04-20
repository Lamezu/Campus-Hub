export interface ClosingStat {
  label: string;
  to: number;
  prefix?: string;
  suffix?: string;
}

export const CLOSING_STATS: ClosingStat[] = [
  { label: 'Requisitos funcionales cumplidos', to: 12, suffix: ' RF' },
  { label: 'Funcionalidades fuera del MVP', prefix: '+', to: 15 },
  { label: 'Coste total de infraestructura', to: 0, suffix: ' €' },
];
