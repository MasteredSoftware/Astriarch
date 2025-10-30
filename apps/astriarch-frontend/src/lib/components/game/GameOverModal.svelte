<script lang="ts">
	import { onMount } from 'svelte';
	import { type GameOverState } from '$lib/stores/multiplayerGameStore';
	import Dialog from '$lib/components/astriarch/dialog/Dialog.svelte';

	export let gameOverState: GameOverState;
	export let onClose: () => void = () => {};

	let open = true;

	// Determine dialog variant and title based on game over state
	let dialogVariant: 'success' | 'error';
	$: dialogVariant = gameOverState.playerWon ? 'success' : 'error';
	$: dialogTitle = gameOverState.playerWon
		? 'VICTORY'
		: gameOverState.allHumansDestroyed
			? 'DEFEAT'
			: 'GAME OVER';

	function handleClose() {
		open = false;
		onClose();
	}

	// Format score with commas
	function formatScore(score: number): string {
		return score.toLocaleString();
	}
</script>

<Dialog
	bind:open
	title={dialogTitle}
	cancelButtonText="Exit"
	onCancel={handleClose}
	size="large"
	variant={dialogVariant}
	style="svg"
	showCloseButton={false}
>
	<!-- Game Over Content -->
	<div class="max-h-[280px] space-y-4 overflow-y-auto">
		<!-- Victory/Defeat Message -->
		<div class="text-center">
			{#if gameOverState.playerWon}
				<p class="font-orbitron text-lg font-bold tracking-wide text-green-400">
					You conquered the galaxy!
				</p>
			{:else if gameOverState.allHumansDestroyed}
				<p class="font-orbitron text-lg font-bold tracking-wide text-red-400">
					All humans destroyed
				</p>
			{:else}
				<p class="font-orbitron text-lg font-bold tracking-wide text-orange-400">
					{#if gameOverState.winningPlayer}
						{gameOverState.winningPlayer.name} conquered the galaxy
					{:else}
						Game ended
					{/if}
				</p>
			{/if}
		</div>

		<!-- Game Statistics -->
		<div class="rounded border border-cyan-500/20 bg-black/20 p-4">
			<h3 class="font-orbitron mb-3 text-base font-bold tracking-wider text-cyan-400">
				FINAL RESULTS
			</h3>

			<div class="space-y-2 text-sm">
				{#if gameOverState.winningPlayer}
					<div class="flex items-center justify-between">
						<span class="font-orbitron tracking-wide text-white/70">Winner:</span>
						<span class="font-orbitron font-bold text-green-400">
							{gameOverState.winningPlayer.name}
						</span>
					</div>
				{/if}

				<div class="flex items-center justify-between">
					<span class="font-orbitron tracking-wide text-white/70">Your Score:</span>
					<span class="font-orbitron font-mono text-lg font-bold text-cyan-400">
						{formatScore(gameOverState.finalScore)}
					</span>
				</div>

				<div class="flex items-center justify-between border-t border-white/10 pt-2">
					<span class="font-orbitron tracking-wide text-white/70">Result:</span>
					<span
						class="font-orbitron font-bold {gameOverState.playerWon
							? 'text-green-400'
							: 'text-red-400'}"
					>
						{gameOverState.playerWon ? 'VICTORY' : 'DEFEAT'}
					</span>
				</div>
			</div>
		</div>

		<!-- Additional Details -->
		{#if gameOverState.allHumansDestroyed}
			<div class="rounded border border-red-500/30 bg-red-900/20 p-3">
				<p class="font-orbitron text-center text-xs tracking-wide text-red-300">
					⚠️ All human civilizations eliminated
				</p>
			</div>
		{/if}
	</div>
</Dialog>

<style>
	/* Override dialog styles for game over specific styling */
	:global(.font-orbitron) {
		font-family: 'Orbitron', monospace;
	}

	/* Enhanced space-themed styling */
	:global(.font-mono) {
		font-family: 'Courier New', monospace;
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
		background: rgba(0, 255, 255, 0.4);
		border-radius: 3px;
	}

	.max-h-\[280px\]::-webkit-scrollbar-thumb:hover {
		background: rgba(0, 255, 255, 0.6);
	}
</style>
