<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import {
		MESSAGE_TYPE,
		Message,
		getMessageTypeName,
		getMessageTypeNumeric
	} from 'astriarch-engine';
	import { getBackendWsUrl } from '$lib/config/environment';

	let ws: WebSocket | null = null;
	let connected = false;
	let messageLog: string[] = [];
	let currentGameId: string | null = null;

	// Form inputs
	let playerName = 'TestPlayer';
	let gameName = 'Test Game';
	let gameIdToJoin = '';
	let chatMessage = '';
	let rawMessageType = 'NOOP';
	let rawMessagePayload = '{}';

	// Available message types for the dropdown
	const messageTypes = Object.values(MESSAGE_TYPE);

	function log(message: string) {
		const time = new Date().toLocaleTimeString();
		messageLog = [`[${time}] ${message}`, ...messageLog.slice(0, 49)]; // Keep last 50 messages
	}

	function connect() {
		if (ws) {
			log('Already connected');
			return;
		}

		const wsUrl = getBackendWsUrl();
		ws = new WebSocket(wsUrl);

		ws.onopen = () => {
			log(`✅ Connected to WebSocket server at ${wsUrl}`);
			connected = true;
		};

		ws.onmessage = (event) => {
			try {
				const message = JSON.parse(event.data);
				log(
					`📥 Received: ${getMessageTypeName(message.type)} - ${JSON.stringify(message.payload)}`
				);

				// Handle specific message types
				if (message.type === MESSAGE_TYPE.CREATE_GAME && message.payload) {
					currentGameId = message.payload as string;
					log(`🎮 Game created with ID: ${currentGameId}`);
					gameIdToJoin = currentGameId;
				}
			} catch (error) {
				log(`❌ Error parsing message: ${event.data}`);
			}
		};

		ws.onclose = () => {
			log('❌ Disconnected from WebSocket server');
			connected = false;
			ws = null;
		};

		ws.onerror = (error) => {
			log(`❌ WebSocket error: ${error}`);
		};
	}

	function disconnect() {
		if (ws) {
			ws.close();
		}
	}

	function sendMessage(type: MESSAGE_TYPE, payload: Record<string, unknown>) {
		if (!ws || ws.readyState !== WebSocket.OPEN) {
			log('❌ Not connected to server');
			return;
		}

		const message = new Message(type, payload);
		ws.send(JSON.stringify(message));
		log(`📤 Sent: ${type} - ${JSON.stringify(payload)}`);
	}

	function createGame() {
		sendMessage(MESSAGE_TYPE.CREATE_GAME, {
			name: gameName,
			playerName: playerName
		});
	}

	function joinGame() {
		if (!gameIdToJoin) {
			log('❌ Please enter a game ID to join');
			return;
		}

		sendMessage(MESSAGE_TYPE.JOIN_GAME, {
			gameId: gameIdToJoin,
			playerName: playerName
		});
	}

	function sendRawMessage() {
		try {
			const payload = JSON.parse(rawMessagePayload);
			const messageType = rawMessageType as MESSAGE_TYPE;
			sendMessage(messageType, payload);
		} catch (error) {
			log(`❌ Invalid JSON payload: ${error instanceof Error ? error.message : String(error)}`);
		}
	}

	function sendChatMessage() {
		if (!chatMessage.trim()) {
			log('❌ Please enter a chat message');
			return;
		}

		if (!currentGameId) {
			log('❌ You must be in a game to send chat messages');
			return;
		}

		sendMessage(MESSAGE_TYPE.CHAT_MESSAGE, {
			gameId: currentGameId,
			message: chatMessage.trim()
		});
		chatMessage = '';
	}

	function clearLog() {
		messageLog = [];
	}

	onMount(() => {
		const wsUrl = getBackendWsUrl();
		log(`🚀 WebSocket test client loaded. Backend: ${wsUrl}`);
		log('Click Connect to start.');
	});

	onDestroy(() => {
		if (ws) {
			ws.close();
		}
	});
</script>

<svelte:head>
	<title>Astriarch WebSocket Test</title>
</svelte:head>

