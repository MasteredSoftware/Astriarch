<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { Text } from '$lib/components/astriarch';
	import type { IGame } from '$lib/services/websocket';

	export let games: IGame[] = [];
	export let selectedGame: IGame | null = null;

	const dispatch = createEventDispatcher<{
		gameSelect: IGame;
	}>();

	function handleGameClick(game: IGame) {
		dispatch('gameSelect', game);
	}

	function formatDate(date: Date | string): string {
		const d = typeof date === 'string' ? new Date(date) : date;
		return (
			d.toLocaleDateString() +
			' ' +
			d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
		);
	}

	function getStatusDisplay(game: IGame): string {
		if (game.status === 'waiting') return 'Waiting for Players';
		if (game.status === 'in_progress') return 'In Progress';
		if (game.status === 'completed') return 'Completed';
		return 'Unknown';
	}

	function getStatusColor(game: IGame): string {
		if (game.status === 'waiting') return '#10B981'; // green
		if (game.status === 'in_progress') return '#F59E0B'; // yellow
		if (game.status === 'completed') return '#6B7280'; // gray
		return '#6B7280';
	}
</script>

<div class="game-list">
	{#if games.length === 0}
		<div class="empty-state">
			<Text style="color: #6B7280; font-size: 14px; text-align: center;">
				No games available. Create a new game to get started!
			</Text>
		</div>
	{:else}
		<div class="games-container">
			{#each games as game (game._id)}
				<div
					class="game-item {selectedGame?._id === game._id ? 'selected' : ''}"
					on:click={() => handleGameClick(game)}
					on:keydown={(e) => {
						if (e.key === 'Enter' || e.key === ' ') {
							e.preventDefault();
							handleGameClick(game);
						}
					}}
					role="button"
					tabindex="0"
				>
					<div class="game-header">
						<Text style="font-size: 16px; color: #FFFFFF; font-weight: 600;">
							{game.name}
						</Text>
						<div class="status-indicator" style="background-color: {getStatusColor(game)};"></div>
					</div>

					<div class="game-info">
						<Text style="font-size: 12px; color: #94A3B8;">
							Status: <span style="color: {getStatusColor(game)};">{getStatusDisplay(game)}</span>
						</Text>
						<Text style="font-size: 12px; color: #94A3B8;">
							Players: {game.players?.length || 0}/{game.gameOptions?.maxPlayers || 4}
						</Text>
						<Text style="font-size: 12px; color: #94A3B8;">
							Galaxy: {game.gameOptions?.galaxySize || 'Medium'}
						</Text>
					</div>

					<div class="game-meta">
						<Text style="font-size: 11px; color: #6B7280;">
							Created: {formatDate(game.createdAt)}
						</Text>
						{#if game.lastActivity}
							<Text style="font-size: 11px; color: #6B7280;">
								Last Active: {formatDate(game.lastActivity)}
							</Text>
						{/if}
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>

<style>
	.game-list {
		position: absolute;
		top: 0;
		bottom: 0;
		left: 0;
		right: 0;
		overflow-y: auto;
	}

	.empty-state {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 200px;
		border: 2px dashed rgba(107, 114, 128, 0.3);
		border-radius: 8px;
	}

	.games-container {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.game-item {
		padding: 1rem;
		border: 1px solid rgba(0, 255, 255, 0.2);
		border-radius: 6px;
		background: rgba(0, 0, 0, 0.4);
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.game-item:hover {
		border-color: rgba(0, 255, 255, 0.4);
		background: rgba(0, 0, 0, 0.6);
		transform: translateY(-1px);
	}

	.game-item.selected {
		border-color: #00ffff;
		background: rgba(0, 255, 255, 0.1);
		box-shadow: 0 0 10px rgba(0, 255, 255, 0.3);
	}

	.game-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 0.5rem;
	}

	.status-indicator {
		width: 8px;
		height: 8px;
		border-radius: 50%;
	}

	.game-info {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		margin-bottom: 0.5rem;
	}

	.game-meta {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		border-top: 1px solid rgba(107, 114, 128, 0.2);
		padding-top: 0.5rem;
	}
</style>
