<script lang="ts">
	import * as Select from '$lib/components/ui/select';
	import DropdownSvg from './DropdownSvg.svelte';

	interface DropdownOption {
		value: string;
		label: string;
		disabled?: boolean;
	}

	interface Props {
		options: DropdownOption[];
		value?: string;
		placeholder?: string;
		variant?: 'primary' | 'secondary';
		disabled?: boolean;
		class?: string;
		onSelect?: (value: string) => void;
	}

	let {
		options = [],
		value = '',
		placeholder = 'Select...',
		variant = 'secondary',
		disabled = false,
		class: className,
		onSelect,
		...restProps
	}: Props = $props();

	const textColor = variant === 'primary' ? '#1B1F25' : '#00FFFF';

	const triggerStyle = $derived(`
		width: 241px;
		height: 84px;
		background-color: transparent;
		border: none;
		border-radius: 0;
		padding: 0;
		cursor: ${disabled ? 'not-allowed' : 'pointer'};
		position: relative;
		opacity: ${disabled ? 0.5 : 1};
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding-left: 24px;
		padding-right: 40px;
		box-shadow: none;
	`);

	const textStyle = $derived(`
		color: ${textColor};
		font-family: 'Orbitron', sans-serif;
		font-size: 14px;
		font-weight: 800;
		line-height: 20px;
		letter-spacing: 2px;
		text-transform: uppercase;
		text-shadow: rgba(0,0,0,0.15) 0px 0px 8px;
		position: relative;
		z-index: 10;
		pointer-events: none;
		flex: 1;
		text-align: left;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	`);

	// Get the display text for the current value
	const selectedOption = $derived(options.find((opt) => opt.value === value));
	const displayText = $derived(selectedOption?.label || placeholder);

	function handleValueChange(newValue: string | undefined) {
		if (newValue && onSelect) {
			onSelect(newValue);
		}
	}
</script>

<div class="relative {className || ''}" {...restProps}>
	<Select.Root type="single" {value} onValueChange={handleValueChange} {disabled}>
		<Select.Trigger
			class="transition-opacity hover:opacity-90 active:opacity-100"
			style={triggerStyle}
		>
			<span style={textStyle}>
				{displayText}
			</span>

			<!-- Custom Chevron Icon -->
			<div class="pointer-events-none relative z-10" style="width: 12px; height: 12px;">
				<svg
					width="12"
					height="12"
					viewBox="0 0 12 12"
					fill="none"
					xmlns="http://www.w3.org/2000/svg"
					class="transition-transform duration-200"
				>
					<path
						d="M3 4.5L6 7.5L9 4.5"
						stroke={textColor}
						stroke-width="1.5"
						stroke-linecap="round"
						stroke-linejoin="round"
					/>
				</svg>
			</div>

			<DropdownSvg {variant} class="size-full" />
		</Select.Trigger>

		<Select.Content
			class="min-w-[241px] rounded border-cyan-500/30 bg-gray-900/95 shadow-lg backdrop-blur-sm"
			sideOffset={-4}
		>
			{#each options as option}
				<Select.Item
					value={option.value}
					disabled={option.disabled}
					class="border-b border-cyan-500/10 text-sm font-bold tracking-wide text-cyan-100 uppercase transition-colors last:border-b-0 hover:bg-cyan-500/20 {option.disabled
						? 'cursor-not-allowed opacity-50'
						: 'cursor-pointer'}"
					style="font-family: 'Orbitron', sans-serif;"
				>
					{option.label}
				</Select.Item>
			{/each}
		</Select.Content>
	</Select.Root>
</div>
