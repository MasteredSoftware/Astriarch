import { describe, it, expect } from 'vitest';
import { TaskNotificationType, type TaskNotification } from 'astriarch-engine';
import {
	flattenTaskNotifications,
	taskNotificationKey,
	type TaskNotificationIndex
} from './taskNotificationList';

function task(type: TaskNotificationType, planetId: number): TaskNotification {
	return {
		type,
		planetId,
		planetName: `Planet ${planetId}`,
		message: `task ${type} on ${planetId}`
	};
}

/**
 * Issue #83: after capturing planet 11, (BuildQueueEmpty, 11) sits next to
 * (CitizensProtesting, 9) and (InsufficientFood, 10). Adding the numeric enum to the
 * planet id gives all three the key 11.
 *
 * Built in the engine's TaskNotificationIndex shape (type -> planetId -> task), as
 * TaskNotifications.upsertTask would; that class is not part of the engine's public API.
 */
function collidingIndex(): TaskNotificationIndex {
	const index: TaskNotificationIndex = {
		[TaskNotificationType.BuildQueueEmpty]: {},
		[TaskNotificationType.InsufficientFood]: {},
		[TaskNotificationType.CitizensProtesting]: {}
	};
	for (const t of [
		task(TaskNotificationType.BuildQueueEmpty, 11),
		task(TaskNotificationType.CitizensProtesting, 9),
		task(TaskNotificationType.InsufficientFood, 10),
		task(TaskNotificationType.BuildQueueEmpty, 9)
	]) {
		index[t.type][t.planetId] = t;
	}
	return index;
}

describe('flattenTaskNotifications', () => {
	it('returns every task in the index', () => {
		const list = flattenTaskNotifications(collidingIndex());
		expect(list).toHaveLength(4);
		expect(list.map((n) => [n.type, n.planetId])).toEqual(
			expect.arrayContaining([
				[TaskNotificationType.BuildQueueEmpty, 11],
				[TaskNotificationType.BuildQueueEmpty, 9],
				[TaskNotificationType.InsufficientFood, 10],
				[TaskNotificationType.CitizensProtesting, 9]
			])
		);
	});

	it('returns an empty list without an index', () => {
		expect(flattenTaskNotifications(undefined)).toEqual([]);
		expect(flattenTaskNotifications(null)).toEqual([]);
	});
});

describe('taskNotificationKey', () => {
	it('gives every (type, planetId) pair in the index a distinct key (#83)', () => {
		const list = flattenTaskNotifications(collidingIndex());
		const keys = list.map(taskNotificationKey);
		expect(new Set(keys).size, `keys: ${JSON.stringify(keys)}`).toBe(list.length);
	});

	it('is stable for the same pair and differs when only the type differs', () => {
		expect(taskNotificationKey(task(TaskNotificationType.CitizensProtesting, 5))).toBe(
			taskNotificationKey(task(TaskNotificationType.CitizensProtesting, 5))
		);
		expect(taskNotificationKey(task(TaskNotificationType.BuildQueueEmpty, 5))).not.toBe(
			taskNotificationKey(task(TaskNotificationType.InsufficientFood, 5))
		);
	});
});
