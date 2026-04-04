# 🛠️ CampusHub Developer Guide

Welcome to the **CampusHub** development ecosystem. This guide provides the technical foundation for collaborating, testing, and deploying all aspects of the platform.

---

## 🏗️ Prerequisites

Ensure your development environment meets the following specifications:

- **Node.js**: v18.x or higher (LTS recommended).
- **Package Manager**: `npm` (preferred) or `yarn`.
- **Expo Ecosystem**: `npm i -g expo-cli eas-cli`.
- **Operating System**: macOS (for iOS development) or Windows/Linux (for Android).

---

## 🛠️ Environment Configuration

### 1. Repository Setup
Clone the repository and install dependencies at the root and mobile levels:
```bash
git clone https://github.com/Lamezu/Campus-Hub.git
cd Campus-Hub
npm install
cd mobile && npm install
```

### 2. Environment Variables (`.env`)
Create an `.env` file in the `/mobile` directory with these specific keys:
```env
EXPO_PUBLIC_FIREBASE_API_KEY=AIzaSy...
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=campushub.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=campushub-52343
EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME=your_name
EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET=your_preset
```

---

## 🚀 Development Workflow

### 📱 Mobile Experience (`/mobile`)
- **Interactive Server**: `npx expo start` (Press 'w' for web, 'a' for Android, 'i' for iOS).
- **Standalone Build**: `eas build --platform android|ios --profile development`.
- **Linting**: `npm run lint` (ESLint + TypeScript checks).

### 🖥️ Admin Dashboard (`/dashboard`)
- **Preview**: `npm run dev` (Vite dev server).
- **Build**: `npm run build` (Optimized production bundle).

---

## 📐 Coding & Contribution Standards

To maintain a professional, high-quality codebase for this TFG, strictly adhere to these rules:

### 1. Language Policy
> [!IMPORTANT]
> **Strict English-First Policy**: All code, variable names, function declarations, logic comments, and fallback strings (`|| 'Fallback'`) must be written in **English**.
> - **Prohibited**: `t('key') || 'Borrar'`
> - **Mandatory**: `t('key') || 'Delete'`

### 2. Localization (i18n)
Never hardcode visible text. Use the `useTranslation` hook:
```tsx
const { t } = useTranslation();
// In Jsx
<Text>{t('common.save') || 'Save'}</Text>
```

### 3. State & Styling
- **Shared Logic**: Always favor the `/shared` services layer over local implementations.
- **Style Tokens**: Use the design system defined in `@/constants/styles`. Do not use "magic numbers" for padding/colors.
- **Component Pattern**: Prefer functional components with decoupled logic (custom hooks).

---

## 🧪 Testing and QA

### **Cross-Platform Validation**
Before making a pull request, ensure features are tested on:
- **iOS Simulator** (Native feel).
- **Android Emulator** (Performance & touch response).
- **Expo Web** (Specifically for Cloudinary media bridge validation).

### **Functional Audit**
A full functional audit must be performed before major releases, covering:
- **Authentication Flow**: Login, Signup, Password reset.
- **Real-time Messaging**: Push notifications and group chat persistence.
- **Media Uploads**: Verifying 1:1 and group media separation.

---

## 📦 Deployment & Release

- **Mobile Distribution**: All releases must go through **EAS Build** with production profiles.
- **Firebase Deployment**: Update rules via `firebase deploy --only firestore:rules`.
- **Staging**: Always test on a staging branch before merging to `main`.
