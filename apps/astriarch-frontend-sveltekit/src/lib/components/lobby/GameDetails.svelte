<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { Text, Button } from '$lib/components/astriarch';
	import type { IGame } from '$lib/services/websocket';

	export let game: IGame | null = null;

	const dispatch = createEventDispatcher<{
		joinGame: IGame;
		spectateGame: IGame;
		resumeGame: IGame;
	}>();

	function handleJoinGame() {
		if (game) {
			dispatch('joinGame', game);
		}
	}

	function handleSpectateGame() {
		if (game) {
			dispatch('spectateGame', game);
		}
	}

	function handleResumeGame() {
		if (game) {
			dispatch('resumeGame', game);
		}
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
		if (game.status === 'waiting') return '#10B981';
		if (game.status === 'in_progress') return '#F59E0B';
		if (game.status === 'completed') return '#6B7280';
		return '#6B7280';
	}

	function canJoinGame(game: IGame): boolean {
		// Can join if the game is waiting for players
		// The server already filters to only show games we can join
		return (
			game.status === 'waiting' ||
			game.status === 'waiting_for_players' ||
			(game as any).started === false
		);
	}

	function canSpectateGame(game: IGame): boolean {
		return game.status === 'in_progress';
	}

	function canResumeGame(game: IGame): boolean {
		// Can resume if the game is in progress
		// The server already filters to only show games where we're a player
		return game.status === 'in_progress' || (game as any).started === true;
	}
</script>

