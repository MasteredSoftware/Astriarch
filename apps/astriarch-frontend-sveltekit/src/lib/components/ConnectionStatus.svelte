<script lang="ts">
	import { multiplayerGameStore, webSocketService } from '$lib/services/websocket';
	import type { GameNotification } from '$lib/services/websocket';

	let gameState: any;
	let notifications: GameNotification[] = [];

	const unsubscribe = multiplayerGameStore.subscribe((state) => {
		gameState = state;
	});

	const unsubscribeNotifications = multiplayerGameStore.notifications.subscribe((notifs) => {
		notifications = notifs;
	});

	function dismissNotification(id: string) {
		multiplayerGameStore.removeNotification(id);
	}
</script>

<div class="connection-status">
	<div class="status-indicator" class:connected={gameState?.connected}>
		<span class="status-dot"></span>
		<span class="status-text">
			{gameState?.connected ? 'Connected' : 'Disconnected'}
		</span>
	</div>

	{#if gameState?.sessionId}
		<div class="session-info">
			Session: {gameState.sessionId.substring(0, 8)}...
		</div>
	{/if}

	{#if gameState?.playerName}
		<div class="player-info">
			Player: {gameState.playerName}
		</div>
	{/if}

	{#if gameState?.gameId}
		<div class="game-info">
			Game: {gameState.gameId.substring(0, 8)}...
		</div>
	{/if}
</div>

{#if notifications.length > 0}
	<div class="notifications">
		{#each notifications as notification (notification.id)}
			<div class="notification notification-{notification.type}">
				<div class="notification-content">
					<div class="notification-message">{notification.message}</div>
					<div class="notification-time">
						{new Date(notification.timestamp).toLocaleTimeString()}
					</div>
				</div>
				<button
					class="notification-dismiss"
					on:click={() => dismissNotification(notification.id)}
					aria-label="Dismiss notification"
				>
					×
				</button>
			</div>
		{/each}
	</div>
{/if}

<style>
	.connection-status {
		display: flex;
		align-items: center;
		gap: 15px;
		padding: 10px 15px;
		background-color: #333;
		border-radius: 8px;
		color: #fff;
		margin-bottom: 20px;
	}

	.status-indicator {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.status-dot {
		width: 12px;
		height: 12px;
		border-radius: 50%;
		background-color: #ff4444;
		animation: pulse 2s infinite;
	}

	.status-indicator.connected .status-dot {
		background-color: #44ff44;
		animation: none;
	}

	.status-text {
		font-weight: bold;
	}

	.session-info,
	.player-info,
	.game-info {
		font-size: 12px;
		color: #ccc;
		background-color: #444;
		padding: 4px 8px;
		border-radius: 4px;
	}

	.notifications {
		position: fixed;
		top: 20px;
		right: 20px;
		z-index: 1000;
		max-width: 400px;
	}

	.notification {
		display: flex;
		align-items: flex-start;
		padding: 12px;
		margin-bottom: 10px;
		border-radius: 8px;
		box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
		animation: slideIn 0.3s ease-out;
	}

	.notification-content {
		flex: 1;
	}

	.notification-message {
		font-weight: bold;
		margin-bottom: 4px;
	}

	.notification-time {
		font-size: 12px;
		opacity: 0.8;
	}

	.notification-dismiss {
		background: none;
		border: none;
		color: inherit;
		font-size: 18px;
		cursor: pointer;
		padding: 0;
		margin-left: 10px;
		width: 20px;
		height: 20px;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 50%;
	}

	.notification-dismiss:hover {
		background-color: rgba(255, 255, 255, 0.2);
	}

	.notification-info {
		background-color: #2196f3;
		color: white;
	}

	.notification-success {
		background-color: #4caf50;
		color: white;
	}

	.notification-warning {
		background-color: #ff9800;
		color: black;
	}

	.notification-error {
		background-color: #f44336;
		color: white;
	}

	.notification-battle {
		background-color: #9c27b0;
		color: white;
	}

	.notification-research {
		background-color: #00bcd4;
		color: white;
	}

	.notification-construction {
		background-color: #795548;
		color: white;
	}

	.notification-fleet {
		background-color: #607d8b;
		color: white;
	}

	.notification-planet {
		background-color: #8bc34a;
		color: black;
	}

	.notification-diplomacy {
		background-color: #ffc107;
		color: black;
	}

	@keyframes pulse {
		0% {
			opacity: 1;
		}
		50% {
			opacity: 0.5;
		}
		100% {
			opacity: 1;
		}
	}

	@keyframes slideIn {
		from {
			transform: translateX(100%);
			opacity: 0;
		}
		to {
			transform: translateX(0);
			opacity: 1;
		}
	}
</style>
