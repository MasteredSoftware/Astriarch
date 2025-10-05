<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import * as Dialog from '$lib/components/ui/dialog';
	import { Button as AstriarchButton } from '$lib/components/astriarch';

	interface Props {
		title?: string;
		cancelButtonText?: string;
		saveButtonText?: string;
		open?: boolean;
		onCancel?: () => void;
		onSave?: () => void;
		children?: any;
		size?: 'small' | 'large';
		variant?: 'info' | 'warning' | 'success' | 'error';
		style?: 'default' | 'svg';
	}

	let {
		title = 'Dialog Title',
		cancelButtonText = 'Cancel',
		saveButtonText = 'Save',
		open = false,
		onCancel,
		onSave,
		children,
		size = 'small',
		variant = 'info',
		style = 'default',
		...restProps
	}: Props = $props();

	// Determine modal dimensions based on size and style
	const modalClasses =
		style === 'svg'
			? size === 'large'
				? 'w-[500px] h-[480px]'
				: 'w-[400px] h-[380px]'
			: size === 'large'
				? 'sm:max-w-[500px] max-h-[480px]'
				: 'sm:max-w-[400px] max-h-[380px]';

	// Variant-based styling
	const getVariantColors = (variant: string) => {
		switch (variant) {
			case 'success':
				return {
					titleColor: 'text-green-400',
					accent: 'border-green-500/30'
				};
			case 'warning':
				return {
					titleColor: 'text-yellow-400',
					accent: 'border-yellow-500/30'
				};
			case 'error':
				return {
					titleColor: 'text-red-400',
					accent: 'border-red-500/30'
				};
			default:
				return {
					titleColor: 'text-cyan-400',
					accent: 'border-cyan-500/30'
				};
		}
	};

	const colors = getVariantColors(variant);
</script>

