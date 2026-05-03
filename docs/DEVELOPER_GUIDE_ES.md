# 🛠️ Guía de Desarrollador de CampusHub

Bienvenido/a al ecosistema de desarrollo de **CampusHub**. Esta guía proporciona la base técnica para colaborar, probar y desplegar todos los aspectos de la plataforma.

---

## 🏗️ Requisitos Previos

Asegúrate de que tu entorno de desarrollo cumple las siguientes especificaciones:

- **Node.js**: v18.x o superior (se recomienda la versión LTS).
- **Gestor de paquetes**: `npm` (preferido) o `yarn`.
- **Ecosistema Expo**: `npm i -g expo-cli eas-cli`.
- **Sistema Operativo**: macOS (para desarrollo iOS) o Windows/Linux (para Android).

---

## 🛠️ Configuración del Entorno

### 1. Configuración del Repositorio
Clona el repositorio e instala las dependencias en el nivel raíz y en el nivel móvil:
```bash
git clone https://github.com/Lamezu/Campus-Hub.git
cd Campus-Hub
npm install
cd mobile && npm install
```

### 2. Variables de Entorno (`.env`)
Crea un archivo `.env` en el directorio `/mobile` con las siguientes claves:
```env
EXPO_PUBLIC_FIREBASE_API_KEY=AIzaSy...
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=campushub.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=campushub-52343
EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME=tu_nombre
EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET=tu_preset
```

---

## 🚀 Flujo de Trabajo en Desarrollo

### 📱 Aplicación Móvil (`/mobile`)
- **Servidor Interactivo**: `npx expo start` (Pulsa 'w' para web, 'a' para Android, 'i' para iOS).
- **Build Independiente**: `eas build --platform android|ios --profile development`.
- **Linting**: `npm run lint` (Comprobaciones de ESLint + TypeScript).

### 🖥️ Panel de Administración (`/dashboard`)
- **Vista previa**: `npm run dev` (Servidor de desarrollo Vite).
- **Build**: `npm run build` (Bundle de producción optimizado).

---

## 📐 Estándares de Código y Contribución

Para mantener una base de código profesional y de alta calidad en este TFG, sigue estrictamente estas reglas:

### 1. Política de Idioma
> [!IMPORTANT]
> **Política estricta de inglés**: Todo el código, nombres de variables, declaraciones de funciones, comentarios lógicos y cadenas de respaldo (`|| 'Fallback'`) deben estar escritos en **inglés**.
> - **Prohibido**: `t('key') || 'Borrar'`
> - **Obligatorio**: `t('key') || 'Delete'`

### 2. Localización (i18n)
Nunca escribas texto visible directamente en el código. Usa el hook `useTranslation`:
```tsx
const { t } = useTranslation();
// En JSX
<Text>{t('common.save') || 'Save'}</Text>
```

### 3. Estado y Estilos
- **Lógica Compartida**: Prioriza siempre la capa de servicios de `/shared` sobre implementaciones locales.
- **Tokens de Estilo**: Usa el sistema de diseño definido en `@/constants/styles`. No uses "números mágicos" para padding o colores.
- **Patrón de Componentes**: Prefiere componentes funcionales con lógica desacoplada (custom hooks).

---

## 🧪 Pruebas y Control de Calidad

### **Validación Multiplataforma**
Antes de hacer un pull request, asegúrate de que las funcionalidades han sido probadas en:
- **Simulador iOS** (Experiencia nativa).
- **Emulador Android** (Rendimiento y respuesta táctil).
- **Expo Web** (Específicamente para validar el puente de medios con Cloudinary).

### **Auditoría Funcional**
Debe realizarse una auditoría funcional completa antes de cada release mayor, cubriendo:
- **Flujo de Autenticación**: Login, registro y restablecimiento de contraseña.
- **Mensajería en Tiempo Real**: Notificaciones push y persistencia del chat grupal.
- **Subida de Medios**: Verificar la separación de medios entre chats 1:1 y grupales.

---

## 📦 Despliegue y Publicación

- **Distribución Móvil**: Todos los releases deben pasar por **EAS Build** con perfiles de producción.
- **Despliegue Firebase**: Actualiza las reglas mediante `firebase deploy --only firestore:rules`.
- **Staging**: Siempre prueba en una rama de staging antes de hacer merge a `main`.

---

## 📚 Referencia de Clases

### `AuthService`

**Ubicación**: [`shared/services/authService.js`](../shared/services/authService.js)

`AuthService` es el servicio centralizado de autenticación de CampusHub. Encapsula toda la comunicación con Firebase Auth y Firestore relacionada con la identidad del usuario, de modo que ningún componente o pantalla necesita importar Firebase directamente para gestionar sesiones.

#### Constructor

```js
new AuthService(authInstance, db, authModule, firestore)
```

Recibe las dependencias inyectadas desde la configuración de Firebase de la plataforma correspondiente (mobile o web), lo que permite reutilizar la misma clase en ambos entornos.

| Parámetro | Descripción |
|-----------|-------------|
| `authInstance` | Instancia de `getAuth()` de Firebase |
| `db` | Instancia de `getFirestore()` |
| `authModule` | Módulo de funciones de Firebase Auth (e.g. `signInWithEmailAndPassword`) |
| `firestore` | Módulo de funciones de Firestore (e.g. `setDoc`, `getDoc`) |

#### Métodos

| Método | Descripción |
|--------|-------------|
| `signUp(email, password, displayName, role?, department?)` | Crea una cuenta con email/contraseña y escribe el documento del usuario en Firestore. El rol por defecto es `'student'`. |
| `signIn(email, password)` | Inicia sesión y actualiza `lastActive` del usuario. |
| `signInWithGoogle()` | Autenticación con Google. Crea el documento en Firestore solo si el usuario es nuevo. |
| `signOut()` | Cierra la sesión activa. |
| `resetPassword(email)` | Envía un correo de restablecimiento de contraseña. |
| `updateLastActive(userId)` | Actualiza el campo `lastActive` en Firestore usando merge para no sobreescribir otros campos. |
| `deleteAccount(uid)` | Marca al usuario como eliminado en Firestore (soft delete) y luego borra la cuenta de Firebase Auth. |
| `onAuthStateChanged(callback)` | Suscribe un listener al estado de autenticación; devuelve la función de cancelación. |
| `getCurrentUser()` | Devuelve el usuario actualmente autenticado o `null`. |
| `getUserData(userId)` | Lee y devuelve el documento del usuario desde Firestore, o `null` si no existe. |
| `incrementMessageCount(userId)` | Incrementa atómicamente el contador de mensajes del usuario. |

#### Ejemplo de uso

```js
import { authService } from '@/services'; // instancia ya configurada por plataforma

// Registrar un nuevo usuario
const user = await authService.signUp('ana@uni.edu', 'password123', 'Ana García');

// Escuchar cambios de sesión
const unsubscribe = authService.onAuthStateChanged((user) => {
  if (user) console.log('Sesión activa:', user.uid);
  else console.log('Sin sesión');
});

// Recordar cancelar el listener al desmontar el componente
unsubscribe();
```

> [!NOTE]
> `AuthService` utiliza **inyección de dependencias** para las APIs de Firebase. Esto significa que la misma clase funciona tanto en React Native (mobile) como en React (web) simplemente pasando la instancia de Firebase correcta al instanciarla.
