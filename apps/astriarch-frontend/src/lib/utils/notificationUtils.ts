import type { ClientNotification } from 'astriarch-engine';
import { ClientNotificationType } from 'astriarch-engine';

export type UINotificationType =
	| 'info'
	| 'success'
	| 'warning'
	| 'error'
	| 'battle'
	| 'research'
	| 'construction'
	| 'fleet'
	| 'planet';

export interface UINotification {
	type: UINotificationType;
	message: string;
	timestamp: number;
	duration?: number;
}

/**
 * Convert a ClientNotification (from the game engine) to a UINotification (for display)
 * Returns null if the notification type is not recognized or should not be displayed
 */
export function convertClientNotificationToUINotification(
	notification: ClientNotification
): UINotification | null {
	let notificationType: UINotificationType = 'info';
	let message = '';

	switch (notification.type) {
		case ClientNotificationType.SHIP_BUILT: {
			notificationType = 'construction';
			const data = notification.data as {
				planetId: number;
				planetName: string;
				shipType: number;
				nextItemInQueue?: string;
			};
			message = `Ship built at ${data.planetName}`;
			if (data.nextItemInQueue) {
				message += ` (Next: ${data.nextItemInQueue})`;
			}
			break;
		}
		case ClientNotificationType.IMPROVEMENT_BUILT: {
			notificationType = 'construction';
			const data = notification.data as {
				planetId: number;
				planetName: string;
				improvementType: number;
				nextItemInQueue?: string;
			};
			message = `Improvement built at ${data.planetName}`;
			if (data.nextItemInQueue) {
				message += ` (Next: ${data.nextItemInQueue})`;
			}
			break;
		}
		case ClientNotificationType.IMPROVEMENT_DEMOLISHED: {
			notificationType = 'construction';
			const data = notification.data as {
				planetId: number;
				planetName: string;
				improvementType: number;
				nextItemInQueue?: string;
			};
			message = `Improvement demolished at ${data.planetName}`;
			if (data.nextItemInQueue) {
				message += ` (Next: ${data.nextItemInQueue})`;
			}
			break;
		}
		case ClientNotificationType.RESEARCH_COMPLETED: {
			notificationType = 'research';
			const data = notification.data as { researchType: number; newLevel: number };
			message = `Research complete (Level ${data.newLevel})`;
			break;
		}
		case ClientNotificationType.POPULATION_GREW: {
			notificationType = 'planet';
			const data = notification.data as {
				planetId: number;
				planetName: string;
				newPopulation: number;
			};
			message = `Population grew at ${data.planetName} (${data.newPopulation})`;
			break;
		}
		case ClientNotificationType.POPULATION_STARVATION: {
			notificationType = 'warning';
			const data = notification.data as { planetId: number; planetName: string };
			message = `Population lost to starvation at ${data.planetName}`;
			break;
		}
		case ClientNotificationType.FOOD_SHORTAGE_RIOTS: {
			notificationType = 'warning';
			const data = notification.data as { planetId: number; planetName: string; reason: string };
			message = `Food shortage riots at ${data.planetName}: ${data.reason}`;
			break;
		}
		case ClientNotificationType.INSUFFICIENT_FOOD: {
			notificationType = 'warning';
			const data = notification.data as {
				planetId: number;
				planetName: string;
				foodDeficit: number;
			};
			message = `Food shortage at ${data.planetName} (deficit: ${data.foodDeficit.toFixed(1)})`;
			break;
		}
		case ClientNotificationType.CITIZENS_PROTESTING: {
			notificationType = 'warning';
			const data = notification.data as { planetId: number; planetName: string; reason: string };
			message = `Citizens protesting at ${data.planetName}: ${data.reason}`;
			break;
		}
		case ClientNotificationType.PLANET_LOST_DUE_TO_STARVATION: {
			notificationType = 'error';
			const data = notification.data as { planetId: number; planetName: string };
			message = `Planet lost due to starvation: ${data.planetName}`;
			break;
		}
		case ClientNotificationType.RESOURCES_AUTO_SPENT: {
			notificationType = 'info';
			const data = notification.data as { amount: number; resourceType: string; reason: string };
			message = `${data.amount.toFixed(1)} ${data.resourceType} spent: ${data.reason}`;
			break;
		}
		default:
			console.warn('Unknown ClientNotificationType:', (notification as any).type);
			return null;
	}

	if (!message) {
		return null;
	}

	return {
		type: notificationType,
		message,
		timestamp: Date.now()
	};
}

/**
 * Check if a notification indicates a build completion (which might require auto-queue check)
 */
export function isBuildCompletionNotification(notification: ClientNotification): boolean {
	return (
		notification.type === ClientNotificationType.SHIP_BUILT ||
		notification.type === ClientNotificationType.IMPROVEMENT_BUILT ||
		notification.type === ClientNotificationType.IMPROVEMENT_DEMOLISHED
	);
}
