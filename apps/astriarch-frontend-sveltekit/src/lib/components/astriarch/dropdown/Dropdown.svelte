<script lang="ts">
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

	let isOpen = $state(false);
	let dropdownRef: HTMLDivElement;

	const dropdownStyle = $derived(`
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
	`);

	const textColor = variant === 'primary' ? '#1B1F25' : '#00FFFF';
	
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

	const selectedOption = $derived(options.find(opt => opt.value === value));
	const displayText = $derived(selectedOption?.label || placeholder);

	function toggleDropdown() {
		if (!disabled) {
			isOpen = !isOpen;
		}
	}

	function selectOption(optionValue: string) {
		if (!disabled) {
			onSelect?.(optionValue);
			isOpen = false;
		}
	}

	function handleKeydown(event: KeyboardEvent) {
		if (!disabled) {
			if (event.key === 'Enter' || event.key === ' ') {
				event.preventDefault();
				toggleDropdown();
			} else if (event.key === 'Escape') {
				isOpen = false;
			}
		}
	}

	// Close dropdown when clicking outside
	function handleClickOutside(event: MouseEvent) {
		if (dropdownRef && !dropdownRef.contains(event.target as Node)) {
			isOpen = false;
		}
	}

	$effect(() => {
		if (isOpen) {
			document.addEventListener('click', handleClickOutside);
			return () => {
				document.removeEventListener('click', handleClickOutside);
			};
		}
	});
</script>

<div bind:this={dropdownRef} class="relative {className || ''}" {...restProps}>
	<button
		onclick={toggleDropdown}
		onkeydown={handleKeydown}
		style={dropdownStyle}
		class="transition-opacity hover:opacity-90 active:opacity-100"
		{disabled}
		aria-expanded={isOpen}
		aria-haspopup="listbox"
		role="combobox"
	>
		<span style={textStyle}>
			{displayText}
		</span>
		
		<!-- Chevron Icon -->
		<div class="relative z-10 pointer-events-none" style="width: 12px; height: 12px;">
			<svg 
				width="12" 
				height="12" 
				viewBox="0 0 12 12" 
				fill="none" 
				xmlns="http://www.w3.org/2000/svg"
				class="transition-transform duration-200 {isOpen ? 'rotate-180' : ''}"
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
		
		<DropdownSvg {variant} />
	</button>

	<!-- Dropdown Menu -->
	{#if isOpen && !disabled}
		<div 
			class="absolute top-full left-0 mt-1 z-50 min-w-full bg-gray-900/95 backdrop-blur-sm border border-cyan-500/30 rounded shadow-lg"
			role="listbox"
		>
			{#each options as option}
				<button
					class="w-full text-left px-4 py-3 text-cyan-100 hover:bg-cyan-500/20 transition-colors font-bold text-sm uppercase tracking-wide border-b border-cyan-500/10 last:border-b-0 {option.disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}"
					onclick={() => !option.disabled && selectOption(option.value)}
					disabled={option.disabled}
					role="option"
					aria-selected={option.value === value}
					style="font-family: 'Orbitron', sans-serif;"
				>
					{option.label}
				</button>
			{/each}
		</div>
	{/if}
</div>
