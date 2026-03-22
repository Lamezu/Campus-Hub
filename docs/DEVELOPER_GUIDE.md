# Guía del Desarrollador - CampusHub

Esta guía proporciona instrucciones para configurar el entorno de desarrollo y colaborar en **CampusHub**.

## Prerrequisitos

- **Node.js**: v18 o superior.
- **npm** o **yarn**.
- **Expo CLI**: `npm install -g expo-cli`.
- **Firebase Project**: Una instancia configurada de Firebase (Auth, Firestore, Storage).
- **Cloudinary**: Cuenta para la gestión de medios.

## Configuración Local

1.  **Clonar el repositorio**:
    ```bash
    git clone https://github.com/Lamezu/Campus-Hub.git
    cd Campus-Hub
    ```

2.  **Instalar dependencias**:
    ```bash
    # En la raíz
    npm install
    
    # En la carpeta mobile
    cd mobile
    npm install
    ```

3.  **Variables de Entorno**:
    Crea un archivo `.env` en `/mobile` con las siguientes claves:
    ```env
    EXPO_PUBLIC_FIREBASE_API_KEY=your_key
    EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=your_domain
    EXPO_PUBLIC_FIREBASE_PROJECT_ID=your_id
    EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME=your_cloud_name
    EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET=your_preset
    ```

## Comandos Útiles

### App Móvil (`/mobile`)
- `npx expo start`: Inicia el servidor de desarrollo de Expo.
- `npx expo run:android`: Ejecuta en emulador Android.
- `npx expo run:ios`: Ejecuta en simulador iOS.
- `npm run lint`: Ejecuta el linter de TypeScript.

### Dashboard (`/dashboard`)
- `npm run dev`: Inicia el servidor de Vite.
- `npm run build`: Genera el bundle de producción.

## Estándares de Código

- **TypeScript**: Obligatorio para todos los archivos nuevos.
- **Componentes**: Usar componentes funcionales con Hooks.
- **Estilos**: Usar `StyleSheet` de React Native con constantes definidas en `@/constants/styles`.
- **Traducciones**: Todo texto visible debe pasar por el hook `useTranslation`.

## Despliegue

- **Mobile**: Utilizar **EAS Build** para generar los binarios (.apk / .ipa).
- **Web**: Despliegue recomendado en **Vercel** o **Firebase Hosting**.
