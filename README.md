# 🎓 CampusHub

[![Expo](https://img.shields.io/badge/Expo-4630EB?style=for-the-badge&logo=expo&logoColor=white)](https://expo.dev/)
[![Firebase](https://img.shields.io/badge/Firebase-FFCA28?style=for-the-badge&logo=firebase&logoColor=black)](https://firebase.google.com/)
[![React Native](https://img.shields.io/badge/React_Native-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://reactnative.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Cloudinary](https://img.shields.io/badge/Cloudinary-3448C5?style=for-the-badge&logo=cloudinary&logoColor=white)](https://cloudinary.com/)

**CampusHub** is a premium, high-performance communication and well-being platform designed specifically for educational centers. It seamlessly blends institutional academic tools with a modern social networking experience, creating a singular point of interaction for students and faculty.

---

## 🏗️ Project Architecture

```
Campus-Hub/
├── mobile/          # Cross-platform Mobile & Web App (Expo + React Native)
├── dashboard/       # Administrative Control Panel (Vite + React)
├── web/             # Informative Landing Page
├── shared/          # Unified Business Logic & TypeScript Definitions
├── docs/            # Technical Specifications & Manuals
└── firebase/        # Backend Configuration & Security Rules
```

## ✨ Key Features

- **Institutional Campus**: 
  - Official announcement boards with push notifications.
  - Study groups organized by degree and subject.
  - Integrated academic event calendar.
- **Dynamic Social Feed**: 
  - Real-time media sharing (Photos, Videos, Audio).
  - Advanced interactions: Double-tap likes, nested comments, and item saving.
  - High-performance image loading with progressive blur.
- **Next-Gen Messaging**: 
  - Instant direct and group messaging via Firestore.
  - Rich media previews (Audio waves, Polls, File attachments).
  - P2P Video and Audio calls integrated with WebRTC.
- **Universal Experience**: 
  - **I18n**: Full English/Spanish support with English-first coding standards.
  - **Theming**: Premium Ivory, Dark, and Dynamic system themes.
  - **Cross-Platform**: Tested and optimized for iOS, Android, and Web browsers.

## 🚀 Technology Stack

- **Frontend Core**: React Native (Expo SDK 52+), React (Vite).
- **Backend Services**: Firebase (Authentication, Cloud Firestore, Cloud Messaging, Storage).
- **Media Optimization**: Cloudinary CDN for optimized on-the-fly image and video transformations.
- **Communication**: WebRTC for integrated P2P calls.
- **Localization**: `i18next` for seamless language switching.

## 📝 Technical Documentation

Explore our detailed documentation in the `/docs` directory:

- 🏗️ [**Architecture**](docs/ARCHITECTURE.md) - Technical vision, data flow, and diagrams.
- 🛠️ [**Developer Guide**](docs/DEVELOPER_GUIDE.md) - Environment setup, standards, and deployment.
- 📖 [**User Guide (ES)**](docs/USER_GUIDE_ES.md) - Manual de uso en español.
- 📖 [**User Guide (EN)**](docs/USER_GUIDE_EN.md) - English user manual.

## 👥 Development Team: A&S Technologies

- **Alejandro Mejías Ramírez** - Lead UI/UX Mobile & Frontend Engineer
- **Samuel Morán Hernández** - Backend Architect & Firebase Specialist
- **Sara Alonso Perdomo** - QA Engineering & Admin Panel Lead

**CIFP Villa de Agüimes** | *Senior Graduation Project 2025-2026*

---

## 🔗 Quick Links

- [Github Board](https://github.com/users/Zyroks0906/projects/1)
- [Firebase Console](https://console.firebase.google.com/project/campushub-52343/overview)
- [GitHub Repository](https://github.com/Lamezu/Campus-Hub)
