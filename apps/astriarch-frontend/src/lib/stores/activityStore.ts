import { writable, derived } from 'svelte/store';
import { multiplayerGameStore, type GameNotification } from './multiplayerGameStore';
import type { EventNotification, PlanetaryConflictData, PlanetData } from 'astriarch-engine';

export interface ActivityLogEntry {
	id: string;
	type: GameNotification['type'];
	message: string;
	timestamp: number;
	category?: string;
	read?: boolean;
	// Original event notification data for rich interactions
	originalEvent?: EventNotification;
	// Parsed planet information for easy access
	planetId?: number;
	planetName?: string;
	// Additional structured data
	conflictData?: PlanetaryConflictData;
}

export interface ActivityStore {
	activityLog: ActivityLogEntry[];
	unreadCount: number;
}

function createActivityStore() {
	const initialState: ActivityStore = {
		activityLog: [],
		unreadCount: 0
	};

	const { subscribe, set, update } = writable(initialState);

	// Subscribe to notifications from the multiplayerGameStore to automatically add them to the activity log
	multiplayerGameStore.notifications.subscribe((notifications) => {
		// For each notification, check if it's already in our activity log
		notifications.forEach((notification) => {
			update((store) => {
				// Check if this notification is already in the activity log
				const exists = store.activityLog.some((entry) => entry.id === notification.id);
				if (!exists) {
					// Add new notification to activity log
					const newEntry: ActivityLogEntry = {
						id: notification.id,
						type: notification.type,
						message: notification.message,
						timestamp: notification.timestamp,
						read: false
					};

					return {
						...store,
						activityLog: [newEntry, ...store.activityLog], // Add to beginning for newest first
						unreadCount: store.unreadCount + 1
					};
				}
				return store;
			});
		});
	});

	return {
		subscribe,
		set,
		update,

		// Add a notification with enhanced EventNotification data
		addNotificationWithEventData: (
			notification: Omit<GameNotification, 'id'>,
			originalEvent?: EventNotification
		) => {
			const newEntry: ActivityLogEntry = {
				id: `activity-${Date.now()}-${Math.random()}`,
				type: notification.type,
				message: notification.message,
				timestamp: notification.timestamp,
				read: false,
				originalEvent,
				// Extract planet info if available
				planetId: originalEvent?.planet?.id,
				planetName: originalEvent?.planet?.name,
				// Extract conflict data if available
				conflictData: originalEvent?.data as PlanetaryConflictData
			};

			update((store) => ({
				...store,
				activityLog: [newEntry, ...store.activityLog],
				unreadCount: store.unreadCount + 1
			}));
		},

		// Add a manual activity entry (for system events, chat events, etc.)
		addActivity: (entry: Omit<ActivityLogEntry, 'id'>) => {
			const newEntry: ActivityLogEntry = {
				...entry,
				id: `activity-${Date.now()}-${Math.random()}`,
				read: false
			};

			update((store) => ({
				...store,
				activityLog: [newEntry, ...store.activityLog],
				unreadCount: store.unreadCount + 1
			}));
		},

		// Mark activities as read
		markAsRead: (activityIds: string[]) => {
			update((store) => {
				const updatedLog = store.activityLog.map((entry) =>
					activityIds.includes(entry.id) ? { ...entry, read: true } : entry
				);
				const newUnreadCount = updatedLog.filter((entry) => !entry.read).length;

				return {
					...store,
					activityLog: updatedLog,
					unreadCount: newUnreadCount
				};
			});
		},

		// Mark all activities as read
		markAllAsRead: () => {
			update((store) => ({
				...store,
				activityLog: store.activityLog.map((entry) => ({ ...entry, read: true })),
				unreadCount: 0
			}));
		},

		// Clear old activities (keep last N entries)
		clearOldActivities: (keepCount: number = 100) => {
			update((store) => {
				const sortedLog = [...store.activityLog].sort((a, b) => b.timestamp - a.timestamp);
				const keptLog = sortedLog.slice(0, keepCount);
				const newUnreadCount = keptLog.filter((entry) => !entry.read).length;

				return {
					...store,
					activityLog: keptLog,
					unreadCount: newUnreadCount
				};
			});
		},

		// Clear all activities
		clearAll: () => {
			set(initialState);
		},

		// Reset store
		reset: () => {
			set(initialState);
		}
	};
}

export const activityStore = createActivityStore();

// Derived stores for convenience
export const activityLog = derived(activityStore, ($store) => $store.activityLog);
export const unreadCount = derived(activityStore, ($store) => $store.unreadCount);

// Filtered activity logs
export const importantActivities = derived(activityLog, ($log) =>
	$log.filter((entry) => ['error', 'warning', 'battle'].includes(entry.type))
);

export const combatActivities = derived(
	activityLog,
	($log) =>
		$log.filter(
			(entry) =>
				entry.type === 'battle' ||
				(entry.originalEvent &&
					(entry.originalEvent.type === 13 || // DefendedAgainstAttackingFleet
						entry.originalEvent.type === 14 || // AttackingFleetLost
						entry.originalEvent.type === 15 || // PlanetCaptured
						entry.originalEvent.type === 19))
		) // PlanetLost
);

export const generalActivities = derived(activityLog, ($log) =>
	$log.filter((entry) =>
		['info', 'success', 'research', 'construction', 'planet', 'fleet', 'diplomacy'].includes(
			entry.type
		)
	)
);
