<script lang="ts">
	import Dialog from '$lib/components/astriarch/dialog/Dialog.svelte';

	export let pauseReason: string | null = null;

	// Parse the reason to get a user-friendly message
	$: reasonMessage =
		pauseReason === 'waiting_for_players'
			? 'Waiting for disconnected players to reconnect'
			: pauseReason || 'Game paused';
</script>

<Dialog open={true} title="GAME PAUSED" size="large" variant="warning" showCloseButton={false}>
	<!-- Game Paused Content -->
	<div class="max-h-[280px] space-y-4 overflow-y-auto">
		<!-- Status Message -->
		<div class="text-center">
			<p class="font-orbitron text-lg font-bold tracking-wide text-yellow-400">
				⏸️ Game Temporarily Paused
			</p>
		</div>

		<!-- Reason and Instructions -->
		<div class="rounded border border-yellow-500/30 bg-yellow-900/20 p-4">
			<h3 class="font-orbitron mb-3 text-base font-bold tracking-wider text-yellow-400">
				WAITING FOR PLAYERS
			</h3>

			<div class="space-y-3 text-sm">
				<p class="font-orbitron text-white/90">
					{reasonMessage}
				</p>

				<div class="rounded border border-yellow-500/20 bg-black/30 p-3">
					<p class="font-orbitron text-xs tracking-wide text-white/70">
						The game will automatically resume when all players have reconnected.
					</p>
				</div>

				<!-- Loading animation indicator -->
				<div class="flex items-center justify-center gap-2 pt-2">
					<div class="h-2 w-2 animate-pulse rounded-full bg-yellow-400"></div>
					<div class="animation-delay-200 h-2 w-2 animate-pulse rounded-full bg-yellow-400"></div>
					<div class="animation-delay-400 h-2 w-2 animate-pulse rounded-full bg-yellow-400"></div>
				</div>
			</div>
		</div>

		<!-- Additional Information -->
		<div class="rounded border border-cyan-500/20 bg-black/20 p-3">
			<p class="font-orbitron text-center text-xs tracking-wide text-cyan-300">
				💡 TIP: You can still view the galaxy while waiting
			</p>
		</div>
	</div>
</Dialog>

<style>
	/* Override dialog styles for game paused specific styling */
	:global(.font-orbitron) {
		font-family: 'Orbitron', monospace;
	}

	/* Animation delay utilities */
	.animation-delay-200 {
		animation-delay: 200ms;
	}

	.animation-delay-400 {
		animation-delay: 400ms;
	}

	/* Custom scrollbar for content area */
	.max-h-\[280px\]::-webkit-scrollbar {
		width: 6px;
	}

	.max-h-\[280px\]::-webkit-scrollbar-track {
		background: rgba(0, 0, 0, 0.3);
		border-radius: 3px;
	}

	.max-h-\[280px\]::-webkit-scrollbar-thumb {
		background: rgba(251, 191, 36, 0.4);
		border-radius: 3px;
	}

	.max-h-\[280px\]::-webkit-scrollbar-thumb:hover {
		background: rgba(251, 191, 36, 0.6);
	}
</style>
