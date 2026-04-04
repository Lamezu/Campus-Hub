# CampusHub — Documentación de Roles y Permisos

> Referencia completa para el equipo. Indica qué puede hacer cada rol en cada pantalla y función de la app mobile.

---

## Roles y Subroles

| Rol | Subroles posibles | Quién lo asigna |
|-----|-------------------|-----------------|
| `student` — Alumno/a | `delegate` (Delegado/a) | Admin |
| `teacher` — Profesor/a | `coordinator` (Coordinador/a) | Admin |
| `admin` — Administración | *(ninguno)* | Admin |

> Los subroles **suman permisos** al rol base. No los reemplazan.

---

## Matriz de Permisos

| Permiso | Alumno | Delegado | Profesor | Coordinador | Admin |
|---------|:------:|:--------:|:--------:|:-----------:|:-----:|
| `createAnnouncement` | ✗ | ✗ | ✅ | ✅ | ✅ |
| `createAcademicEvent` | ✗ | ✅ | ✅ | ✅ | ✅ |
| `createGeneralEvent` | ✗ | ✅ | ✅ | ✅ | ✅ |
| `createHolidayEvent` | ✗ | ✗ | ✗ | ✗ | ✅ |
| `createStudyGroup` | ✗ | ✅ | ✅ | ✅ | ✅ |
| `createChannel` | ✗ | ✗ | ✗ | ✅ | ✅ |
| `pinContent` | ✗ | ✗ | ✅ | ✅ | ✅ |
| `deleteAnyContent` | ✗ | ✗ | ✗ | ✗ | ✅ |
| `manageUsers` | ✗ | ✗ | ✗ | ✗ | ✅ |

---

## Pantallas y Funciones — Detalle por Rol

---

### 🏠 Home (Tab Principal — Canales)

| Función | Alumno | Delegado | Profesor | Coordinador | Admin |
|---------|:------:|:--------:|:--------:|:-----------:|:-----:|
| Ver canales disponibles | ✅ | ✅ | ✅ | ✅ | ✅ |
| Unirse / Entrar a un canal | ✅ | ✅ | ✅ | ✅ | ✅ |
| Ver grupos de estudio | ✅ | ✅ | ✅ | ✅ | ✅ |
| Notificaciones (campana) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Acceder a Ajustes | ✅ | ✅ | ✅ | ✅ | ✅ |

---

### 🎓 Campus (Explorar — Anuncios / Calendario / Grupos)

#### Anuncios

| Función | Alumno | Delegado | Profesor | Coordinador | Admin |
|---------|:------:|:--------:|:--------:|:-----------:|:-----:|
| Ver anuncios | ✅ | ✅ | ✅ | ✅ | ✅ |
| Crear anuncio | ✗ | ✗ | ✅ | ✅ | ✅ |
| Editar propio anuncio | ✗ | ✗ | ✅ | ✅ | ✅ |
| Editar cualquier anuncio | ✗ | ✗ | ✗ | ✗ | ✅ |
| Eliminar propio anuncio | ✗ | ✗ | ✅ | ✅ | ✅ |
| Eliminar cualquier anuncio | ✗ | ✗ | ✗ | ✗ | ✅ |
| Fijar (pin) anuncio | ✗ | ✗ | ✅ | ✅ | ✅ |
| Publicar anuncio como post social | ✗ | ✗ | ✅ | ✅ | ✅ |
| Vincular evento a anuncio | ✗ | ✗ | ✅ | ✅ | ✅ |

> **Regla**: Editar/eliminar/fijar anuncios → puede el **autor** O quien tenga `createAnnouncement`.

#### Calendario

| Función | Alumno | Delegado | Profesor | Coordinador | Admin |
|---------|:------:|:--------:|:--------:|:-----------:|:-----:|
| Ver todos los eventos | ✅ | ✅ | ✅ | ✅ | ✅ |
| Crear evento Académico (`exam`, `class`, `deadline`) | ✗ | ✅ | ✅ | ✅ | ✅ |
| Crear evento General (`event`) | ✗ | ✅ | ✅ | ✅ | ✅ |
| Crear Festivo (`holiday`) | ✗ | ✗ | ✗ | ✗ | ✅ |

#### Grupos de Estudio

| Función | Alumno | Delegado | Profesor | Coordinador | Admin |
|---------|:------:|:--------:|:--------:|:-----------:|:-----:|
| Ver grupos | ✅ | ✅ | ✅ | ✅ | ✅ |
| Unirse a grupo público | ✅ | ✅ | ✅ | ✅ | ✅ |
| Salir de un grupo | ✅ | ✅ | ✅ | ✅ | ✅ |
| Crear grupo de estudio | ✗ | ✅ | ✅ | ✅ | ✅ |
| Editar grupo (nombre, desc, color, asignatura) | ✗¹ | ✅¹ | ✅¹ | ✅¹ | ✅ |
| Gestionar miembros del grupo | ✗¹ | ✅¹ | ✅¹ | ✅¹ | ✅ |
| Eliminar grupo | ✗¹ | ✅¹ | ✅¹ | ✅¹ | ✅ |

