/**
 * Notification Service for CRYPTRAC
 * Manages in-app notifications and user preferences
 */

import { v4 as uuidv4 } from 'uuid';
import {
  Notification,
  NotificationPreferences,
  NotificationFilter,
  NotificationStats,
  NotificationType,
  NotificationPriority,
  UserRole,
} from '../types';
import { logger } from '../utils/logger';
import { getAllUsers } from './auth.service';

// ---------------------------------------------------------------------------
// In-memory stores
// ---------------------------------------------------------------------------

const notifications = new Map<string, Notification>();
const preferences = new Map<string, NotificationPreferences>();

// ---------------------------------------------------------------------------
// Default preferences factory
// ---------------------------------------------------------------------------

function defaultPreferences(userId: string): NotificationPreferences {
  return {
    userId,
    enabledTypes: Object.values(NotificationType),
    emailNotifications: false,
    highPriorityOnly: false,
    updatedAt: new Date(),
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Creates a notification for a specific user, respecting their preferences.
 */
export function createNotification(data: {
  userId: string;
  type: NotificationType;
  priority: NotificationPriority;
  title: string;
  message: string;
  referenceId?: string;
  referenceType?: Notification['referenceType'];
}): Notification {
  // Check user preferences
  const prefs = preferences.get(data.userId) ?? defaultPreferences(data.userId);

  // Skip if type is disabled
  if (!prefs.enabledTypes.includes(data.type)) {
    logger.debug('Notification suppressed by user preference', {
      userId: data.userId,
      type: data.type,
    });
    // Return a placeholder (not stored) — caller can safely ignore
    return {
      ...data,
      id: 'suppressed',
      isRead: false,
      createdAt: new Date(),
    };
  }

  // Skip low/medium priority if highPriorityOnly is set
  if (
    prefs.highPriorityOnly &&
    data.priority !== NotificationPriority.HIGH &&
    data.priority !== NotificationPriority.CRITICAL
  ) {
    logger.debug('Notification suppressed — high priority only mode', {
      userId: data.userId,
      priority: data.priority,
    });
    return {
      ...data,
      id: 'suppressed',
      isRead: false,
      createdAt: new Date(),
    };
  }

  const notification: Notification = {
    id: uuidv4(),
    userId: data.userId,
    type: data.type,
    priority: data.priority,
    title: data.title,
    message: data.message,
    referenceId: data.referenceId,
    referenceType: data.referenceType,
    isRead: false,
    createdAt: new Date(),
  };

  notifications.set(notification.id, notification);

  logger.info('Notification created', {
    notificationId: notification.id,
    userId: notification.userId,
    type: notification.type,
    priority: notification.priority,
  });

  return notification;
}

/**
 * Creates notifications for all users with matching roles.
 */
export async function broadcastToRoles(
  roles: UserRole[],
  data: {
    type: NotificationType;
    priority: NotificationPriority;
    title: string;
    message: string;
    referenceId?: string;
    referenceType?: Notification['referenceType'];
  }
): Promise<Notification[]> {
  const allUsers = await getAllUsers();
  const targetUsers = allUsers.filter((u) => roles.includes(u.role as UserRole));

  const created: Notification[] = [];
  for (const user of targetUsers) {
    const n = createNotification({ userId: user.id, ...data });
    if (n.id !== 'suppressed') {
      created.push(n);
    }
  }

  logger.info('Notification broadcast sent', {
    roles,
    type: data.type,
    recipientCount: created.length,
  });

  return created;
}

/**
 * Returns a paginated, filtered list of notifications.
 */
export function getNotifications(filter: NotificationFilter): {
  data: Notification[];
  total: number;
  page: number;
  pageSize: number;
} {
  let results = Array.from(notifications.values());

  if (filter.userId) results = results.filter((n) => n.userId === filter.userId);
  if (filter.type) results = results.filter((n) => n.type === filter.type);
  if (filter.priority) results = results.filter((n) => n.priority === filter.priority);
  if (filter.isRead !== undefined) results = results.filter((n) => n.isRead === filter.isRead);
  if (filter.startDate) {
    const start = filter.startDate instanceof Date ? filter.startDate : new Date(filter.startDate);
    results = results.filter((n) => n.createdAt >= start);
  }
  if (filter.endDate) {
    const end = filter.endDate instanceof Date ? filter.endDate : new Date(filter.endDate);
    results = results.filter((n) => n.createdAt <= end);
  }

  // Sort newest first
  results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  const page = filter.page ?? 1;
  const pageSize = filter.pageSize ?? 20;
  const total = results.length;
  const data = results.slice((page - 1) * pageSize, page * pageSize);

  return { data, total, page, pageSize };
}

/**
 * Returns notification statistics for a user.
 */
export function getNotificationStats(userId: string): NotificationStats {
  const userNotifications = Array.from(notifications.values()).filter(
    (n) => n.userId === userId
  );

  const byType: Record<string, number> = {};
  const byPriority: Record<string, number> = {};

  for (const n of userNotifications) {
    byType[n.type] = (byType[n.type] ?? 0) + 1;
    byPriority[n.priority] = (byPriority[n.priority] ?? 0) + 1;
  }

  return {
    total: userNotifications.length,
    unread: userNotifications.filter((n) => !n.isRead).length,
    byType,
    byPriority,
  };
}

/**
 * Marks a single notification as read.
 */
export function markAsRead(notificationId: string, userId: string): Notification {
  const n = notifications.get(notificationId);
  if (!n) {
    const err = new Error(`Notification not found: ${notificationId}`) as Error & {
      statusCode: number;
    };
    err.statusCode = 404;
    throw err;
  }

  if (n.userId !== userId) {
    const err = new Error('Unauthorized') as Error & { statusCode: number };
    err.statusCode = 403;
    throw err;
  }

  if (n.isRead) return n;

  const updated: Notification = { ...n, isRead: true, readAt: new Date() };
  notifications.set(notificationId, updated);
  return updated;
}

/**
 * Marks all notifications as read for a user.
 */
export function markAllAsRead(userId: string): number {
  let count = 0;
  const now = new Date();

  for (const [id, n] of notifications.entries()) {
    if (n.userId === userId && !n.isRead) {
      notifications.set(id, { ...n, isRead: true, readAt: now });
      count++;
    }
  }

  logger.info('Marked all notifications as read', { userId, count });
  return count;
}

/**
 * Deletes a notification (hard delete).
 */
export function deleteNotification(notificationId: string, userId: string): void {
  const n = notifications.get(notificationId);
  if (!n) {
    const err = new Error(`Notification not found: ${notificationId}`) as Error & {
      statusCode: number;
    };
    err.statusCode = 404;
    throw err;
  }

  if (n.userId !== userId) {
    const err = new Error('Unauthorized') as Error & { statusCode: number };
    err.statusCode = 403;
    throw err;
  }

  notifications.delete(notificationId);
}

/**
 * Gets user notification preferences, returning defaults if none set.
 */
export function getUserPreferences(userId: string): NotificationPreferences {
  return preferences.get(userId) ?? defaultPreferences(userId);
}

/**
 * Updates user notification preferences.
 */
export function updateUserPreferences(
  userId: string,
  data: Partial<Omit<NotificationPreferences, 'userId' | 'updatedAt'>>
): NotificationPreferences {
  const existing = preferences.get(userId) ?? defaultPreferences(userId);
  const updated: NotificationPreferences = {
    ...existing,
    ...data,
    userId,
    updatedAt: new Date(),
  };
  preferences.set(userId, updated);
  return updated;
}

// Exported for testing
export {
  notifications as _notificationsStore,
  preferences as _preferencesStore,
};
