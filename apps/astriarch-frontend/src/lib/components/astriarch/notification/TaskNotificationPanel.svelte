<script lang="ts">
	import { clientGameModel } from '#lib/stores/gameStore.ts';
	import { derived } from 'svelte/store';
	import TaskItem from './TaskItem.svelte';
	import { flattenTaskNotifications, taskNotificationKey } from './taskNotificationList.ts';

	// Access task notifications directly from clientGameModel, just like FleetCommandView accesses ships
	const taskNotifications = derived(clientGameModel, ($clientGameModel) =>
		flattenTaskNotifications($clientGameModel?.taskNotifications)
	);
</script>

<!-- Persistent Task Notifications Panel -->
{#if $taskNotifications.length > 0}
	<div class="space-y-2">
		{#each $taskNotifications as notification (taskNotificationKey(notification))}
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
