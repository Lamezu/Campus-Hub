# 🎓 CampusHub

Multi-platform communication and wellbeing platform for educational centers.

## 🏗️ Project Structure
```
Campus-Hub/
├── mobile/          # React Native + Expo (Android + iOS)
├── web/             # React + Vite (Browser interface)
├── desktop/         # Electron (Desktop admin panel) - Sprint 5-6
├── shared/          # Shared code and types
└── firebase/        # Backend configuration
```

## 🚀 Tech Stack

### Mobile App
- React Native + Expo
- TypeScript
- Firebase (Auth, Firestore, Cloud Messaging)

### Web App
- React + Vite
- TypeScript
- Firebase

### Desktop App (Planned)
- Electron
- React + Vite
- Firebase

### Backend
- Firebase (Firestore, Auth, Storage, Cloud Messaging)
- Cloudinary (Image storage)

## 👥 Team: A&S Technologies

- **Alejandro Mejías Ramírez** - Mobile UI/UX & Frontend
- **Samuel Morán Hernández** - Backend & Firebase
- **Sara Alonso Perdomo** - QA & Testing & Admin Panel

**CIFP Villa de Agüimes** | 2025-2026

## 📅 Development Roadmap

- ✅ Sprint 0: Initial setup (Jan 12-26)
- ✅ Sprint 1: Authentication (Jan 27 - Feb 9)
- 🔄 Sprint 2: Messaging (Feb 10-23)
- ⏳ Sprint 3: Notifications + Forum (Feb 24 - Mar 9)
- ⏳ Sprint 4: Events + Reports (Mar 10-23)
- ⏳ Sprint 5: Admin Panel (Mar 24 - Apr 6)
- ⏳ Sprint 6: Testing + Deployment (Apr 7-16)

## 🛠️ Development Setup

### Mobile
```bash
cd mobile
npm install
npm install expo
npx expo start --tunnel
```

### Web
```bash
cd web
npm install
npm run dev
```

### Desktop
Coming in Sprint 5-6

## 📝 Documentation

See `/docs` for detailed project documentation.

## 🔗 Links

- [Trello Board](https://trello.com/b/JoQyXFej/campushub)
- [Firebase Console](https://console.firebase.google.com/project/campushub-52343/overview)
- [GitHub Repository](https://github.com/Lamezu/Campus-Hub)
