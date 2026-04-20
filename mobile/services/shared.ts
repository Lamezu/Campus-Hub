import { AuthService } from '../../shared/services/authService.js';
import { ForumService } from '../../shared/services/forumService.js';
import { EventsService } from '../../shared/services/eventsService.js';
import { MessageService } from '../../shared/services/messageService.js';
import { DirectMessageService } from '../../shared/services/directMessageService.js';
import { FriendsService } from '../../shared/services/friendsService.js';
import { NotificationService } from '../../shared/services/notificationService.js';
import { ChannelService } from '../../shared/services/channelService.js';
import { CallService } from '../../shared/services/callService.js';
import { GroupsService } from '../../shared/services/groupsService.js';
import { auth, db } from '@/config/firebase';
import * as firestore from 'firebase/firestore';
import * as firebaseAuth from 'firebase/auth';

let instances: any = {};

export const getAuthService = () => instances.auth ?? (instances.auth = new AuthService(auth, db, firebaseAuth, firestore));
export const getForumService = () => instances.forum ?? (instances.forum = new ForumService(db, firestore));
export const getEventsService = () => instances.events ?? (instances.events = new EventsService(db, firestore));
export const getMessageService = () => instances.message ?? (instances.message = new MessageService(db, firestore));
export const getDirectMessageService = () => instances.directMessage ?? (instances.directMessage = new DirectMessageService(db, firestore));
export const getFriendsService = () => instances.friends ?? (instances.friends = new FriendsService(db, firestore));
export const getNotificationService = () => instances.notification ?? (instances.notification = new NotificationService(db, firestore));
export const getCallService = () => instances.call ?? (instances.call = new CallService(db, firestore));
export const getChannelService = () => instances.channel ?? (instances.channel = new ChannelService(db, firestore));
export const getGroupsService = () => instances.groups ?? (instances.groups = new GroupsService(db, firestore));

const createLazyProxy = (getter: () => any) => new Proxy({} as any, {
    get: (_, p) => {
        const instance = getter();
        const value = instance[p];
        return typeof value === 'function' ? value.bind(instance) : value;
    }
});

export const authService = createLazyProxy(getAuthService);
export const forumService = createLazyProxy(getForumService);
export const eventsService = createLazyProxy(getEventsService);
export const messageService = createLazyProxy(getMessageService);
export const directMessageService = createLazyProxy(getDirectMessageService);
export const friendsService = createLazyProxy(getFriendsService);
export const notificationService = createLazyProxy(getNotificationService);
export const callService = createLazyProxy(getCallService);
export const channelService = createLazyProxy(getChannelService);
export const groupsService = createLazyProxy(getGroupsService);
