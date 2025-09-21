<script lang="ts">
	import type { TaskNotification } from 'astriarch-engine/src/model/clientModel';
	import { TaskNotificationType } from 'astriarch-engine/src/model/clientModel';
	import { gameActions } from '$lib/stores/gameStore';
	import { onMount, onDestroy } from 'svelte';

	interface Props {
		notification: TaskNotification;
	}

	let { notification }: Props = $props();

	// Debug logging to track component lifecycle
	const componentId = Math.random().toString(36).substr(2, 9);
	console.log(
		`TaskItem ${componentId} created for ${notification.type}-${notification.planetId} (${notification.planetName})`
	);

	onMount(() => {
		console.log(
			`TaskItem ${componentId} mounted for ${notification.type}-${notification.planetId}`
		);
	});

	onDestroy(() => {
		console.log(
			`TaskItem ${componentId} destroyed for ${notification.type}-${notification.planetId}`
		);
	});

	// Click handler to select the planet
	function handleClick() {
		console.log(`TaskItem clicked - selecting planet ${notification.planetId} (${notification.planetName})`);
		gameActions.selectPlanet(notification.planetId);
	}

	// Helper function to get task notification color
	function getTaskNotificationColor(type: TaskNotificationType): string {
		switch (type) {
			case TaskNotificationType.BuildQueueEmpty:
				return '#4ADE80'; // green-400
			case TaskNotificationType.InsufficientFood:
				return '#F87171'; // red-400
			default:
				return '#60A5FA'; // blue-400
		}
	}

	// Helper function to get task notification icon
	function getTaskNotificationIcon(type: TaskNotificationType): string {
		switch (type) {
			case TaskNotificationType.BuildQueueEmpty:
				return '🏗️'; // construction
			case TaskNotificationType.InsufficientFood:
				return '🍽️'; // food
			default:
				return '⚠️'; // warning
		}
	}

	// Helper function to get short task label
	function getShortTaskLabel(type: TaskNotificationType): string {
		switch (type) {
			case TaskNotificationType.BuildQueueEmpty:
				return 'Build Queue Empty';
			case TaskNotificationType.InsufficientFood:
				return 'Food Shortage';
			default:
				return 'Task';
		}
	}
</script>

<div
	class="task-item relative max-w-[220px] min-w-[180px] rounded-lg border border-gray-600/50 bg-black/40 p-2 backdrop-blur-sm transition-all duration-300 hover:border-cyan-400/50 hover:bg-black/60 cursor-pointer"
	title={notification.message}
	onclick={handleClick}
	role="button"
	tabindex="0"
	onkeydown={(e) => {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			handleClick();
		}
	}}
>
	<!-- Glowing border effect -->
	<div
		class="absolute inset-0 rounded-lg opacity-20 blur-sm"
		style="background: linear-gradient(45deg, {getTaskNotificationColor(
			notification.type
		)}, transparent);"
	></div>

	<!-- Content -->
	<div class="relative flex items-center gap-2">
		<!-- Icon -->
		<div
			class="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded text-xs"
			style="background-color: {getTaskNotificationColor(
				notification.type
			)}20; color: {getTaskNotificationColor(notification.type)};"
		>
			{getTaskNotificationIcon(notification.type)}
		</div>

		<!-- Text content -->
		<div class="min-w-0 flex-1">
			<div
				class="truncate text-xs font-medium"
				style="color: {getTaskNotificationColor(notification.type)};"
			>
				{getShortTaskLabel(notification.type)}
			</div>
			<div class="truncate text-xs text-gray-300">
				{notification.planetName}
			</div>
		</div>
	</div>

	<!-- Subtle scan line effect -->
	<div
		class="scan-line absolute top-0 right-0 left-0 h-px bg-gradient-to-r from-transparent via-cyan-400/30 to-transparent"
	></div>
</div>

<style>
	.task-item {
		box-shadow:
			0 2px 8px rgba(0, 0, 0, 0.3),
			inset 0 1px 0 rgba(255, 255, 255, 0.1);
	}

	.scan-line {
		animation: scan 3s ease-in-out infinite;
	}

	@keyframes scan {
		0%,
		100% {
			opacity: 0;
		}
		50% {
			opacity: 1;
		}
	}

	.task-item:hover .scan-line {
		animation-duration: 1s;
	}
</style>
