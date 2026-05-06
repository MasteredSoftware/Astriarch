<script lang="ts">
	export let onclick: (() => void) | undefined = undefined;
	export let disabled: boolean = false;
	export let title: string = '';

	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	type $$Props = {
		onclick?: () => void;
		disabled?: boolean;
		title?: string;
		class?: string;
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		[key: string]: any;
	};

	function handleClick() {
		if (!disabled && onclick) {
			onclick();
		}
	}
</script>

<div class="relative h-12 w-8 {$$props.class || ''}" {...$$restProps}>
	<!-- Button Content -->
	<button
		class="relative z-10 flex h-full w-full items-center justify-center transition-colors hover:bg-cyan-500/10 disabled:cursor-not-allowed disabled:opacity-50"
		on:click={handleClick}
		{disabled}
		{title}
		type="button"
	>
		<!-- Icon Slot -->
		<div class="flex h-6 w-6 items-center justify-center">
			<slot />
		</div>
	</button>
</div>
