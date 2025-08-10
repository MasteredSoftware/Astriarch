<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { Text, Button } from '$lib/components/astriarch';

	export interface GameOptions {
		name: string;
		description: string;
		galaxySize: 'Small' | 'Medium' | 'Large';
		gameSpeed: 'Slow' | 'Normal' | 'Fast';
		maxPlayers: number;
		victoryCondition: 'Conquest' | 'Economic' | 'Diplomatic';
		isPrivate: boolean;
		password?: string;
	}

	const dispatch = createEventDispatcher<{
		createGame: GameOptions;
		cancel: void;
	}>();

	let formData: GameOptions = {
		name: '',
		description: '',
		galaxySize: 'Medium',
		gameSpeed: 'Normal',
		maxPlayers: 4,
		victoryCondition: 'Conquest',
		isPrivate: false,
		password: ''
	};

	let isSubmitting = false;
	let errors: Partial<Record<keyof GameOptions, string>> = {};

	function validateForm(): boolean {
		errors = {};

		if (!formData.name.trim()) {
			errors.name = 'Game name is required';
		}

		if (formData.name.length > 50) {
			errors.name = 'Game name must be 50 characters or less';
		}

		if (formData.description.length > 200) {
			errors.description = 'Description must be 200 characters or less';
		}

		if (formData.maxPlayers < 2 || formData.maxPlayers > 8) {
			errors.maxPlayers = 'Max players must be between 2 and 8';
		}

		if (formData.isPrivate && !formData.password?.trim()) {
			errors.password = 'Password is required for private games';
		}

		return Object.keys(errors).length === 0;
	}

	async function handleSubmit() {
		if (!validateForm()) return;

		isSubmitting = true;
		
		try {
			const gameOptions = { ...formData };
			if (!gameOptions.isPrivate) {
				delete gameOptions.password;
			}
			
			dispatch('createGame', gameOptions);
		} catch (error) {
			console.error('Error creating game:', error);
		} finally {
			isSubmitting = false;
		}
	}

	function handleCancel() {
		dispatch('cancel');
	}
</script>

