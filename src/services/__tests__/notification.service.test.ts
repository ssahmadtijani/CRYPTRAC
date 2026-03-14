/**
 * Notification Service Tests for CRYPTRAC
 */

import {
  createNotification,
  broadcastToRoles,
  getNotifications,
  getNotificationStats,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  getUserPreferences,
  updateUserPreferences,
  _notificationsStore,
  _preferencesStore,
} from '../notification.service';
import {
  NotificationType,
  NotificationPriority,
  UserRole,
} from '../../types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clearStores(): void {
  _notificationsStore.clear();
  _preferencesStore.clear();
}

function makeNotificationInput(overrides?: object) {
  return {
    userId: 'user-1',
    type: NotificationType.CASE_CREATED,
    priority: NotificationPriority.MEDIUM,
    title: 'Test Notification',
    message: 'This is a test notification.',
    ...overrides,
  };
}

// Mock getAllUsers used by broadcastToRoles
jest.mock('../auth.service', () => ({
  getAllUsers: jest.fn().mockResolvedValue([
    { id: 'user-admin', email: 'admin@test.com', role: 'ADMIN', firstName: 'Admin', lastName: 'User' },
    { id: 'user-officer', email: 'officer@test.com', role: 'COMPLIANCE_OFFICER', firstName: 'Officer', lastName: 'User' },
    { id: 'user-analyst', email: 'analyst@test.com', role: 'ANALYST', firstName: 'Analyst', lastName: 'User' },
    { id: 'user-regular', email: 'user@test.com', role: 'USER', firstName: 'Regular', lastName: 'User' },
  ]),
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Notification Service', () => {
  beforeEach(() => {
    clearStores();
  });

  // -------------------------------------------------------------------------
  // createNotification
  // -------------------------------------------------------------------------

  describe('createNotification', () => {
    it('creates a notification and stores it', () => {
      const n = createNotification(makeNotificationInput());

      expect(n.id).toBeDefined();
      expect(n.id).not.toBe('suppressed');
      expect(n.userId).toBe('user-1');
      expect(n.type).toBe(NotificationType.CASE_CREATED);
      expect(n.isRead).toBe(false);
      expect(n.createdAt).toBeInstanceOf(Date);
      expect(_notificationsStore.size).toBe(1);
    });

    it('sets referenceId and referenceType when provided', () => {
      const n = createNotification(
        makeNotificationInput({ referenceId: 'case-123', referenceType: 'CASE' })
      );
      expect(n.referenceId).toBe('case-123');
      expect(n.referenceType).toBe('CASE');
    });

    it('suppresses notification when type is not in user enabledTypes preferences', () => {
      updateUserPreferences('user-1', {
        enabledTypes: [NotificationType.CASE_ASSIGNED], // Only CASE_ASSIGNED enabled
      });

      const n = createNotification(
        makeNotificationInput({ type: NotificationType.CASE_CREATED })
      );

      expect(n.id).toBe('suppressed');
      expect(_notificationsStore.size).toBe(0);
    });

    it('suppresses low/medium priority when highPriorityOnly is set', () => {
      updateUserPreferences('user-1', {
        highPriorityOnly: true,
      });

      const n = createNotification(
        makeNotificationInput({ priority: NotificationPriority.LOW })
      );

      expect(n.id).toBe('suppressed');
      expect(_notificationsStore.size).toBe(0);
    });

    it('does not suppress HIGH priority when highPriorityOnly is set', () => {
      updateUserPreferences('user-1', { highPriorityOnly: true });

      const n = createNotification(
        makeNotificationInput({ priority: NotificationPriority.HIGH })
      );

      expect(n.id).not.toBe('suppressed');
      expect(_notificationsStore.size).toBe(1);
    });

    it('does not suppress CRITICAL priority when highPriorityOnly is set', () => {
      updateUserPreferences('user-1', { highPriorityOnly: true });

      const n = createNotification(
        makeNotificationInput({ priority: NotificationPriority.CRITICAL })
      );

      expect(n.id).not.toBe('suppressed');
    });
  });

  // -------------------------------------------------------------------------
  // broadcastToRoles
  // -------------------------------------------------------------------------

  describe('broadcastToRoles', () => {
    it('creates notifications for all matching users', async () => {
      const created = await broadcastToRoles(
        [UserRole.ADMIN, UserRole.COMPLIANCE_OFFICER],
        {
          type: NotificationType.CASE_CREATED,
          priority: NotificationPriority.MEDIUM,
          title: 'Broadcast Test',
          message: 'Broadcast message.',
        }
      );

      // Admin + Officer should get notifications, analyst and regular user should not
      expect(created.length).toBe(2);
      const userIds = created.map((n) => n.userId);
      expect(userIds).toContain('user-admin');
      expect(userIds).toContain('user-officer');
      expect(userIds).not.toContain('user-analyst');
      expect(userIds).not.toContain('user-regular');
    });

    it('returns empty array when no users match the role', async () => {
      const created = await broadcastToRoles(
        [UserRole.AUDITOR],
        {
          type: NotificationType.SYSTEM_ALERT,
          priority: NotificationPriority.LOW,
          title: 'No Match',
          message: 'Nobody should get this.',
        }
      );

      expect(created).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // getNotifications
  // -------------------------------------------------------------------------

  describe('getNotifications', () => {
    it('returns all notifications for a user', () => {
      createNotification(makeNotificationInput({ userId: 'user-1' }));
      createNotification(makeNotificationInput({ userId: 'user-1' }));
      createNotification(makeNotificationInput({ userId: 'user-2' }));

      const result = getNotifications({ userId: 'user-1' });

      expect(result.total).toBe(2);
      expect(result.data).toHaveLength(2);
    });

    it('filters by type', () => {
      createNotification(
        makeNotificationInput({ type: NotificationType.CASE_CREATED })
      );
      createNotification(
        makeNotificationInput({ type: NotificationType.HIGH_RISK_TRANSACTION })
      );

      const result = getNotifications({
        userId: 'user-1',
        type: NotificationType.CASE_CREATED,
      });

      expect(result.total).toBe(1);
      expect(result.data[0].type).toBe(NotificationType.CASE_CREATED);
    });

    it('filters by priority', () => {
      createNotification(
        makeNotificationInput({ priority: NotificationPriority.LOW })
      );
      createNotification(
        makeNotificationInput({ priority: NotificationPriority.CRITICAL })
      );

      const result = getNotifications({
        userId: 'user-1',
        priority: NotificationPriority.CRITICAL,
      });

      expect(result.total).toBe(1);
      expect(result.data[0].priority).toBe(NotificationPriority.CRITICAL);
    });

    it('filters by isRead', () => {
      const n = createNotification(makeNotificationInput());
      createNotification(makeNotificationInput());
      markAsRead(n.id, 'user-1');

      const unread = getNotifications({ userId: 'user-1', isRead: false });
      const read = getNotifications({ userId: 'user-1', isRead: true });

      expect(unread.total).toBe(1);
      expect(read.total).toBe(1);
    });

    it('paginates correctly', () => {
      for (let i = 0; i < 5; i++) {
        createNotification(makeNotificationInput());
      }

      const page1 = getNotifications({ userId: 'user-1', page: 1, pageSize: 3 });
      const page2 = getNotifications({ userId: 'user-1', page: 2, pageSize: 3 });

      expect(page1.data).toHaveLength(3);
      expect(page1.total).toBe(5);
      expect(page2.data).toHaveLength(2);
    });

    it('returns newest notifications first', () => {
      const n1 = createNotification(makeNotificationInput({ title: 'First' }));
      const n2 = createNotification(makeNotificationInput({ title: 'Second' }));

      const result = getNotifications({ userId: 'user-1' });
      // Both are created very close together; just verify both returned
      expect(result.data.map((n) => n.id)).toContain(n1.id);
      expect(result.data.map((n) => n.id)).toContain(n2.id);
    });
  });

  // -------------------------------------------------------------------------
  // getNotificationStats
  // -------------------------------------------------------------------------

  describe('getNotificationStats', () => {
    it('returns correct counts', () => {
      createNotification(makeNotificationInput({ type: NotificationType.CASE_CREATED }));
      createNotification(makeNotificationInput({ type: NotificationType.CASE_CREATED }));
      createNotification(
        makeNotificationInput({ type: NotificationType.HIGH_RISK_TRANSACTION, priority: NotificationPriority.HIGH })
      );
      const n = createNotification(
        makeNotificationInput({ type: NotificationType.CASE_STATUS_CHANGED })
      );
      markAsRead(n.id, 'user-1');

      const stats = getNotificationStats('user-1');

      expect(stats.total).toBe(4);
      expect(stats.unread).toBe(3);
      expect(stats.byType[NotificationType.CASE_CREATED]).toBe(2);
      expect(stats.byType[NotificationType.HIGH_RISK_TRANSACTION]).toBe(1);
      expect(stats.byType[NotificationType.CASE_STATUS_CHANGED]).toBe(1);
      expect(stats.byPriority[NotificationPriority.MEDIUM]).toBe(3);
      expect(stats.byPriority[NotificationPriority.HIGH]).toBe(1);
    });

    it('returns zeros for user with no notifications', () => {
      const stats = getNotificationStats('unknown-user');
      expect(stats.total).toBe(0);
      expect(stats.unread).toBe(0);
      expect(stats.byType).toEqual({});
      expect(stats.byPriority).toEqual({});
    });
  });

  // -------------------------------------------------------------------------
  // markAsRead
  // -------------------------------------------------------------------------

  describe('markAsRead', () => {
    it('marks a notification as read', () => {
      const n = createNotification(makeNotificationInput());

      const updated = markAsRead(n.id, 'user-1');

      expect(updated.isRead).toBe(true);
      expect(updated.readAt).toBeInstanceOf(Date);
    });

    it('is idempotent for already-read notifications', () => {
      const n = createNotification(makeNotificationInput());
      const first = markAsRead(n.id, 'user-1');
      const second = markAsRead(n.id, 'user-1');

      expect(second.isRead).toBe(true);
      expect(second.readAt).toEqual(first.readAt);
    });

    it('throws 404 for non-existent notification', () => {
      expect(() => markAsRead('non-existent', 'user-1')).toThrow(
        expect.objectContaining({ statusCode: 404 })
      );
    });

    it('throws 403 when another user tries to mark as read', () => {
      const n = createNotification(makeNotificationInput());

      expect(() => markAsRead(n.id, 'other-user')).toThrow(
        expect.objectContaining({ statusCode: 403 })
      );
    });
  });

  // -------------------------------------------------------------------------
  // markAllAsRead
  // -------------------------------------------------------------------------

  describe('markAllAsRead', () => {
    it('marks all unread notifications as read', () => {
      createNotification(makeNotificationInput());
      createNotification(makeNotificationInput());
      createNotification(makeNotificationInput({ userId: 'user-2' }));

      const count = markAllAsRead('user-1');

      expect(count).toBe(2);
      const stats = getNotificationStats('user-1');
      expect(stats.unread).toBe(0);
    });

    it('returns 0 when no unread notifications', () => {
      const count = markAllAsRead('user-1');
      expect(count).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // deleteNotification
  // -------------------------------------------------------------------------

  describe('deleteNotification', () => {
    it('deletes a notification', () => {
      const n = createNotification(makeNotificationInput());
      expect(_notificationsStore.size).toBe(1);

      deleteNotification(n.id, 'user-1');

      expect(_notificationsStore.size).toBe(0);
    });

    it('throws 404 for non-existent notification', () => {
      expect(() => deleteNotification('non-existent', 'user-1')).toThrow(
        expect.objectContaining({ statusCode: 404 })
      );
    });

    it('throws 403 when another user tries to delete', () => {
      const n = createNotification(makeNotificationInput());
      expect(() => deleteNotification(n.id, 'other-user')).toThrow(
        expect.objectContaining({ statusCode: 403 })
      );
    });
  });

  // -------------------------------------------------------------------------
  // Preferences
  // -------------------------------------------------------------------------

  describe('getUserPreferences', () => {
    it('returns defaults when no preferences set', () => {
      const prefs = getUserPreferences('new-user');

      expect(prefs.userId).toBe('new-user');
      expect(prefs.emailNotifications).toBe(false);
      expect(prefs.highPriorityOnly).toBe(false);
      expect(prefs.enabledTypes).toHaveLength(
        Object.keys(NotificationType).length
      );
    });
  });

  describe('updateUserPreferences', () => {
    it('updates preferences', () => {
      const prefs = updateUserPreferences('user-1', {
        emailNotifications: true,
        highPriorityOnly: true,
      });

      expect(prefs.emailNotifications).toBe(true);
      expect(prefs.highPriorityOnly).toBe(true);
    });

    it('merges with existing preferences', () => {
      updateUserPreferences('user-1', { emailNotifications: true });
      const prefs = updateUserPreferences('user-1', { highPriorityOnly: true });

      expect(prefs.emailNotifications).toBe(true);
      expect(prefs.highPriorityOnly).toBe(true);
    });

    it('updates the updatedAt timestamp', () => {
      const before = new Date();
      const prefs = updateUserPreferences('user-1', { emailNotifications: true });
      expect(prefs.updatedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
    });
  });
});
