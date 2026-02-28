# CampusHub - Shared Services

Shared services for CampusHub Mobile, Web, and Desktop platforms.

## 📁 Structure
```
shared/
├── services/
│   ├── __tests__/
│   │   ├── authService.test.js
│   │   ├── channelService.test.js
│   │   ├── messageService.test.js
│   │   └── notificationService.test.js
│   ├── authService.js
│   ├── channelService.js
│   ├── messageService.js
│   └── notificationService.js
├── firebase/
│   ├── config.js
│   ├── firestore.rules
│   ├── firestore.indexes.json
│   └── schema.md
├── package.json
├── babel.config.js
└── README.md
```

## 🚀 Installation
```bash
cd shared
npm install
```

## 🧪 Testing

### Run all tests
```bash
npm test
```

### Run tests in watch mode
```bash
npm run test:watch
```

### Generate coverage report
```bash
npm run test:coverage
```

## 📊 Test Coverage

Tests cover:

- ✅ **AuthService**: Authentication and user management
- ✅ **ChannelService**: Channel and member management
- ✅ **MessageService**: Messaging and reactions
- ✅ **NotificationService**: Push notifications and FCM tokens

Coverage target: **70%** across all metrics.

## 🔧 Usage in Mobile
```javascript
import { auth, db } from '@/config/firebase';
import { AuthService } from '../../shared/services/authService';
import { ChannelService } from '../../shared/services/channelService';
import { MessageService } from '../../shared/services/messageService';
import { NotificationService } from '../../shared/services/notificationService';

const authService = new AuthService(auth, db);
const channelService = new ChannelService(db);
const messageService = new MessageService(db);
const notificationService = new NotificationService(db);

await authService.signIn('email@example.com', 'password');
const channels = await channelService.getUserChannels(userId);
await messageService.sendMessage(channelId, 'Hello!', userId, 'Samuel');
await notificationService.registerForPushNotifications(userId, fcmToken);
```

## 🔧 Usage in Web
```javascript
import { auth, db } from './config/firebase';
import { AuthService } from '../../shared/services/authService';
import { ChannelService } from '../../shared/services/channelService';
import { MessageService } from '../../shared/services/messageService';
import { NotificationService } from '../../shared/services/notificationService';

const authService = new AuthService(auth, db);
const channelService = new ChannelService(db);
const messageService = new MessageService(db);
const notificationService = new NotificationService(db);
```

## 🔧 Usage in Desktop
```javascript
import { auth, db } from './config/firebase';
import { AuthService } from '../../shared/services/authService';
import { ChannelService } from '../../shared/services/channelService';
import { MessageService } from '../../shared/services/messageService';
import { NotificationService } from '../../shared/services/notificationService';

const authService = new AuthService(auth, db);
const channelService = new ChannelService(db);
const messageService = new MessageService(db);
const notificationService = new NotificationService(db);
```

## 🛠️ Development

### Add new tests

1. Create a `*.test.js` file in `services/__tests__/`
2. Import the service to test
3. Write test cases
4. Run `npm test`

### Test example
```javascript
import { MessageService } from '../messageService';

describe('MessageService', () => {
  let messageService;

  beforeEach(() => {
    messageService = new MessageService(mockDb);
  });

  it('should send a message', async () => {
    const messageId = await messageService.sendMessage(
      'channel-1',
      'Hello',
      'user-1',
      'Samuel'
    );
    
    expect(messageId).toBeDefined();
  });
});
```

## 📝 Available Scripts

- `npm test` - Run all tests
- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Generate coverage report

## 📱 Sprint 3: Push Notifications

### New Features

**NotificationService:**
- Register FCM tokens
- Send push notifications to users
- Send channel-wide notifications
- Enable/disable notifications per user

**MessageService (updated):**
- Save FCM tokens for users

**Cloud Function:**
- `onMessageCreated` - Automatically sends push notifications when a new message is created in a channel

### Cloud Function Setup

The `onMessageCreated` function is deployed in Firebase Functions v2:
```javascript
// Trigger: onCreate in /channels/{channelId}/messages/{messageId}
// Action: Send push notification to all channel members except sender
```

To deploy:
```bash
cd functions
firebase deploy --only functions
```

## 🔐 Security

⚠️ **NEVER commit:**
- Firebase credentials
- Access tokens
- API keys
- Service account keys

## 👥 Team

**A&S Technologies**
- Alejandro Mejías Ramírez - Mobile UI/UX
- Samuel Morán Hernández - Backend & Firebase
- Sara Alonso Perdomo - QA & Testing

**CIFP Villa de Agüimes** | 2025-2026