<div class="create-game-form">
	<div class="form-header">
		<Text style="font-size: 20px; color: #FFFFFF; font-weight: 700;">
			Create New Game
		</Text>
		<Text style="font-size: 14px; color: #94A3B8; margin-top: 0.25rem;">
			Set up your galactic empire
		</Text>
	</div>

	<form on:submit|preventDefault={handleSubmit}>
		<!-- Game Name -->
		<div class="form-group">
			<label for="gameName" class="form-label">
				<Text style="font-size: 14px; color: #FFFFFF; font-weight: 600;">
					Game Name *
				</Text>
			</label>
			<input
				id="gameName"
				type="text"
				bind:value={formData.name}
				placeholder="Enter game name"
				class="form-input {errors.name ? 'error' : ''}"
				maxlength="50"
				on:keydown={(e) => e.key === 'Enter' && handleSubmit()}
			/>
			{#if errors.name}
				<Text style="font-size: 12px; color: #EF4444; margin-top: 0.25rem;">
					{errors.name}
				</Text>
			{/if}
		</div>

		<!-- Description -->
		<div class="form-group">
			<label for="gameDescription" class="form-label">
				<Text style="font-size: 14px; color: #FFFFFF; font-weight: 600;">
					Description
				</Text>
			</label>
			<textarea
				id="gameDescription"
				bind:value={formData.description}
				placeholder="Optional game description"
				class="form-textarea {errors.description ? 'error' : ''}"
				maxlength="200"
				rows="3"
			></textarea>
			{#if errors.description}
				<Text style="font-size: 12px; color: #EF4444; margin-top: 0.25rem;">
					{errors.description}
				</Text>
			{/if}
		</div>

		<!-- Game Settings Grid -->
		<div class="settings-grid">
			<!-- Galaxy Size -->
			<div class="form-group">
				<label for="galaxySize" class="form-label">
					<Text style="font-size: 14px; color: #FFFFFF; font-weight: 600;">
						Galaxy Size
					</Text>
				</label>
				<select id="galaxySize" bind:value={formData.galaxySize} class="form-select">
					<option value="Small">Small (Fast games)</option>
					<option value="Medium">Medium (Balanced)</option>
					<option value="Large">Large (Epic games)</option>
				</select>
			</div>

			<!-- Game Speed -->
			<div class="form-group">
				<label for="gameSpeed" class="form-label">
					<Text style="font-size: 14px; color: #FFFFFF; font-weight: 600;">
						Game Speed
					</Text>
				</label>
				<select id="gameSpeed" bind:value={formData.gameSpeed} class="form-select">
					<option value="Slow">Slow (Tactical)</option>
					<option value="Normal">Normal (Standard)</option>
					<option value="Fast">Fast (Quick games)</option>
				</select>
			</div>

			<!-- Max Players -->
			<div class="form-group">
				<label for="maxPlayers" class="form-label">
					<Text style="font-size: 14px; color: #FFFFFF; font-weight: 600;">
						Max Players
					</Text>
				</label>
				<input
					id="maxPlayers"
					type="number"
					bind:value={formData.maxPlayers}
					min="2"
					max="8"
					class="form-input {errors.maxPlayers ? 'error' : ''}"
				/>
				{#if errors.maxPlayers}
					<Text style="font-size: 12px; color: #EF4444; margin-top: 0.25rem;">
						{errors.maxPlayers}
					</Text>
				{/if}
			</div>

			<!-- Victory Condition -->
			<div class="form-group">
				<label for="victoryCondition" class="form-label">
					<Text style="font-size: 14px; color: #FFFFFF; font-weight: 600;">
						Victory Condition
					</Text>
				</label>
				<select id="victoryCondition" bind:value={formData.victoryCondition} class="form-select">
					<option value="Conquest">Conquest (Destroy enemies)</option>
					<option value="Economic">Economic (Trade dominance)</option>
					<option value="Diplomatic">Diplomatic (Alliance victory)</option>
				</select>
			</div>
		</div>

		<!-- Privacy Settings -->
		<div class="form-group">
			<div class="checkbox-group">
				<input
					id="isPrivate"
					type="checkbox"
					bind:checked={formData.isPrivate}
					class="form-checkbox"
				/>
				<label for="isPrivate" class="checkbox-label">
					<Text style="font-size: 14px; color: #FFFFFF;">
						Private Game (Requires password)
					</Text>
				</label>
			</div>
		</div>

		<!-- Password (if private) -->
		{#if formData.isPrivate}
			<div class="form-group">
				<label for="password" class="form-label">
					<Text style="font-size: 14px; color: #FFFFFF; font-weight: 600;">
						Password *
					</Text>
				</label>
				<input
					id="password"
					type="password"
					bind:value={formData.password}
					placeholder="Enter game password"
					class="form-input {errors.password ? 'error' : ''}"
				/>
				{#if errors.password}
					<Text style="font-size: 12px; color: #EF4444; margin-top: 0.25rem;">
						{errors.password}
					</Text>
				{/if}
			</div>
		{/if}

		<!-- Form Actions -->
		<div class="form-actions">
			<Button
				label="Cancel"
				size="md"
				variant="outline"
				onclick={handleCancel}
				disabled={isSubmitting}
			/>
			<Button
				label={isSubmitting ? 'Creating...' : 'Create Game'}
				size="md"
				variant="primary"
				onclick={handleSubmit}
				disabled={isSubmitting}
			/>
		</div>
	</form>
</div>

<style>
	.create-game-form {
		max-width: 500px;
		width: 100%;
	}

	.form-header {
		margin-bottom: 2rem;
		text-align: center;
	}

	.form-group {
		margin-bottom: 1.5rem;
	}

	.form-label {
		display: block;
		margin-bottom: 0.5rem;
	}

	.form-input,
	.form-textarea,
	.form-select {
		width: 100%;
		padding: 0.75rem;
		border: 1px solid rgba(0, 255, 255, 0.3);
		border-radius: 6px;
		background: rgba(0, 0, 0, 0.4);
		color: #FFFFFF;
		font-size: 14px;
		transition: border-color 0.2s ease;
	}

	.form-input:focus,
	.form-textarea:focus,
	.form-select:focus {
		outline: none;
		border-color: #00FFFF;
		box-shadow: 0 0 0 2px rgba(0, 255, 255, 0.2);
	}

	.form-input.error,
	.form-textarea.error {
		border-color: #EF4444;
	}

	.form-textarea {
		resize: vertical;
		min-height: 60px;
	}

	.form-select {
		cursor: pointer;
	}

	.settings-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1rem;
		margin-bottom: 1.5rem;
	}

	.checkbox-group {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.form-checkbox {
		width: 16px;
		height: 16px;
		accent-color: #00FFFF;
	}

	.checkbox-label {
		cursor: pointer;
	}

	.form-actions {
		display: flex;
		gap: 1rem;
		margin-top: 2rem;
		justify-content: center;
		align-items: center;
	}

	/* Responsive adjustments */
	@media (max-width: 640px) {
		.settings-grid {
			grid-template-columns: 1fr;
		}
		
		.form-actions {
			flex-direction: column;
		}
	}
</style>
