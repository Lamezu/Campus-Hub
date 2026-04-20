import SlideCover from '../components/sections/SlideCover';
import SlideProblem from '../components/sections/SlideProblem';
import SlideSolution from '../components/sections/SlideSolution';
import SlideArchitecture from '../components/sections/SlideArchitecture';
import SlideDemoMobile from '../components/sections/SlideDemoMobile';
import SlideDemoWeb from '../components/sections/SlideDemoWeb';
import SlideDemoDesktop from '../components/sections/SlideDemoDesktop';
import SlideModules from '../components/sections/SlideModules';
import SlidePlanning from '../components/sections/SlidePlanning';
import SlideTeam from '../components/sections/SlideTeam';
import SlideQR from '../components/sections/SlideQR';
import SlideClosing from '../components/sections/SlideClosing';
import type { SlideConfig } from '../types';

export const SLIDES: SlideConfig[] = [
  { id: 'cover',         label: 'Portada',             num: '01', Component: SlideCover },
  { id: 'problem',       label: 'El Problema',         num: '02', Component: SlideProblem },
  { id: 'solution',      label: 'La Solución',         num: '03', Component: SlideSolution },
  { id: 'architecture',  label: 'Arquitectura',        num: '04', Component: SlideArchitecture },
  { id: 'demo-mobile',   label: 'Demo Mobile',         num: '05', Component: SlideDemoMobile },
  { id: 'demo-web',      label: 'Demo Web / Llamadas', num: '06', Component: SlideDemoWeb },
  { id: 'demo-desktop',  label: 'Demo Desktop',        num: '07', Component: SlideDemoDesktop },
  { id: 'modules',       label: 'Funcionalidades',     num: '08', Component: SlideModules },
  { id: 'planning',      label: 'Planificación',       num: '09', Component: SlidePlanning },
  { id: 'team',          label: 'Equipo',              num: '10', Component: SlideTeam },
  { id: 'qr',            label: 'Pruébalo ahora',      num: '11', Component: SlideQR },
  { id: 'closing',       label: 'Cierre',              num: '12', Component: SlideClosing },
];
