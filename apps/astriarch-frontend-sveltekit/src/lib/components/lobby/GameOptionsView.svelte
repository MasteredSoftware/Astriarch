<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { Text, Button } from '$lib/components/astriarch';
	import { webSocketService } from '$lib/services/websocket';

	export let gameId: string;
	export let gameOptions: any = {};
	export let playerPosition: number = 0;
	export let isHost: boolean = false;

	const dispatch = createEventDispatcher<{
		startGame: void;
		backToLobby: void;
	}>();

	// Game options with defaults matching old game
	let formData = {
		name: gameOptions?.name || 'New Game',
		playerName: gameOptions?.mainPlayerName || 'Player',
		systemsToGenerate: gameOptions?.systemsToGenerate || 4,
		planetsPerSystem: gameOptions?.planetsPerSystem || 4,
		galaxySize: gameOptions?.galaxySize || 4,
		distributePlanetsEvenly: gameOptions?.distributePlanetsEvenly ?? true,
		quickStart: gameOptions?.quickStart ?? false,
		turnTimeLimitSeconds: gameOptions?.turnTimeLimitSeconds || 0,
		opponentOptions: gameOptions?.opponentOptions || [
			{ name: '', type: -1 }, // Player 2: Open
			{ name: '', type: -2 }, // Player 3: Closed
			{ name: '', type: -2 }  // Player 4: Closed
		]
	};

	// Galaxy size options
	const galaxySizeOptions = [
		{ value: 1, label: 'Tiny' },
		{ value: 2, label: 'Small' },
		{ value: 3, label: 'Medium' },
		{ value: 4, label: 'Large' }
	];

	// Systems/Players options
	const systemsOptions = [
		{ value: 2, label: '2' },
		{ value: 3, label: '3' },
		{ value: 4, label: '4' }
	];

	// Planets per system options (dynamically updated based on galaxy size)
	$: planetsPerSystemOptions = getPlanetsPerSystemOptions(formData.galaxySize);

	function getPlanetsPerSystemOptions(galaxySize: number) {
		const maxPlanets = galaxySize === 1 ? 6 : 8; // Tiny galaxy has max 6 planets
		const options = [];
		for (let i = 4; i <= maxPlanets; i++) {
			options.push({ value: i, label: i.toString() });
		}
		return options;
	}

	// Turn time limit options
	const turnTimeLimitOptions = [
		{ value: 0, label: 'None' },
		{ value: 30, label: '30 Seconds' },
		{ value: 60, label: '1 Minute' },
		{ value: 120, label: '2 Minutes' },
		{ value: 180, label: '3 Minutes' },
		{ value: 300, label: '5 Minutes' }
	];

	// Player type options
	const playerTypeOptions = [
		{ value: -2, label: 'Closed' },
		{ value: -1, label: 'Open' },
		{ value: 0, label: 'Human', disabled: true }, // Will be set dynamically for human players
		{ value: 1, label: 'Easy Computer' },
		{ value: 2, label: 'Normal Computer' },
		{ value: 3, label: 'Hard Computer' },
		{ value: 4, label: 'Expert Computer' }
	];

	// Update planets per system when galaxy size changes
	$: {
		const maxPlanets = formData.galaxySize === 1 ? 6 : 8;
		if (formData.planetsPerSystem > maxPlanets) {
			formData.planetsPerSystem = maxPlanets;
			handleOptionChange();
		}
	}

	// Update player visibility based on systems count
	$: {
		updatePlayerVisibility(formData.systemsToGenerate);
	}

	function updatePlayerVisibility(systemsCount: number) {
		// Show/hide player panels based on systems count
		if (systemsCount < 3) {
			formData.opponentOptions[1].type = -2; // Close Player 3
		}
		if (systemsCount < 4) {
			formData.opponentOptions[2].type = -2; // Close Player 4
		}
	}

	function handleOptionChange() {
		if (isHost) {
			// Send CHANGE_GAME_OPTIONS message
			webSocketService.changeGameOptions(gameId, formData);
		}
	}

	function handleStartGame() {
		if (isHost) {
			dispatch('startGame');
		}
	}

	function handleBackToLobby() {
		dispatch('backToLobby');
	}

	function getPlayerTypeName(type: number, playerName: string = ''): string {
		if (type === 0) return playerName || 'Human';
		const option = playerTypeOptions.find(opt => opt.value === type);
		return option ? option.label : 'Unknown';
	}
</script>

