<script lang="ts">
	import { clientGameModel } from '$lib/stores/gameStore';
	import { derived } from 'svelte/store';
	import TaskItem from './TaskItem.svelte';
	import type {
		TaskNotification,
		TaskNotificationIndex
	} from 'astriarch-engine/src/model/clientModel';

	// Access task notifications directly from clientGameModel, just like FleetCommandView accesses ships
	const taskNotifications = derived(clientGameModel, ($clientGameModel) => {
		const result: TaskNotification[] = [];
		if (!$clientGameModel?.taskNotifications) {
			return result;
		}

		for (const notificationGroup of Object.values($clientGameModel.taskNotifications)) {
			for (const notification of Object.values(notificationGroup)) {
				result.push(notification);
			}
		}

		return result;
	});
</script>

<!-- Persistent Task Notifications Panel -->
{#if $taskNotifications.length > 0}
	<div class="space-y-2">
		{#each $taskNotifications as notification}
			<TaskItem {notification} />
		{/each}
	</div>
{/if}

<style>
	@keyframes slideInRight {
		from {
			transform: translateX(100%);
			opacity: 0;
		}
		to {
			transform: translateX(0);
			opacity: 1;
		}
	}

	.animate-slideInRight {
		animation: slideInRight 0.4s ease-out;
	}
</style>