> ¹ Sólo si es el **creador** del grupo. Admin puede gestionar cualquier grupo.

---

### 💬 Chat de Canal / Grupo de Estudio

| Función | Alumno | Delegado | Profesor | Coordinador | Admin |
|---------|:------:|:--------:|:--------:|:-----------:|:-----:|
| Ver mensajes | ✅ | ✅ | ✅ | ✅ | ✅ |
| Enviar mensaje | ✅ | ✅ | ✅ | ✅ | ✅ |
| Adjuntar archivo / imagen / audio | ✅ | ✅ | ✅ | ✅ | ✅ |
| Responder mensaje (swipe) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Reaccionar con emoji | ✅ | ✅ | ✅ | ✅ | ✅ |
| Guardar mensaje | ✅ | ✅ | ✅ | ✅ | ✅ |
| Reenviar mensaje | ✅ | ✅ | ✅ | ✅ | ✅ |
| Eliminar propio mensaje (para mí) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Eliminar propio mensaje (para todos) | ✅² | ✅² | ✅² | ✅² | ✅ |
| Eliminar cualquier mensaje (para todos) | ✗ | ✗ | ✗ | ✗ | ✅ |
| Vaciar chat completo (todos los mensajes) | ✗ | ✗ | ✗ | ✗ | ✅ |
| Ver info / miembros del canal | ✅ | ✅ | ✅ | ✅ | ✅ |
| Personalizar fondo de chat | ✅ | ✅ | ✅ | ✅ | ✅ |

> ² Puede eliminar para todos sólo sus **propios** mensajes.

---

### 📣 Detalle de Anuncio

| Función | Alumno | Delegado | Profesor | Coordinador | Admin |
|---------|:------:|:--------:|:--------:|:-----------:|:-----:|
| Ver anuncio completo | ✅ | ✅ | ✅ | ✅ | ✅ |
| Editar anuncio | ✗³ | ✗³ | ✅³ | ✅³ | ✅ |
| Eliminar anuncio | ✗³ | ✗³ | ✅³ | ✅³ | ✅ |
| Fijar / Desfijar anuncio | ✗³ | ✗³ | ✅³ | ✅³ | ✅ |
| Vincular evento de calendario | ✗ | ✗ | ✅ | ✅ | ✅ |

> ³ Requiere ser el **autor** O tener `createAnnouncement`.

---

### 📝 Feed Social (Posts)

| Función | Alumno | Delegado | Profesor | Coordinador | Admin |
|---------|:------:|:--------:|:--------:|:-----------:|:-----:|
| Ver posts del feed | ✅ | ✅ | ✅ | ✅ | ✅ |
| Crear post (texto, imagen, música) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Dar / quitar like a post | ✅ | ✅ | ✅ | ✅ | ✅ |
| Comentar post | ✅ | ✅ | ✅ | ✅ | ✅ |
| Editar propio post | ✅ | ✅ | ✅ | ✅ | ✅ |
| Eliminar propio post | ✅ | ✅ | ✅ | ✅ | ✅ |
| Eliminar cualquier post | ✗ | ✗ | ✗ | ✗ | ✅ |
| Guardar post | ✅ | ✅ | ✅ | ✅ | ✅ |
| Compartir / reenviar post | ✅ | ✅ | ✅ | ✅ | ✅ |

---

### 💬 Mensajes Directos (DM)

| Función | Alumno | Delegado | Profesor | Coordinador | Admin |
|---------|:------:|:--------:|:--------:|:-----------:|:-----:|
| Ver conversaciones DM | ✅ | ✅ | ✅ | ✅ | ✅ |
| Enviar mensaje directo | ✅ | ✅ | ✅ | ✅ | ✅ |
| Adjuntar archivos / imágenes | ✅ | ✅ | ✅ | ✅ | ✅ |
| Llamada de voz (VoIP) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Eliminar propio mensaje | ✅ | ✅ | ✅ | ✅ | ✅ |
| Archivar conversación | ✅ | ✅ | ✅ | ✅ | ✅ |
| Ver perfil del contacto | ✅ | ✅ | ✅ | ✅ | ✅ |
| Ver medios compartidos | ✅ | ✅ | ✅ | ✅ | ✅ |
| Ver grupos compartidos | ✅ | ✅ | ✅ | ✅ | ✅ |

---

### 👥 Amigos