<div class="container">
	<h1>Astriarch WebSocket Test Client</h1>

	<!-- Connection Controls -->
	<div class="card">
		<h2>Connection</h2>
		<div class="controls">
			<button on:click={connect} disabled={connected} class="btn-primary"> Connect </button>
			<button on:click={disconnect} disabled={!connected} class="btn-secondary">
				Disconnect
			</button>
			<span class="status" class:connected>
				{connected ? 'Connected' : 'Disconnected'}
			</span>
		</div>
	</div>

	<!-- Basic Game Actions -->
	<div class="card">
		<h2>Basic Actions</h2>
		<div class="controls">
			<button
				on:click={() => sendMessage(MESSAGE_TYPE.NOOP, { message: 'Hello', counter: 0 })}
				disabled={!connected}
				class="btn"
			>
				Send NOOP
			</button>
			<button on:click={() => sendMessage(MESSAGE_TYPE.PING, {})} disabled={!connected} class="btn">
				Send PING
			</button>
			<button
				on:click={() => sendMessage(MESSAGE_TYPE.LIST_GAMES, {})}
				disabled={!connected}
				class="btn"
			>
				List Games
			</button>
		</div>
	</div>

	<!-- Game Management -->
	<div class="card">
		<h2>Game Management</h2>
		<div class="form-group">
			<label>
				Player Name:
				<input type="text" bind:value={playerName} placeholder="Player Name" />
			</label>
			<label>
				Game Name:
				<input type="text" bind:value={gameName} placeholder="Game Name" />
			</label>
			<button on:click={createGame} disabled={!connected} class="btn-primary"> Create Game </button>
		</div>

		<div class="form-group">
			<label>
				Game ID to Join:
				<input type="text" bind:value={gameIdToJoin} placeholder="Game ID" />
			</label>
			<button on:click={joinGame} disabled={!connected} class="btn-primary"> Join Game </button>
		</div>

		{#if currentGameId}
			<div class="current-game">
				<strong>Current Game ID:</strong>
				{currentGameId}
			</div>
		{/if}
	</div>

	<!-- Chat Testing -->
	<div class="card">
		<h2>Chat Testing</h2>
		<div class="form-group">
			<label>
				Chat Message:
				<input
					type="text"
					bind:value={chatMessage}
					placeholder="Type a message..."
					on:keydown={(e) => e.key === 'Enter' && sendChatMessage()}
				/>
			</label>
			<button
				on:click={sendChatMessage}
				disabled={!connected || !chatMessage.trim()}
				class="btn-primary"
			>
				Send Chat
			</button>
		</div>
	</div>

	<!-- Raw Message Testing -->
	<div class="card">
		<h2>Raw Message Testing</h2>
		<div class="form-group">
			<label>
				Message Type:
				<select bind:value={rawMessageType}>
					{#each messageTypes as messageType}
						<option value={messageType}>{messageType}</option>
					{/each}
				</select>
			</label>
			<label>
				JSON Payload:
				<textarea bind:value={rawMessagePayload} placeholder="JSON Payload" rows="3"></textarea>
			</label>
			<button on:click={sendRawMessage} disabled={!connected} class="btn">
				Send Raw Message
			</button>
		</div>
	</div>

	<!-- Message Log -->
	<div class="card">
		<div class="log-header">
			<h2>Message Log</h2>
			<button on:click={clearLog} class="btn-small">Clear</button>
		</div>
		<div class="message-log">
			{#each messageLog as message}
				<div class="log-entry">{message}</div>
			{/each}
			{#if messageLog.length === 0}
				<div class="log-empty">No messages yet...</div>
			{/if}
		</div>
	</div>
</div>

<style>
	.container {
		max-width: 1000px;
		margin: 0 auto;
		padding: 20px;
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
	}

	h1 {
		text-align: center;
		color: #333;
		margin-bottom: 30px;
	}

	.card {
		background: white;
		border: 1px solid #ddd;
		border-radius: 8px;
		margin: 20px 0;
		padding: 20px;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
	}

	.card h2 {
		margin: 0 0 15px 0;
		color: #555;
		font-size: 1.2em;
	}

	.controls {
		display: flex;
		gap: 10px;
		align-items: center;
		flex-wrap: wrap;
	}

	.form-group {
		display: flex;
		flex-direction: column;
		gap: 15px;
		margin-bottom: 15px;
	}

	.form-group label {
		display: flex;
		flex-direction: column;
		gap: 5px;
		font-weight: 500;
	}

	.form-group input,
	.form-group select,
	.form-group textarea {
		padding: 8px 12px;
		border: 1px solid #ddd;
		border-radius: 4px;
		font-size: 14px;
	}

	.form-group textarea {
		resize: vertical;
		font-family: monospace;
	}

	button {
		padding: 8px 16px;
		border: none;
		border-radius: 4px;
		cursor: pointer;
		font-size: 14px;
		transition: background-color 0.2s;
	}

	button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.btn-primary {
		background: #007acc;
		color: white;
	}

	.btn-primary:hover:not(:disabled) {
		background: #005fa3;
	}

	.btn-secondary {
		background: #666;
		color: white;
	}

	.btn-secondary:hover:not(:disabled) {
		background: #555;
	}

	.btn {
		background: #f0f0f0;
		color: #333;
		border: 1px solid #ddd;
	}

	.btn:hover:not(:disabled) {
		background: #e0e0e0;
	}

	.btn-small {
		padding: 4px 8px;
		font-size: 12px;
	}

	.status {
		padding: 4px 8px;
		border-radius: 4px;
		font-weight: 500;
		background: #ffebee;
		color: #c62828;
	}

	.status.connected {
		background: #e8f5e8;
		color: #2e7d32;
	}

	.current-game {
		padding: 10px;
		background: #e3f2fd;
		border: 1px solid #1976d2;
		border-radius: 4px;
		color: #1976d2;
		margin-top: 10px;
	}

	.log-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 10px;
	}

	.message-log {
		height: 300px;
		overflow-y: auto;
		border: 1px solid #ddd;
		border-radius: 4px;
		padding: 10px;
		background: #f9f9f9;
		font-family: monospace;
		font-size: 13px;
	}

	.log-entry {
		margin: 2px 0;
		padding: 2px 0;
		word-break: break-all;
	}

	.log-empty {
		color: #999;
		font-style: italic;
		text-align: center;
		padding: 20px;
	}

	@media (max-width: 768px) {
		.container {
			padding: 10px;
		}

		.controls {
			flex-direction: column;
			align-items: stretch;
		}
	}
</style>
