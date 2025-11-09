<script lang="ts">
	import {
		multiplayerGameStore,
		type PlayerEliminatedModalState
	} from '$lib/stores/multiplayerGameStore';
	import Dialog from '$lib/components/astriarch/dialog/Dialog.svelte';

	export let modalState: PlayerEliminatedModalState;
	export let onClose: () => void = () => {};

	let open = true;

	$: title = modalState.reason === 'resigned' ? 'PLAYER RESIGNED' : 'PLAYER DESTROYED';
	$: description =
		modalState.reason === 'resigned' ? 'has resigned from the game' : 'has been destroyed';

	function handleClose() {
		open = false;
		onClose();
		multiplayerGameStore.setPlayerEliminatedModal(null);
	}
</script>

<Dialog
	bind:open
	{title}
	cancelButtonText="Continue"
	onCancel={handleClose}
	size="small"
	variant="warning"
	style="svg"
	showCloseButton={false}
>
	<div class="space-y-4">
		<div class="text-center">
			<p class="font-orbitron text-lg font-bold tracking-wide text-orange-400">
				<span class="text-white">{modalState.playerName}</span>
				{description}
			</p>
		</div>

		<div class="rounded border border-orange-500/30 bg-orange-900/20 p-4">
			<p class="font-orbitron text-center text-sm tracking-wide text-orange-200">
				The game continues for the remaining players.
			</p>
		</div>
	</div>
</Dialog>

<style>
	:global(.font-orbitron) {
		font-family: 'Orbitron', monospace;
	}
</style>
