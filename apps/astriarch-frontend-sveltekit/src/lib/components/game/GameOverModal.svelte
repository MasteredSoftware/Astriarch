<script lang="ts">
	import { onMount } from 'svelte';
	import { type GameOverState } from '$lib/stores/multiplayerGameStore';
	import Dialog from '$lib/components/astriarch/dialog/Dialog.svelte';

	export let gameOverState: GameOverState;
	export let onClose: () => void = () => {};
	export let onNewGame: () => void = () => {};
	export let onReturnToLobby: () => void = () => {};

	let open = true;

	// Determine dialog variant and title based on game over state
	$: dialogVariant = gameOverState.playerWon ? 'success' : 'error';
	$: dialogTitle = gameOverState.playerWon
		? '🏆 VICTORY!'
		: gameOverState.allHumansDestroyed
			? '💀 DEFEAT'
			: '🌌 GAME OVER';

	function handleClose() {
		open = false;
		onClose();
	}

	function handleNewGame() {
		open = false;
		onNewGame();
	}

	function handleReturnToLobby() {
		open = false;
		onReturnToLobby();
	}

	// Format score with commas
	function formatScore(score: number): string {
		return score.toLocaleString();
	}
</script>

<Dialog
	bind:open
	title={dialogTitle}
	cancelButtonText="Return to Lobby"
	saveButtonText="New Game"
	onCancel={handleReturnToLobby}
	onSave={handleNewGame}
	size="large"
	variant={dialogVariant}
	style="svg"
>
	<!-- Game Over Content -->
	<div class="space-y-6">
		<!-- Victory/Defeat Message -->
		<div class="text-center">
			{#if gameOverState.playerWon}
				<p class="font-orbitron mb-2 text-xl font-bold tracking-wide text-green-400">
					Congratulations! You have conquered the galaxy!
				</p>
			{:else if gameOverState.allHumansDestroyed}
				<p class="font-orbitron mb-2 text-xl font-bold tracking-wide text-red-400">
					All human players have been destroyed...
				</p>
			{:else}
				<p class="font-orbitron mb-2 text-xl font-bold tracking-wide text-orange-400">
					{#if gameOverState.winningPlayer}
						{gameOverState.winningPlayer.name} has conquered the galaxy!
					{:else}
						The game has ended.
					{/if}
				</p>
			{/if}
		</div>

		<!-- Game Statistics -->
		<div class="rounded-lg border border-cyan-500/20 bg-black/20 p-6">
			<h3 class="font-orbitron mb-4 text-lg font-bold tracking-wider text-cyan-400">
				FINAL RESULTS
			</h3>

			<div class="space-y-3">
				{#if gameOverState.winningPlayer}
					<div class="flex items-center justify-between border-b border-white/10 py-2">
						<span class="font-orbitron text-sm tracking-wide text-white/70">WINNER:</span>
						<span class="font-orbitron text-lg font-bold text-green-400">
							{gameOverState.winningPlayer.name}
						</span>
					</div>
					<div class="flex items-center justify-between border-b border-white/10 py-2">
						<span class="font-orbitron text-sm tracking-wide text-white/70">POSITION:</span>
						<span class="font-orbitron font-bold text-white">
							Player {gameOverState.winningPlayer.position}
						</span>
					</div>
				{/if}

				<div class="flex items-center justify-between border-b border-white/10 py-2">
					<span class="font-orbitron text-sm tracking-wide text-white/70">YOUR FINAL SCORE:</span>
					<span class="font-orbitron font-mono text-xl font-bold text-cyan-400">
						{formatScore(gameOverState.finalScore)}
					</span>
				</div>

				<div class="flex items-center justify-between py-2">
					<span class="font-orbitron text-sm tracking-wide text-white/70">RESULT:</span>
					<span
						class="font-orbitron text-lg font-bold {gameOverState.playerWon
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
			<div class="rounded-lg border border-red-500/30 bg-red-900/20 p-4">
				<p class="font-orbitron text-center text-sm tracking-wide text-red-300">
					⚠️ All human civilizations have been eliminated from the galaxy
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
</style>