| Función | Alumno | Delegado | Profesor | Coordinador | Admin |
|---------|:------:|:--------:|:--------:|:-----------:|:-----:|
| Ver lista de amigos | ✅ | ✅ | ✅ | ✅ | ✅ |
| Enviar solicitud de amistad | ✅ | ✅ | ✅ | ✅ | ✅ |
| Aceptar / Rechazar solicitud | ✅ | ✅ | ✅ | ✅ | ✅ |
| Eliminar amigo | ✅ | ✅ | ✅ | ✅ | ✅ |

---

### 🔔 Notificaciones

| Función | Alumno | Delegado | Profesor | Coordinador | Admin |
|---------|:------:|:--------:|:--------:|:-----------:|:-----:|
| Ver propias notificaciones | ✅ | ✅ | ✅ | ✅ | ✅ |
| Marcar como leída | ✅ | ✅ | ✅ | ✅ | ✅ |
| Eliminar notificación | ✅ | ✅ | ✅ | ✅ | ✅ |
| Auto-borrado tras 7 días | ✅ | ✅ | ✅ | ✅ | ✅ |
| Ver notificaciones de otro usuario | ✗ | ✗ | ✗ | ✗ | ✗ |

> Las notificaciones son **estrictamente privadas** por usuario.

---

### 👤 Perfil y Edición de Perfil

| Función | Alumno | Delegado | Profesor | Coordinador | Admin |
|---------|:------:|:--------:|:--------:|:-----------:|:-----:|
| Ver propio perfil | ✅ | ✅ | ✅ | ✅ | ✅ |
| Ver perfil de otro usuario | ✅ | ✅ | ✅ | ✅ | ✅ |
| Editar nombre / bio / foto | ✅ | ✅ | ✅ | ✅ | ✅ |
| Cambiar idioma (ES/EN) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Cambiar contraseña (Account Details) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Gestionar cuentas (multi-cuenta) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Eliminar cuenta | ✅ | ✅ | ✅ | ✅ | ✅ |
| Cerrar sesión | ✅ | ✅ | ✅ | ✅ | ✅ |

---

### ⚙️ Ajustes (Settings)

| Función | Alumno | Delegado | Profesor | Coordinador | Admin |
|---------|:------:|:--------:|:--------:|:-----------:|:-----:|
| Cambiar idioma | ✅ | ✅ | ✅ | ✅ | ✅ |
| Cambiar tema (claro/oscuro/etc.) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Color personalizado de interfaz | ✅ | ✅ | ✅ | ✅ | ✅ |
| Silenciar notificaciones globales | ✅ | ✅ | ✅ | ✅ | ✅ |
| Cambiar tono de alerta global | ✅ | ✅ | ✅ | ✅ | ✅ |
| Ver correo / nombre de la cuenta | ✅ | ✅ | ✅ | ✅ | ✅ |
| Gestionar cuentas (multi-cuenta) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Cerrar sesión | ✅ | ✅ | ✅ | ✅ | ✅ |
| Eliminar cuenta | ✅ | ✅ | ✅ | ✅ | ✅ |

---

### 🛡️ Panel de Administración (Admin Users)

| Función | Alumno | Delegado | Profesor | Coordinador | Admin |
|---------|:------:|:--------:|:--------:|:-----------:|:-----:|
| Acceder al panel | ✗ | ✗ | ✗ | ✗ | ✅ |
| Ver todos los usuarios | ✗ | ✗ | ✗ | ✗ | ✅ |
| Cambiar rol de usuario | ✗ | ✗ | ✗ | ✗ | ✅ |
| Asignar subrole (delegado / coordinador) | ✗ | ✗ | ✗ | ✗ | ✅ |
| Redirigido a Home si accede sin permiso | — | — | — | — | — |

> Subroles disponibles según rol asignado:
> - `student` → puede ser `delegate`
> - `teacher` → puede ser `coordinator`
> - `admin` → sin subrole

---

### 💾 Items Guardados

| Función | Alumno | Delegado | Profesor | Coordinador | Admin |
|---------|:------:|:--------:|:--------:|:-----------:|:-----:|
| Ver propios elementos guardados | ✅ | ✅ | ✅ | ✅ | ✅ |
| Quitar elemento guardado | ✅ | ✅ | ✅ | ✅ | ✅ |
| Navegar al post/mensaje guardado | ✅ | ✅ | ✅ | ✅ | ✅ |

---

## Resumen Visual

ALUMNO       → Ve y participa en todo. No puede crear contenido oficial.
DELEGADO     → Alumno + crear eventos académicos/generales y grupos de estudio.
PROFESOR     → Crea anuncios, eventos, grupos. Gestiona sus propios recursos.
COORDINADOR  → Profesor + puede crear grupos.
ADMIN        → Control total. Gestiona usuarios, elimina cualquier contenido.

*CampusHub TFG 2025/2026*
