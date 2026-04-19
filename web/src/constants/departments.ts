
export interface Department {
  id: string;
  section: 'subjects' | 'departments' | 'cycles';
  es: string;
  en: string;
}

export const DEPARTMENT_SECTIONS: Array<{ id: 'subjects' | 'departments' | 'cycles'; es: string; en: string }> = [
  { id: 'subjects',     es: 'Asignaturas',   en: 'Subjects'    },
  { id: 'departments',  es: 'Departamentos', en: 'Departments' },
  { id: 'cycles',       es: 'Ciclos',        en: 'Cycles'      },
];

export const DEPARTMENTS: Department[] = [
  { id: 'Matemáticas',   section: 'subjects', es: 'Matemáticas',   en: 'Mathematics'  },
  { id: 'Física',        section: 'subjects', es: 'Física',        en: 'Physics'      },
  { id: 'Química',       section: 'subjects', es: 'Química',       en: 'Chemistry'    },
  { id: 'Historia',      section: 'subjects', es: 'Historia',      en: 'History'      },
  { id: 'Inglés',        section: 'subjects', es: 'Inglés',        en: 'English'      },
  { id: 'Francés',       section: 'subjects', es: 'Francés',       en: 'French'       },
  { id: 'Filosofía',     section: 'subjects', es: 'Filosofía',     en: 'Philosophy'   },
  { id: 'Economía',      section: 'subjects', es: 'Economía',      en: 'Economics'    },
  { id: 'Tecnología',    section: 'subjects', es: 'Tecnología',    en: 'Technology'   },
  { id: 'Programación',  section: 'subjects', es: 'Programación',  en: 'Programming'  },
  { id: 'Otro',          section: 'subjects', es: 'Otro',          en: 'Other'        },

  { id: 'Hostelería y Turismo',              section: 'departments', es: 'Hostelería y Turismo',              en: 'Hospitality and Tourism'          },
  { id: 'Sanidad',                           section: 'departments', es: 'Sanidad',                           en: 'Health'                           },
  { id: 'Informática y Comunicaciones',      section: 'departments', es: 'Informática y Comunicaciones',      en: 'IT and Communications'            },
  { id: 'Actividades Físicas y Deportivas',  section: 'departments', es: 'Actividades Físicas y Deportivas',  en: 'Physical Activities and Sports'   },
  { id: 'Administración y Gestión',          section: 'departments', es: 'Administración y Gestión',          en: 'Administration and Management'    },
  { id: 'Servicios Socioculturales',         section: 'departments', es: 'Servicios Socioculturales',         en: 'Sociocultural Services'           },
  { id: 'Energía y Agua',                    section: 'departments', es: 'Energía y Agua',                    en: 'Energy and Water'                 },
  { id: 'Madera, Mueble y Corcho',           section: 'departments', es: 'Madera, Mueble y Corcho',           en: 'Wood, Furniture and Cork'         },
  { id: 'Seguridad y Medio Ambiente',        section: 'departments', es: 'Seguridad y Medio Ambiente',        en: 'Security and Environment'         },
  { id: 'Idiomas',                           section: 'departments', es: 'Idiomas',                           en: 'Languages'                        },
  { id: 'FOL',                               section: 'departments', es: 'FOL',                               en: 'Labor Guidance (FOL)'             },
  { id: 'Orientación',                       section: 'departments', es: 'Orientación',                       en: 'Counseling'                       },
  { id: 'Innovación y Calidad',              section: 'departments', es: 'Innovación y Calidad',              en: 'Innovation and Quality'           },

  { id: 'ASIR',                                           section: 'cycles', es: 'Redes (ASIR)',                      en: 'IT Systems Admin. (ASIR)'              },
  { id: 'DAM',                                            section: 'cycles', es: 'Aplicaciones Multiplataforma (DAM)', en: 'Multiplatform App Dev. (DAM)'          },
  { id: 'DAW',                                            section: 'cycles', es: 'Desarrollo Web (DAW)',               en: 'Web App Development (DAW)'             },
  { id: 'SMR',                                            section: 'cycles', es: 'Sistemas Microinformáticos (SMR)',   en: 'IT Systems & Networks (SMR)'           },
  { id: 'TSEAS',                                          section: 'cycles', es: 'Animación Deportiva (TSEAS)',        en: 'Sport & Recreation (TSEAS)'            },
  { id: 'TCAE',                                           section: 'cycles', es: 'Cuidados Auxiliares (TCAE)',         en: 'Auxiliary Nursing Care (TCAE)'         },
  { id: 'Emergencias Sanitarias',                         section: 'cycles', es: 'Emergencias Sanitarias',             en: 'Emergency Coordination'                },
  { id: 'Higiene Bucodental',                             section: 'cycles', es: 'Higiene Bucodental',                 en: 'Oral Hygiene (Dental)'                 },
  { id: 'Educación Infantil',                             section: 'cycles', es: 'Educación Infantil',                 en: 'Childhood Education'                   },
  { id: 'TAPSD',                                          section: 'cycles', es: 'Integración Social (TAPSD)',         en: 'Social Integration (TAPSD)'            },
  { id: 'Gestión Administrativa',                         section: 'cycles', es: 'Gestión Administrativa',             en: 'Administrative Management'             },
  { id: 'Finanzas y Seguros',                             section: 'cycles', es: 'Administración y Finanzas',          en: 'Finance & Administration'              },
  { id: 'Guía, Información y Asistencias Turísticas',    section: 'cycles', es: 'Turismo y Guía',                     en: 'Tourism Guide & Assistance'            },
];

export function getDepartmentLabel(id: string, language: string): string {
  const dept = DEPARTMENTS.find(d => d.id === id);
  if (!dept) return id;
  return language === 'en' ? dept.en : dept.es;
}
