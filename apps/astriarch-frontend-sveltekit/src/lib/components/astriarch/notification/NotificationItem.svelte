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
	let progress = $state(100); // Progress bar percentage (starts at 100%)

	let progressInterval: number | null = null;
	let fadeOutTimeout: number | null = null;
	let dismissTimeout: number | null = null;

	// Initialize component visibility
	onMount(() => {
		// Trigger slide-in animation after a small delay
		setTimeout(() => {
			visible = true;
		}, 10);

		// If auto-remove is enabled, start progress bar and fade-out animation
		if (notification.duration) {
			const duration = notification.duration || 5000;
			const updateInterval = 50; // Update every 50ms for smooth animation
			const steps = duration / updateInterval;
			let currentStep = 0;

			// Start progress bar countdown
			progressInterval = setInterval(() => {
				currentStep++;
				progress = Math.max(0, 100 - (currentStep / steps) * 100);
				
				if (progress <= 0) {
					if (progressInterval) clearInterval(progressInterval);
				}
			}, updateInterval);

			// Start fade-out animation 500ms before removal
			const fadeOutTime = duration - 500;
			fadeOutTimeout = setTimeout(() => {
				fadeOut = true;
				
				// Dismiss after fade animation completes
				dismissTimeout = setTimeout(() => {
					onDismiss();
				}, 500);
			}, fadeOutTime);
		}

		// Cleanup function
		return () => {
			if (progressInterval) clearInterval(progressInterval);
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
			diplomacy: 'Diplomacy'
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
			diplomacy: '#d946ef' // fuchsia-500
		};
		return colors[type] || '#0ea5e9';
	}

	// Handle manual dismiss (clicking on notification)
	function handleClick() {
		// Clear any existing timeouts
		if (progressInterval) clearInterval(progressInterval);
		if (fadeOutTimeout) clearTimeout(fadeOutTimeout);
		if (dismissTimeout) clearTimeout(dismissTimeout);
		
		fadeOut = true;
		setTimeout(() => {
			onDismiss();
		}, 300);
	}
</script>

<div
	class="notification-item transition-all duration-500 ease-in-out"
	class:visible
	class:fade-out={fadeOut}
>
	<div class="relative">
		<Notification
			label="{getNotificationTypeLabel(notification.type)}: {notification.message}"
			size="md"
			onclick={handleClick}
		/>
		
		<!-- Progress bar for auto-removing notifications -->
		{#if notification.duration}
			<div 
				class="absolute bottom-0 left-0 h-1 rounded-b transition-all duration-75 ease-linear"
				style="width: {progress}%; background-color: {getNotificationColor(notification.type)};"
			></div>
		{/if}
	</div>
</div>

<style>
	.notification-item {
		transform: translateX(100%);
		opacity: 0;
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