<div class="game-options-container">
	<div class="game-options-header">
		<Text size="xl" weight="bold">New Skirmish Game</Text>
		<Text>Please enter your name and choose the desired game settings.</Text>
	</div>

	<div class="game-options-content">
		<!-- Left Panel: Players -->
		<div class="players-panel">
			<div class="form-group">
				<label for="gameName">Game Name:</label>
				<input
					id="gameName"
					type="text"
					bind:value={formData.name}
					on:input={handleOptionChange}
					disabled={!isHost}
					maxlength="50"
				/>
			</div>

			<div class="form-group">
				<label for="playerName">Your Name:</label>
				<input
					id="playerName"
					type="text"
					bind:value={formData.playerName}
					on:input={handleOptionChange}
					disabled={!isHost}
					maxlength="20"
				/>
			</div>

			<div class="form-group">
				<label>Player 1:</label>
				<span class="player-name">You</span>
			</div>

			<div class="form-group">
				<label>Player 2:</label>
				<span class="player-name">{getPlayerTypeName(formData.opponentOptions[0]?.type, formData.opponentOptions[0]?.name)}</span>
				{#if isHost}
					<select bind:value={formData.opponentOptions[0].type} on:change={handleOptionChange}>
						{#each playerTypeOptions as option}
							<option value={option.value} disabled={option.disabled}>{option.label}</option>
						{/each}
					</select>
				{/if}
			</div>

			{#if formData.systemsToGenerate >= 3}
				<div class="form-group">
					<label>Player 3:</label>
					<span class="player-name">{getPlayerTypeName(formData.opponentOptions[1]?.type, formData.opponentOptions[1]?.name)}</span>
					{#if isHost}
						<select bind:value={formData.opponentOptions[1].type} on:change={handleOptionChange}>
							{#each playerTypeOptions as option}
								<option value={option.value} disabled={option.disabled}>{option.label}</option>
							{/each}
						</select>
					{/if}
				</div>
			{/if}

			{#if formData.systemsToGenerate >= 4}
				<div class="form-group">
					<label>Player 4:</label>
					<span class="player-name">{getPlayerTypeName(formData.opponentOptions[2]?.type, formData.opponentOptions[2]?.name)}</span>
					{#if isHost}
						<select bind:value={formData.opponentOptions[2].type} on:change={handleOptionChange}>
							{#each playerTypeOptions as option}
								<option value={option.value} disabled={option.disabled}>{option.label}</option>
							{/each}
						</select>
					{/if}
				</div>
			{/if}
		</div>

		<!-- Right Panel: Game Settings -->
		<div class="settings-panel">
			<div class="settings-left">
				<div class="form-group">
					<label for="turnTimeLimit">Turn Time Limit:</label>
					<select id="turnTimeLimit" bind:value={formData.turnTimeLimitSeconds} on:change={handleOptionChange} disabled={!isHost}>
						{#each turnTimeLimitOptions as option}
							<option value={option.value}>{option.label}</option>
						{/each}
					</select>
				</div>

				<div class="form-group">
					<label for="galaxySize">Galaxy Size:</label>
					<select id="galaxySize" bind:value={formData.galaxySize} on:change={handleOptionChange} disabled={!isHost}>
						{#each galaxySizeOptions as option}
							<option value={option.value}>{option.label}</option>
						{/each}
					</select>
				</div>

				<div class="form-group">
					<label for="systemsToGenerate">Number of Systems:</label>
					<select id="systemsToGenerate" bind:value={formData.systemsToGenerate} on:change={handleOptionChange} disabled={!isHost}>
						{#each systemsOptions as option}
							<option value={option.value}>{option.label}</option>
						{/each}
					</select>
				</div>

				<div class="form-group">
					<label for="planetsPerSystem">Planets Per System:</label>
					<select id="planetsPerSystem" bind:value={formData.planetsPerSystem} on:change={handleOptionChange} disabled={!isHost}>
						{#each planetsPerSystemOptions as option}
							<option value={option.value}>{option.label}</option>
						{/each}
					</select>
				</div>

				<div class="form-group">
					<label>
						<input
							type="checkbox"
							bind:checked={formData.distributePlanetsEvenly}
							on:change={handleOptionChange}
							disabled={!isHost}
						/>
						Distribute Planets Evenly
					</label>
				</div>

				<div class="form-group">
					<label>
						<input
							type="checkbox"
							bind:checked={formData.quickStart}
							on:change={handleOptionChange}
							disabled={!isHost}
						/>
						Quick Start
					</label>
				</div>
			</div>

			<div class="settings-right">
				<!-- Starfield Canvas Placeholder -->
				<div class="starfield-canvas">
					<canvas width="200" height="170" style="background-color: #000;"></canvas>
				</div>
			</div>
		</div>
	</div>

	<div class="game-options-footer">
		<Button onclick={handleBackToLobby} label="Back to Lobby" size="md" variant="secondary" />
		{#if isHost}
			<Button onclick={handleStartGame} label="Start Game" size="md" variant="primary" />
		{:else}
			<Text>Waiting for host to start the game...</Text>
		{/if}
	</div>
</div>

<style>
	.game-options-container {
		position: absolute;
		width: 640px;
		height: 500px;
		left: 50%;
		top: 50%;
		transform: translate(-50%, -50%);
		color: white;
		font-size: 12px;
		background-color: rgba(128, 128, 128, 0.9);
		border: 2px solid #666;
		border-radius: 8px;
		z-index: 103;
		padding: 20px;
		display: flex;
		flex-direction: column;
	}

	.game-options-header {
		text-align: center;
		margin-bottom: 20px;
	}

	.game-options-content {
		display: flex;
		flex: 1;
		gap: 20px;
	}

	.players-panel {
		flex: 1;
		min-width: 250px;
	}

	.settings-panel {
		flex: 1;
		display: flex;
		gap: 20px;
	}

	.settings-left {
		flex: 1;
	}

	.settings-right {
		width: 200px;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.form-group {
		margin-bottom: 15px;
		display: flex;
		align-items: center;
		gap: 10px;
	}

	.form-group label {
		min-width: 80px;
		font-weight: bold;
	}

	.form-group input,
	.form-group select {
		padding: 4px 8px;
		border: 1px solid #ccc;
		border-radius: 4px;
		background: white;
		color: black;
		font-size: 12px;
	}

	.form-group input[type="text"] {
		width: 147px;
	}

	.form-group select {
		min-width: 120px;
	}

	.form-group input[type="checkbox"] {
		width: auto;
		margin-right: 8px;
	}

	.player-name {
		min-width: 100px;
		font-weight: bold;
	}

	.starfield-canvas {
		border: 1px solid #666;
		border-radius: 4px;
	}

	.game-options-footer {
		display: flex;
		justify-content: center;
		gap: 20px;
		align-items: center;
		padding-top: 20px;
		border-top: 1px solid #666;
		margin-top: 20px;
	}

	input:disabled,
	select:disabled {
		background: #f5f5f5;
		color: #666;
		cursor: not-allowed;
	}
</style>
