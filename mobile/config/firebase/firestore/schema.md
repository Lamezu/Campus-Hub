# Esquema de Base de Datos - CampusHub
**Sprint 2: Sistema de Mensajería**
**Autor:** Samuel Morán
**Fecha:** Febrero 2026

---

## 📊 Colecciones Principales

### 1. `users`
**Ruta:** `/users/{userId}`

**Descripción:** Información de usuarios registrados del CIFP Villa de Agüimes

**Campos:**
```typescript
{
  uid: string;
  email: string;
  displayName: string;
  photoURL: string | null;
  role: 'student' | 'teacher' | 'admin';
  department: string | null;
  createdAt: Timestamp;
  lastActive: Timestamp;
  fcmToken: string | null;  // Token para notificaciones
}
```

**Índices:**
- `role` (ASC)
- `department` (ASC)

**Ejemplo:**
```json
{
  "uid": "abc123",
  "email": "samuel.moran@cifpvillaaguimes.es",
  "displayName": "Samuel",
  "photoURL": null,
  "role": "student",
  "department": "DAM",
  "createdAt": "2026-02-02T10:00:00Z",
  "lastActive": "2026-02-02T19:37:00Z",
  "fcmToken": "token_fcm_aqui"
}
```

---

### 2. `channels`
**Ruta:** `/channels/{channelId}`

**Descripción:** Canales de comunicación (grupos, anuncios, clases)

**Campos:**
```typescript
{
  name: string;
  description: string;
  type: 'public' | 'private' | 'announcement';
  createdBy: string;
  createdAt: Timestamp;
  memberCount: number;
  lastMessageAt: Timestamp | null;
  departmentRestricted: boolean;
  allowedDepartments: string[];
}
```

**Índices:**
- `type` (ASC), `lastMessageAt` (DESC)
- `createdAt` (DESC)

**Ejemplo:**
```json
{
  "name": "DAM - 2º Año",
  "description": "Canal para estudiantes de 2º de DAM",
  "type": "public",
  "createdBy": "teacher_xyz",
  "createdAt": "2026-02-01T08:00:00Z",
  "memberCount": 25,
  "lastMessageAt": "2026-02-02T19:30:00Z",
  "departmentRestricted": true,
  "allowedDepartments": ["DAM"]
}
```

---

### 3. `channels/{channelId}/members`
**Ruta:** `/channels/{channelId}/members/{userId}`

**Descripción:** Subcolección de miembros de cada canal

**Campos:**
```typescript
{
  userId: string;
  role: 'member' | 'moderator' | 'admin';
  joinedAt: Timestamp;
  lastRead: Timestamp;
  notifications: boolean;
}
```

**Ejemplo:**
```json
{
  "userId": "abc123",
  "role": "member",
  "joinedAt": "2026-02-01T09:00:00Z",
  "lastRead": "2026-02-02T19:35:00Z",
  "notifications": true
}
```

---

### 4. `channels/{channelId}/messages`
**Ruta:** `/channels/{channelId}/messages/{messageId}`

**Descripción:** Mensajes en tiempo real dentro de cada canal

**Campos:**
```typescript
{
  text: string;
  senderId: string;
  senderName: string;
  senderPhoto: string | null;
  createdAt: Timestamp;
  edited: boolean;
  editedAt: Timestamp | null;
  attachments: {
    url: string;
    type: 'image' | 'file';
    name: string;
    size: number;
  }[] | null;
  reactions: {
    [emoji: string]: string[];
  };
}
```

**Índices:**
- `createdAt` (DESC)

**Ejemplo:**
```json
{
  "text": "Hola equipo, ¿alguien tiene dudas sobre Firebase?",
  "senderId": "abc123",
  "senderName": "Samuel",
  "senderPhoto": null,
  "createdAt": "2026-02-02T19:30:00Z",
  "edited": false,
  "editedAt": null,
  "attachments": null,
  "reactions": {
    "👍": ["user1", "user2"],
    "❤️": ["user3"]
  }
}
```

---

### 5. `roles`
**Ruta:** `/roles/{roleId}`

**Descripción:** Definición de roles y permisos del sistema

**Campos:**
```typescript
{
  name: 'student' | 'teacher' | 'admin';
  permissions: {
    canCreateChannels: boolean;
    canDeleteMessages: boolean;
    canManageUsers: boolean;
    canSendAnnouncements: boolean;
  };
  createdAt: Timestamp;
}
```

**Ejemplo:**
```json
{
  "name": "teacher",
  "permissions": {
    "canCreateChannels": true,
    "canDeleteMessages": true,
    "canManageUsers": false,
    "canSendAnnouncements": true
  },
  "createdAt": "2026-02-01T00:00:00Z"
}
```

---

## 🔐 Reglas de Seguridad

- **Usuarios:** Solo pueden leer/editar su propio perfil
- **Canales públicos:** Todos los autenticados pueden leer
- **Canales privados:** Solo miembros pueden leer/escribir
- **Mensajes:** Solo miembros del canal pueden leer/escribir
- **Roles:** Solo admins pueden modificar

---

## 📈 Estimaciones de Crecimiento

- **Usuarios:** ~500 (estudiantes + profesores)
- **Canales:** ~50 (departamentos, clases, grupos)
- **Mensajes/día:** ~1,000
- **Almacenamiento estimado:** ~5 GB/año