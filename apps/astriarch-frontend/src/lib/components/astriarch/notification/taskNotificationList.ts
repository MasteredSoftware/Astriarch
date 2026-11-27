import type { ClientModelData, TaskNotification } from 'astriarch-engine';

/** The engine's (type -> planetId -> task) index; the engine does not export its name. */
export type TaskNotificationIndex = ClientModelData['taskNotifications'];

/** Flattens the engine's (type -> planetId -> task) index into one list, in index order. */
export function flattenTaskNotifications(
	index: TaskNotificationIndex | undefined | null
): TaskNotification[] {
	const result: TaskNotification[] = [];
	if (!index) {
		return result;
	}

	for (const notificationGroup of Object.values(index)) {
		for (const notification of Object.values(notificationGroup)) {
			result.push(notification);
		}
	}

	return result;
}

/**
 * Keyed-each key for a task. (type, planetId) pairs are unique in the index, so this string
 * is too. It must not be `type + planetId`: the type is a numeric enum, so that was a sum
 * and e.g. (BuildQueueEmpty, 11) and (CitizensProtesting, 9) collided (issue #83).
 */
export function taskNotificationKey(n: TaskNotification): string {
	return `${n.type}:${n.planetId}`;
}