<div class="game-details">
	{#if !game}
		<div class="empty-state">
			<Text style="color: #6B7280; font-size: 14px; text-align: center;">
				Select a game to view details
			</Text>
		</div>
	{:else}
		<div class="details-container">
			<!-- Game Header -->
			<div class="game-header">
				<div class="title-section">
					<Text style="font-size: 20px; color: #FFFFFF; font-weight: 700;">
						{game.name}
					</Text>
					<div class="status-badge" style="background-color: {getStatusColor(game)};">
						<Text style="font-size: 12px; color: #FFFFFF; font-weight: 600;">
							{getStatusDisplay(game)}
						</Text>
					</div>
				</div>

				{#if game.description}
					<Text style="font-size: 14px; color: #94A3B8; margin-top: 0.5rem;">
						{game.description}
					</Text>
				{/if}
			</div>

			<!-- Game Options -->
			<div class="section">
				<Text style="font-size: 16px; color: #FFFFFF; font-weight: 600; margin-bottom: 0.75rem;">
					Game Settings
				</Text>
				<div class="settings-grid">
					<div class="setting-item">
						<Text style="font-size: 12px; color: #6B7280;">Galaxy Size</Text>
						<Text style="font-size: 14px; color: #FFFFFF;">
							{game.gameOptions?.galaxySize || 'Medium'}
						</Text>
					</div>
					<div class="setting-item">
						<Text style="font-size: 12px; color: #6B7280;">Game Speed</Text>
						<Text style="font-size: 14px; color: #FFFFFF;">
							{game.gameOptions?.gameSpeed || 'Normal'}
						</Text>
					</div>
					<div class="setting-item">
						<Text style="font-size: 12px; color: #6B7280;">Max Players</Text>
						<Text style="font-size: 14px; color: #FFFFFF;">
							{game.gameOptions?.maxPlayers || 4}
						</Text>
					</div>
					<div class="setting-item">
						<Text style="font-size: 12px; color: #6B7280;">Victory Condition</Text>
						<Text style="font-size: 14px; color: #FFFFFF;">
							{game.gameOptions?.victoryCondition || 'Conquest'}
						</Text>
					</div>
				</div>
			</div>

			<!-- Players -->
			<div class="section">
				<Text style="font-size: 16px; color: #FFFFFF; font-weight: 600; margin-bottom: 0.75rem;">
					Players ({game.players?.length || 0}/{game.gameOptions?.maxPlayers || 4})
				</Text>
				<div class="players-list">
					{#if game.players && game.players.length > 0}
						{#each game.players as player}
							<div class="player-item">
								<div class="player-info">
									<Text style="font-size: 14px; color: #FFFFFF;">
										{player.username || player.name || 'Unknown Player'}
									</Text>
									{#if player.isHost}
										<div class="host-badge">
											<Text style="font-size: 10px; color: #000000; font-weight: 600;">HOST</Text>
										</div>
									{/if}
								</div>
								{#if player.isReady !== undefined}
									<div class="ready-status {player.isReady ? 'ready' : 'not-ready'}">
										<Text style="font-size: 12px; color: #FFFFFF;">
											{player.isReady ? 'Ready' : 'Not Ready'}
										</Text>
									</div>
								{/if}
							</div>
						{/each}
					{:else}
						<Text style="font-size: 14px; color: #6B7280;">No players yet</Text>
					{/if}
				</div>
			</div>

			<!-- Game Info -->
			<div class="section">
				<Text style="font-size: 16px; color: #FFFFFF; font-weight: 600; margin-bottom: 0.75rem;">
					Game Information
				</Text>
				<div class="info-grid">
					<div class="info-item">
						<Text style="font-size: 12px; color: #6B7280;">Created</Text>
						<Text style="font-size: 14px; color: #FFFFFF;">
							{formatDate(game.createdAt)}
						</Text>
					</div>
					{#if game.lastActivity}
						<div class="info-item">
							<Text style="font-size: 12px; color: #6B7280;">Last Activity</Text>
							<Text style="font-size: 14px; color: #FFFFFF;">
								{formatDate(game.lastActivity)}
							</Text>
						</div>
					{/if}
					{#if game.turn !== undefined}
						<div class="info-item">
							<Text style="font-size: 12px; color: #6B7280;">Turn</Text>
							<Text style="font-size: 14px; color: #FFFFFF;">
								{game.turn}
							</Text>
						</div>
					{/if}
				</div>
			</div>

			<!-- Actions -->
			<div class="actions">
				{#if canJoinGame(game)}
					<Button
						style="background: linear-gradient(135deg, #00FFFF, #0080FF); color: #000000; font-weight: 600; width: 100%; margin-bottom: 0.5rem;"
						onclick={handleJoinGame}
					>
						Join Game
					</Button>
				{/if}

				{#if canResumeGame(game)}
					<Button
						style="background: linear-gradient(135deg, #10B981, #059669); color: #FFFFFF; font-weight: 600; width: 100%; margin-bottom: 0.5rem;"
						onclick={handleResumeGame}
					>
						Resume Game
					</Button>
				{/if}

				{#if canSpectateGame(game)}
					<Button
						style="background: rgba(0, 255, 255, 0.1); border: 1px solid #00FFFF; color: #00FFFF; width: 100%;"
						onclick={handleSpectateGame}
					>
						Spectate Game
					</Button>
				{/if}

				{#if game.status === 'completed'}
					<Text style="font-size: 14px; color: #6B7280; text-align: center;">
						This game has ended
					</Text>
				{/if}
			</div>
		</div>
	{/if}
</div>

<style>
	.game-details {
		height: 100%;
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

	.details-container {
		padding: 1rem;
		height: 100%;
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	.game-header {
		border-bottom: 1px solid rgba(0, 255, 255, 0.2);
		padding-bottom: 1rem;
	}

	.title-section {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.status-badge {
		padding: 0.25rem 0.5rem;
		border-radius: 12px;
		font-size: 12px;
	}

	.section {
		display: flex;
		flex-direction: column;
	}

	.settings-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.75rem;
	}

	.setting-item {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		padding: 0.75rem;
		border: 1px solid rgba(0, 255, 255, 0.2);
		border-radius: 6px;
		background: rgba(0, 0, 0, 0.2);
	}

	.players-list {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.player-item {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.75rem;
		border: 1px solid rgba(0, 255, 255, 0.2);
		border-radius: 6px;
		background: rgba(0, 0, 0, 0.2);
	}

	.player-info {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.host-badge {
		padding: 0.125rem 0.375rem;
		background: #00ffff;
		border-radius: 8px;
		font-size: 10px;
		font-weight: 600;
	}

	.ready-status {
		padding: 0.25rem 0.5rem;
		border-radius: 12px;
		font-size: 12px;
	}

	.ready-status.ready {
		background: #10b981;
	}

	.ready-status.not-ready {
		background: #6b7280;
	}

	.info-grid {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.info-item {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.5rem 0;
		border-bottom: 1px solid rgba(107, 114, 128, 0.2);
	}

	.info-item:last-child {
		border-bottom: none;
	}

	.actions {
		margin-top: auto;
		padding-top: 1rem;
		border-top: 1px solid rgba(0, 255, 255, 0.2);
	}
</style>
