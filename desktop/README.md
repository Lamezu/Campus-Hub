# CampusHub — Desktop
Cliente de escritorio oficial de CampusHub, el entorno virtual y social para centros educativos. Desarrollada con **React + Vite + TypeScript + Electron**, esta aplicación ofrece una experiencia nativa optimizada para sistemas operativos de escritorio (Windows, macOS y Linux), integrando funcionalidades avanzadas de comunicación y gestión académica.

Parte del monorepo Campus-Hub · Equipo A&S Technologies · CIFP Villa de Agüimes 2025–2026

## 🏗️ Estructura del proyecto
`desktop/`
├── `electron/`              # Código principal de Electron (Main process, Preload)
├── `src/`                   # Código fuente de React (Renderer process)
│   ├── `components/`        # Componentes UI (Call, Chat, Campus, UI...)
│   ├── `config/`            # Inicialización de Firebase y servicios
│   ├── `contexts/`          # Providers globales (Call, Theme, Language...)
│   ├── `hooks/`             # Custom hooks
│   ├── `pages/`             # Vistas principales de la aplicación
│   ├── `services/`          # Integración con Firebase y WebRTC
│   └── `utils/`             # Helpers y generador de tonos
├── `public/`                # Recursos estáticos
└── `package.json`           # Scripts de ejecución y dependencias

## ✨ Funcionalidades Destacadas
La versión de escritorio incluye todas las capacidades de la plataforma social y añade mejoras nativas:

### 📞 Sistema de llamadas y videoconferencias
Es el núcleo técnico de la aplicación, utilizando una arquitectura **Mesh P2P completa** mediante WebRTC.
- **Llamadas 1 a 1**: Voz y vídeo de alta fidelidad.
- **Llamadas grupales**: Conexiones simultáneas entre múltiples miembros de un grupo.
- **Videoconferencias**: Salas para grupos de estudio con control de admisión y gestión de participantes.
- **Picture-in-Picture Nativo**: Ventana flotante que permanece siempre visible al navegar fuera de la app o cambiar de ventana en el SO.

### 🖥️ Integración con el Sistema Operativo
- **Notificaciones Nativas**: Avisos integrados en el centro de notificaciones del sistema.
- **Badge en el Icono**: Indicador de mensajes no leídos en la barra de tareas o dock.
- **Compartición de Pantalla**: Selección de ventanas o pantallas completas de forma nativa.
- **Gestión de Dispositivos**: Selector independiente para micrófono, cámara y salida de audio.

### 🎓 Gestión del Campus
- **Tablón de Anuncios**: Notificaciones institucionales en tiempo real.
- **Calendario Académico**: Sincronización de exámenes, eventos y clases.
- **Grupos de Estudio**: Espacios colaborativos con chat y videoconferencia integrados.

## 🚀 Inicio Rápido

### Requisitos previos
- **Node.js** 18 o superior.
- **npm** o **yarn**.
- Configuración de Firebase (asegúrate de tener el archivo `.env` configurado).

### Instalación
```bash
cd desktop
npm install
```

### Ejecución en desarrollo
Para iniciar la aplicación en modo desarrollo con recarga en caliente:
```bash
npm run electron:dev
```

### Construcción para producción
Para generar el ejecutable instalable para tu sistema operativo:
```bash
npm run electron:build
```
*Los binarios generados se encontrarán en la carpeta `release/`.*

## 🧰 Tech Stack
| Capa | Tecnología |
| :--- | :--- |
| **Framework** | React 18 + Vite |
| **Entorno Desktop** | Electron |
| **Lenguaje** | TypeScript |
| **Base de Datos** | Cloud Firestore (Real-time) |
| **Almacenamiento** | Cloudinary (Imágenes y Vídeos) + Firebase Storage |
| **Llamadas** | WebRTC (Señalización vía Firestore) |
| **Notificaciones** | Firebase Cloud Messaging (FCM) |
| **Iconos** | Lucide React |

## 👤 Autor
**Samuel Jesús Morán Hernández** — Desarrollo del cliente de escritorio, integración de Electron, infraestructura de Backend (Firebase Functions & Firestore), sistema WebRTC y validación funcional.

---
Proyecto A&S Technologies · CIFP Villa de Agüimes · 2025–2026
