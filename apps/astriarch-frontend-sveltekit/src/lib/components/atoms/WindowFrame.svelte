<script lang="ts">
	import Background from './window-frame/Background.svelte';
	import Stroke1 from './window-frame/Stroke1.svelte';
	import Stroke2 from './window-frame/Stroke2.svelte';
	import Stroke3 from './window-frame/Stroke3.svelte';

	export let className: string = '';
	export let showLogo: boolean = true;
	export let version: string = 'v2.0';
	export let strokeColor: string = 'var(--astriarch-primary)';
	export let useFallback: boolean = false; // Use CSS fallback instead of SVG components

	// Logo asset
	const logoSrc = 'logo/astriarch-logo.png';
</script>

<div class="relative h-full w-full {className}" role="presentation" aria-label="Window Frame">
	{#if useFallback}
		<!-- CSS Fallback Mode - Styled with design system -->
		<div
			class="bg-astriarch-ui-dark-blue border-astriarch-ui-light-grey/30 absolute inset-0 rounded-lg border-2"
		></div>
		<div class="border-astriarch-primary/50 absolute inset-1 rounded border"></div>
		<div class="border-astriarch-ui-light-grey/20 absolute inset-2 rounded border"></div>

		<!-- Content Slot Area -->
		<div class="absolute inset-[12px] overflow-hidden">
			<slot />
		</div>
	{:else}
		<!-- SVG Component Mode - Uses Svelte components with design system integration -->

		<!-- Background Layer -->
		<div class="absolute inset-0">
			<Background />
		</div>

		<!-- Content Slot Area -->
		<div class="absolute inset-[5.73%_2.894%_5.819%_2.894%] overflow-hidden">
			<slot />
		</div>

		<!-- Stroke Layers (from outermost to innermost) -->

		<!-- Stroke 3 (Outermost) -->
		<div class="absolute inset-[5.73%_2.894%_5.819%_2.894%]">
			<div class="absolute inset-[-3.239%_-2.211%_-4.049%_-2.211%]">
				<Stroke3 {strokeColor} />
			</div>
		</div>

		<!-- Stroke 2 (Middle) -->
		<div class="absolute inset-[5.73%_2.894%_5.819%_2.894%]">
			<div class="absolute inset-[-1.619%_-1.228%_-2.429%_-1.228%]">
				<Stroke2 {strokeColor} />
			</div>
		</div>

		<!-- Stroke 1 (Innermost) -->
		<div class="absolute inset-[5.73%_2.894%_5.819%_2.894%]">
			<div class="absolute inset-[0_-0.246%_-0.81%_-0.246%]">
				<Stroke1 {strokeColor} />
			</div>
		</div>
	{/if}

	<!-- Logo Area (Bottom Left) -->
	{#if showLogo}
		<div class="absolute bottom-[2.865%] left-[1.852%] h-6 w-32">
			<!-- Logo Image -->
			<div class="absolute inset-0 opacity-40">
				<img src={logoSrc} alt="Astriarch" class="h-full w-full object-contain object-left" />
			</div>

			<!-- Version Text -->
			<div class="absolute top-1 right-0 bottom-0 left-20">
				<p
					class="text-astriarch-caption-10 text-astriarch-ui-light-grey font-mono leading-none opacity-40"
				>
					{version}
				</p>
			</div>
		</div>
	{/if}
</div>