<Dialog.Root bind:open>
	<Dialog.Content class="astriarch-modal {modalClasses} border-none bg-transparent p-0 shadow-none">
		{#if style === 'svg'}
			<!-- SVG Background Modal (Exact Figma Design) -->
			<div
				class="astriarch-modal-svg relative"
				style="width: {size === 'large' ? '500px' : '400px'}; height: {size === 'large'
					? '480px'
					: '380px'};"
			>
				<!-- SVG Background -->
				<div class="absolute inset-0">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="100%"
						height="100%"
						viewBox="0 0 404 384"
						fill="none"
						class="h-full w-full"
						preserveAspectRatio="none"
					>
						<foreignObject x="-10" y="-10" width="424" height="404">
							<div
								xmlns="http://www.w3.org/1999/xhtml"
								style="backdrop-filter:blur(5px);clip-path:url(#bgblur_0_122_19719_clip_path);height:100%;width:100%"
							></div>
						</foreignObject>
						<path
							data-figma-bg-blur-radius="10"
							d="M8 2H396C399.314 2 402 4.68629 402 8V298.913C402 300.403 401.446 301.84 400.445 302.943L368.519 338.156L368.487 338.191L332.38 379.926C331.24 381.243 329.585 382 327.843 382H8C4.68629 382 2 379.314 2 376V8C2 4.68629 4.68629 2 8 2Z"
							fill="url(#paint0_linear_122_19719)"
							fill-opacity="0.8"
							stroke="url(#paint1_linear_122_19719)"
							stroke-width="4"
						/>
						<defs>
							<clipPath id="bgblur_0_122_19719_clip_path" transform="translate(10 10)">
								<path
									d="M8 2H396C399.314 2 402 4.68629 402 8V298.913C402 300.403 401.446 301.84 400.445 302.943L368.519 338.156L368.487 338.191L332.38 379.926C331.24 381.243 329.585 382 327.843 382H8C4.68629 382 2 379.314 2 376V8C2 4.68629 4.68629 2 8 2Z"
								/>
							</clipPath>
							<linearGradient
								id="paint0_linear_122_19719"
								x1="402.254"
								y1="384.954"
								x2="-72.6428"
								y2="141.984"
								gradientUnits="userSpaceOnUse"
							>
								<stop stop-color="#1B1F25" />
								<stop offset="1" stop-color="#313E46" />
							</linearGradient>
							<linearGradient
								id="paint1_linear_122_19719"
								x1="392.427"
								y1="321.231"
								x2="-38.1074"
								y2="63.7095"
								gradientUnits="userSpaceOnUse"
							>
								<stop stop-opacity="0.5" />
								<stop offset="0.807161" stop-color="#00FFFF" />
								<stop offset="1" stop-color="white" />
							</linearGradient>
						</defs>
					</svg>
				</div>

				<!-- Content positioned exactly like Figma -->
				<div class="relative z-10 h-full w-full">
					<Dialog.Header class="sr-only">
						<Dialog.Title>{title}</Dialog.Title>
					</Dialog.Header>
					<Dialog.Description class="sr-only">Dialog content</Dialog.Description>

					<!-- Title positioned at 8.33% from top, 7.92% from sides -->
					<div
						class="font-orbitron absolute text-[38px] leading-[42px] font-bold tracking-[0.76px] text-white"
						style="top: 8.33%; left: 7.92%; right: 7.92%; height: auto;"
					>
						{title}
					</div>

					<!-- Content positioned at 36.46% from top -->
					<div
						class="font-orbitron absolute text-[16px] leading-[24px] font-normal tracking-[0.16px] text-white/75"
						style="left: 7.92%; right: 7.92%; bottom: 32.29%;"
					>
						{@render children?.()}
					</div>

					<!-- Buttons positioned at bottom -->
					<Dialog.Footer
						class="absolute flex gap-4"
						style="bottom: 11.98%; left: 7.92%; right: 7.92%;"
					>
						{#if onCancel}
							<div class="flex-1">
								<AstriarchButton
									label={cancelButtonText}
									size="md"
									variant="outline"
									onclick={onCancel}
									class="w-full"
								/>
							</div>
						{/if}

						{#if onSave}
							<div class="flex-1">
								<AstriarchButton
									label={saveButtonText}
									size="md"
									variant="primary"
									onclick={onSave}
									class="w-full"
								/>
							</div>
						{/if}
					</Dialog.Footer>
				</div>
			</div>
		{:else}
			<!-- Default Style Modal -->
			<div class="astriarch-modal-container relative h-full w-full">
				<!-- Modal Background with space theme -->
				<div
					class="astriarch-modal-bg absolute inset-0 rounded-lg border-2 {colors.accent} bg-gradient-to-br from-slate-900/95 via-slate-800/95 to-black/95 backdrop-blur-sm"
				>
					<!-- Subtle space effect overlay -->
					<div
						class="absolute inset-0 rounded-lg bg-gradient-to-r from-transparent via-cyan-500/5 to-transparent"
					></div>
					<!-- Corner accents -->
					<div class="absolute top-2 left-2 h-3 w-3 border-t-2 border-l-2 {colors.accent}"></div>
					<div class="absolute top-2 right-2 h-3 w-3 border-t-2 border-r-2 {colors.accent}"></div>
					<div class="absolute bottom-2 left-2 h-3 w-3 border-b-2 border-l-2 {colors.accent}"></div>
					<div
						class="absolute right-2 bottom-2 h-3 w-3 border-r-2 border-b-2 {colors.accent}"
					></div>
				</div>

				<!-- Modal Content -->
				<div class="relative z-10 flex h-full flex-col p-8">
					<!-- Header -->
					<Dialog.Header class="mb-6">
						<Dialog.Title
							class="font-orbitron text-3xl font-bold {colors.titleColor} tracking-wider text-shadow-lg"
						>
							{title}
						</Dialog.Title>
					</Dialog.Header>

					<Dialog.Description class="sr-only">Dialog content</Dialog.Description>

					<!-- Content Area -->
					<div class="flex-1 space-y-4 text-white/90">
						{@render children?.()}
					</div>

					<!-- Footer with Astriarch-styled buttons -->
					<Dialog.Footer class="mt-8 flex justify-end gap-4">
						{#if onCancel}
							<Button
								variant="outline"
								onclick={onCancel}
								class="astriarch-btn-secondary font-orbitron border-slate-500 bg-transparent text-sm font-extrabold tracking-widest text-white/80 uppercase hover:bg-white/10 hover:text-white"
							>
								{cancelButtonText}
							</Button>
						{/if}

						{#if onSave}
							<Button
								onclick={onSave}
								class="astriarch-btn-primary font-orbitron border-none bg-gradient-to-r from-cyan-500 to-cyan-400 text-sm font-extrabold tracking-widest text-slate-900 uppercase shadow-lg shadow-cyan-500/25 hover:from-cyan-400 hover:to-cyan-300"
							>
								{saveButtonText}
							</Button>
						{/if}
					</Dialog.Footer>
				</div>
			</div>
		{/if}
	</Dialog.Content>
</Dialog.Root>

<style>
	:global(.astriarch-modal) {
		font-family: 'Orbitron', monospace;
	}

	:global(.astriarch-modal .font-orbitron) {
		font-family: 'Orbitron', monospace;
	}

	:global(.text-shadow-lg) {
		text-shadow:
			0 4px 8px rgba(0, 0, 0, 0.3),
			0 0 16px rgba(0, 255, 255, 0.2);
	}

	/* Custom button styling for space theme */
	:global(.astriarch-btn-primary) {
		position: relative;
		transition: all 0.3s ease;
		text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
	}

	:global(.astriarch-btn-primary:hover) {
		transform: translateY(-1px);
		box-shadow: 0 8px 25px rgba(0, 255, 255, 0.4);
	}

	:global(.astriarch-btn-secondary) {
		position: relative;
		transition: all 0.3s ease;
		backdrop-filter: blur(4px);
	}

	:global(.astriarch-btn-secondary:hover) {
		transform: translateY(-1px);
		box-shadow: 0 4px 12px rgba(255, 255, 255, 0.1);
	}

	/* SVG Modal Specific Styles */
	.astriarch-modal-svg {
		font-family: 'Orbitron', monospace;
		min-width: 400px;
		min-height: 380px;
	}

	.astriarch-modal-svg svg {
		display: block;
	}

	/* Custom button styling for SVG modal to make them flexible */
	.astriarch-modal-svg :global(button) {
		width: 100% !important;
		min-width: 120px;
	}

	/* Responsive adjustments */
	@media (max-width: 640px) {
		:global(.astriarch-modal-container) {
			margin: 1rem;
		}

		:global(.astriarch-modal .text-3xl) {
			font-size: 1.5rem;
		}

		.astriarch-modal-svg .absolute[style*='top: 8.33%'] {
			font-size: 24px !important;
		}

		.astriarch-modal-svg .absolute[style*='top: 36.46%'] {
			font-size: 14px !important;
		}
	}
</style>
