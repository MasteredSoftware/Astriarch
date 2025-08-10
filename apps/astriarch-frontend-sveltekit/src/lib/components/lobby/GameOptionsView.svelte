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
			{ name: '', type: -2 } // Player 4: Closed
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
		const option = playerTypeOptions.find((opt) => opt.value === type);
		return option ? option.label : 'Unknown';
	}
</script>

<div class="game-options-container">
	<div class="scrollable-content">
		<div class="content-wrapper">
			<div class="form-header">
				<Text style="font-size: 24px; color: #FFFFFF; font-weight: 700;">
					New Skirmish Game
				</Text>
				<Text style="font-size: 16px; color: #94A3B8; margin-top: 0.5rem;">
					Please enter your name and choose the desired game settings.
				</Text>
			</div>

			<div class="game-options-content">
		<!-- Left Panel: Players -->
		<div class="players-panel">
			<div class="form-group">
				<label for="gameName" class="form-label">
					<Text style="font-size: 14px; color: #FFFFFF; font-weight: 600;">Game Name:</Text>
				</label>
				<input
					id="gameName"
					type="text"
					bind:value={formData.name}
					on:input={handleOptionChange}
					disabled={!isHost}
					maxlength="50"
					class="form-input"
				/>
			</div>

			<div class="form-group">
				<label for="playerName" class="form-label">
					<Text style="font-size: 14px; color: #FFFFFF; font-weight: 600;">Your Name:</Text>
				</label>
				<input
					id="playerName"
					type="text"
					bind:value={formData.playerName}
					on:input={handleOptionChange}
					disabled={!isHost}
					maxlength="20"
					class="form-input"
				/>
			</div>

			<div class="form-group">
				<label class="form-label">
					<Text style="font-size: 14px; color: #FFFFFF; font-weight: 600;">Player 1:</Text>
				</label>
				<span class="player-name">You</span>
			</div>

			<div class="form-group">
				<label class="form-label">
					<Text style="font-size: 14px; color: #FFFFFF; font-weight: 600;">Player 2:</Text>
				</label>
				<div class="player-row">
					<span class="player-name"
						>{getPlayerTypeName(
							formData.opponentOptions[0]?.type,
							formData.opponentOptions[0]?.name
						)}</span
					>
					{#if isHost}
						<select
							bind:value={formData.opponentOptions[0].type}
							on:change={handleOptionChange}
							class="form-select"
						>
							{#each playerTypeOptions as option}
								<option value={option.value} disabled={option.disabled}>{option.label}</option>
							{/each}
						</select>
					{/if}
				</div>
			</div>

			{#if formData.systemsToGenerate >= 3}
				<div class="form-group">
					<label class="form-label">
						<Text style="font-size: 14px; color: #FFFFFF; font-weight: 600;">Player 3:</Text>
					</label>
					<div class="player-row">
						<span class="player-name"
							>{getPlayerTypeName(
								formData.opponentOptions[1]?.type,
								formData.opponentOptions[1]?.name
							)}</span
						>
						{#if isHost}
							<select
								bind:value={formData.opponentOptions[1].type}
								on:change={handleOptionChange}
								class="form-select"
							>
								{#each playerTypeOptions as option}
									<option value={option.value} disabled={option.disabled}>{option.label}</option>
								{/each}
							</select>
						{/if}
					</div>
				</div>
			{/if}

			{#if formData.systemsToGenerate >= 4}
				<div class="form-group">
					<label class="form-label">
						<Text style="font-size: 14px; color: #FFFFFF; font-weight: 600;">Player 4:</Text>
					</label>
					<div class="player-row">
						<span class="player-name"
							>{getPlayerTypeName(
								formData.opponentOptions[2]?.type,
								formData.opponentOptions[2]?.name
							)}</span
						>
						{#if isHost}
							<select
								bind:value={formData.opponentOptions[2].type}
								on:change={handleOptionChange}
								class="form-select"
							>
								{#each playerTypeOptions as option}
									<option value={option.value} disabled={option.disabled}>{option.label}</option>
								{/each}
							</select>
						{/if}
					</div>
				</div>
			{/if}
		</div>

		<!-- Right Panel: Game Settings -->
		<div class="settings-panel">
			<div class="settings-left">
				<div class="form-group">
					<label for="turnTimeLimit" class="form-label">
						<Text style="font-size: 14px; color: #FFFFFF; font-weight: 600;">Turn Time Limit:</Text>
					</label>
					<select
						id="turnTimeLimit"
						bind:value={formData.turnTimeLimitSeconds}
						on:change={handleOptionChange}
						disabled={!isHost}
						class="form-select"
					>
						{#each turnTimeLimitOptions as option}
							<option value={option.value}>{option.label}</option>
						{/each}
					</select>
				</div>

				<div class="form-group">
					<label for="galaxySize" class="form-label">
						<Text style="font-size: 14px; color: #FFFFFF; font-weight: 600;">Galaxy Size:</Text>
					</label>
					<select
						id="galaxySize"
						bind:value={formData.galaxySize}
						on:change={handleOptionChange}
						disabled={!isHost}
						class="form-select"
					>
						{#each galaxySizeOptions as option}
							<option value={option.value}>{option.label}</option>
						{/each}
					</select>
				</div>

				<div class="form-group">
					<label for="systemsToGenerate" class="form-label">
						<Text style="font-size: 14px; color: #FFFFFF; font-weight: 600;">
							Number of Systems:
						</Text>
					</label>
					<select
						id="systemsToGenerate"
						bind:value={formData.systemsToGenerate}
						on:change={handleOptionChange}
						disabled={!isHost}
						class="form-select"
					>
						{#each systemsOptions as option}
							<option value={option.value}>{option.label}</option>
						{/each}
					</select>
				</div>

				<div class="form-group">
					<label for="planetsPerSystem" class="form-label">
						<Text style="font-size: 14px; color: #FFFFFF; font-weight: 600;">
							Planets Per System:
						</Text>
					</label>
					<select
						id="planetsPerSystem"
						bind:value={formData.planetsPerSystem}
						on:change={handleOptionChange}
						disabled={!isHost}
						class="form-select"
					>
						{#each planetsPerSystemOptions as option}
							<option value={option.value}>{option.label}</option>
						{/each}
					</select>
				</div>

				<div class="form-group">
					<div class="checkbox-group">
						<input
							type="checkbox"
							bind:checked={formData.distributePlanetsEvenly}
							on:change={handleOptionChange}
							disabled={!isHost}
							class="form-checkbox"
							id="distributePlanets"
						/>
						<label for="distributePlanets" class="checkbox-label">
							<Text style="font-size: 14px; color: #FFFFFF;">Distribute Planets Evenly</Text>
						</label>
					</div>
				</div>

				<div class="form-group">
					<div class="checkbox-group">
						<input
							type="checkbox"
							bind:checked={formData.quickStart}
							on:change={handleOptionChange}
							disabled={!isHost}
							class="form-checkbox"
							id="quickStart"
						/>
						<label for="quickStart" class="checkbox-label">
							<Text style="font-size: 14px; color: #FFFFFF;">Quick Start</Text>
						</label>
					</div>
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

		<div class="form-actions">
			<Button onclick={handleBackToLobby} label="Back to Lobby" size="md" variant="outline" />
			{#if isHost}
				<Button onclick={handleStartGame} label="Start Game" size="md" variant="primary" />
			{:else}
				<Text style="font-size: 14px; color: #94A3B8;">Waiting for host to start the game...</Text>
			{/if}
		</div>
	</div>
	</div>
</div>

<style>
	.game-options-container {
		width: 100%;
		height: 100vh;
		color: white;
		display: flex;
		flex-direction: column;
		overflow-y: auto;
		box-sizing: border-box;
		padding: 1rem;
	}

	.scrollable-content {
		flex: 1;
		overflow-y: auto;
		padding-right: 0.5rem; /* Space for scrollbar */
	}

	.content-wrapper {
		display: flex;
		flex-direction: column;
		align-items: center;
		max-width: 1200px;
		margin: 0 auto;
		padding: 1rem;
	}

	.form-header {
		text-align: center;
		margin-bottom: 2rem;
		margin-top: 2rem;
	}

	.game-options-content {
		display: flex;
		gap: 2rem;
		max-width: 1200px;
		width: 100%;
		background: rgba(0, 0, 0, 0.4);
		backdrop-filter: blur(10px);
		border: 1px solid rgba(0, 255, 255, 0.3);
		border-radius: 12px;
		padding: 2rem;
		margin-bottom: 2rem;
	}

	.players-panel {
		flex: 1;
		min-width: 300px;
	}

	.settings-panel {
		flex: 1;
		display: flex;
		gap: 2rem;
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
		margin-bottom: 1.5rem;
	}

	.form-label {
		display: block;
		margin-bottom: 0.5rem;
	}

	.form-input,
	.form-select {
		width: 100%;
		padding: 0.75rem;
		border: 1px solid rgba(0, 255, 255, 0.3);
		border-radius: 6px;
		background: rgba(0, 0, 0, 0.4);
		color: #ffffff;
		font-size: 14px;
		transition: border-color 0.2s ease;
	}

	.form-input:focus,
	.form-select:focus {
		outline: none;
		border-color: #00ffff;
		box-shadow: 0 0 0 2px rgba(0, 255, 255, 0.2);
	}

	.form-select {
		cursor: pointer;
	}

	.player-row {
		display: flex;
		align-items: center;
		gap: 1rem;
	}

	.player-name {
		min-width: 120px;
		font-weight: bold;
		color: #00ffff;
	}

	.checkbox-group {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.form-checkbox {
		width: 16px;
		height: 16px;
		accent-color: #00ffff;
	}

	.checkbox-label {
		cursor: pointer;
	}

	.starfield-canvas {
		border: 1px solid rgba(0, 255, 255, 0.3);
		border-radius: 6px;
		overflow: hidden;
	}

	.form-actions {
		display: flex;
		gap: 1rem;
		justify-content: center;
		align-items: center;
		max-width: 1200px;
		width: 100%;
		padding: 1rem;
		margin-top: 1rem;
		background: rgba(0, 0, 0, 0.3);
		border-radius: 8px;
		border: 1px solid rgba(0, 255, 255, 0.2);
	}

	input:disabled,
	select:disabled {
		background: rgba(0, 0, 0, 0.6);
		color: #888;
		cursor: not-allowed;
		border-color: rgba(255, 255, 255, 0.1);
	}

	/* Responsive Design */
	@media (max-width: 768px) {
		.game-options-content {
			flex-direction: column;
		}

		.settings-panel {
			flex-direction: column;
		}

		.settings-right {
			width: 100%;
		}

		.form-actions {
			flex-direction: column;
		}
	}
</style>
