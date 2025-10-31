<script lang="ts">
	import Dialog from '$lib/components/astriarch/dialog/Dialog.svelte';

	export let onExitToMainMenu: () => void = () => {};
	export let onResignCommand: () => void = () => {};
	export let onCancel: () => void = () => {};

	let open = true;

	function handleExitToMainMenu() {
		open = false;
		onExitToMainMenu();
	}

	function handleResignCommand() {
		open = false;
		onResignCommand();
	}

	function handleCancel() {
		open = false;
		onCancel();
	}
</script>

<Dialog
	bind:open
	title="EXIT GAME"
	size="small"
	variant="warning"
	showCloseButton={true}
	onCancel={handleCancel}
	cancelButtonText="Cancel"
>
	<!-- Exit Game Options -->
	<div class="space-y-4">
		<!-- Instructions -->
		<div class="text-center">
			<p class="font-orbitron text-base tracking-wide text-white/90">
				Choose how you'd like to exit:
			</p>
		</div>

		<!-- Exit Options -->
		<div class="space-y-3">
			<!-- Exit to Main Menu -->
			<button
				onclick={handleExitToMainMenu}
				class="font-orbitron w-full rounded border-2 border-cyan-500/50 bg-gradient-to-r from-slate-800 to-slate-700 px-4 py-3 text-sm font-bold tracking-wider text-white transition-all hover:border-cyan-400 hover:from-slate-700 hover:to-slate-600 hover:shadow-lg hover:shadow-cyan-500/25"
			>
				<div class="flex flex-col items-center gap-1">
					<span class="text-base">Exit to Main Menu</span>
					<span class="text-xs text-white/60">Return to lobby (game continues)</span>
				</div>
			</button>

			<!-- Resign Command -->
			<button
				onclick={handleResignCommand}
				class="font-orbitron w-full rounded border-2 border-red-500/50 bg-gradient-to-r from-slate-800 to-slate-700 px-4 py-3 text-sm font-bold tracking-wider text-white transition-all hover:border-red-400 hover:from-slate-700 hover:to-slate-600 hover:shadow-lg hover:shadow-red-500/25"
			>
				<div class="flex flex-col items-center gap-1">
					<span class="text-base">Resign Command</span>
					<span class="text-xs text-white/60">Quit game and forfeit</span>
				</div>
			</button>
		</div>

		<!-- Warning Message -->
		<div class="rounded border border-yellow-500/30 bg-yellow-900/20 p-3 text-center">
			<p class="font-orbitron text-xs tracking-wide text-yellow-300">
				⚠️ Resigning will end your participation in the game
			</p>
		</div>
	</div>
</Dialog>

<style>
	:global(.font-orbitron) {
		font-family: 'Orbitron', monospace;
	}
</style>
