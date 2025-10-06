<script lang="ts">
	import { onMount } from 'svelte';
	import Notification from './Notification.svelte';
	import type { GameNotification } from '$lib/stores/multiplayerGameStore';

	interface Props {
		notification: GameNotification;
		onDismiss: () => void;
	}

	let { notification, onDismiss }: Props = $props();

	// Animation state
	let visible = $state(false);
	let fadeOut = $state(false);

	let fadeOutTimeout: ReturnType<typeof setTimeout> | null = null;
	let dismissTimeout: ReturnType<typeof setTimeout> | null = null;

	// Initialize component visibility
	onMount(() => {
		// Trigger slide-in animation after a small delay
		setTimeout(() => {
			visible = true;
		}, 50);

		// If auto-remove is enabled, start fade-out animation
		if (notification.duration) {
			const duration = notification.duration || 5000;

			// Start fade-out animation 800ms before removal for smoother transition
			const fadeOutTime = duration - 800;
			fadeOutTimeout = setTimeout(() => {
				fadeOut = true;

				// Dismiss after fade animation completes
				dismissTimeout = setTimeout(() => {
					onDismiss();
				}, 800);
			}, fadeOutTime);
		}

		// Cleanup function
		return () => {
			if (fadeOutTimeout) clearTimeout(fadeOutTimeout);
			if (dismissTimeout) clearTimeout(dismissTimeout);
		};
	});

	// Helper function to get notification type label
	function getNotificationTypeLabel(type: GameNotification['type']): string {
		const typeLabels = {
			info: 'Info',
			success: 'Success',
			warning: 'Warning',
			error: 'Error',
			battle: 'Battle',
			research: 'Research',
			construction: 'Construction',
			fleet: 'Fleet',
			planet: 'Planet',
			chat: 'Chat'
		};
		return typeLabels[type] || 'Notification';
	}

	// Get notification type color for progress bar
	function getNotificationColor(type: GameNotification['type']): string {
		const colors = {
			info: '#0ea5e9', // sky-500
			success: '#10b981', // emerald-500
			warning: '#f59e0b', // amber-500
			error: '#ef4444', // red-500
			battle: '#dc2626', // red-600
			research: '#8b5cf6', // violet-500
			construction: '#f97316', // orange-500
			fleet: '#06b6d4', // cyan-500
			planet: '#65a30d', // lime-600
			diplomacy: '#d946ef', // fuchsia-500
			chat: '#6b7280' // gray-500
		};
		return colors[type] || '#0ea5e9';
	}

	// Handle manual dismiss (clicking on notification)
	function handleClick() {
		// Clear any existing timeouts
		if (fadeOutTimeout) clearTimeout(fadeOutTimeout);
		if (dismissTimeout) clearTimeout(dismissTimeout);

		fadeOut = true;
		setTimeout(() => {
			onDismiss();
		}, 500);
	}
</script>

<div
	class="notification-item transition-all duration-700 ease-in-out"
	class:visible
	class:fade-out={fadeOut}
>
	<Notification size="md" onclick={handleClick}>
		<span class="font-medium" style="color: {getNotificationColor(notification.type)};">
			{getNotificationTypeLabel(notification.type)}:
		</span>
		<span class="ml-1 text-white">{notification.message}</span>
	</Notification>
</div>

<style>
	.notification-item {
		transform: translateX(100%);
		opacity: 0;
		transition: all 0.7s ease-in-out;
	}

	.notification-item.visible {
		transform: translateX(0);
		opacity: 1;
	}

	.notification-item.fade-out {
		transform: translateX(100%);
		opacity: 0;
	}
</style>
