<script lang="ts">
	import type { IconImageType } from '../types.js';
	import Text from '../text/Text.svelte';
	import IconImage from '../icon-image/IconImage.svelte';

	interface Props {
		amount: number;
		amountPerTurn?: number;
		type: IconImageType;
		onClick?: () => void;
		children?: any;
		class?: string;
	}

	let {
		amount,
		amountPerTurn,
		type,
		onClick,
		children,
		class: className,
		...restProps
	}: Props = $props();

	const amountFormatted = $derived(amount.toFixed(1));
	const amountPerTurnFormatted = $derived(amountPerTurn ? amountPerTurn.toFixed(1) : null);
	const amountPerTurnSign = $derived(amountPerTurn ? (amountPerTurn > 0 ? '+' : '') : '');
	const amountContent = $derived(
		amountPerTurn
			? `${amountFormatted}  ${amountPerTurnSign}${amountPerTurnFormatted}`
			: amountFormatted.toString()
	);

	const textStyle = $derived(`
    color: #FFF;
    font-size: 18px;
    font-weight: 600;
    line-height: 32px;
    letter-spacing: 0.09px;
    margin-left: 4px;
    display: inline-block;
    vertical-align: bottom;
  `);

	function handleClick() {
		onClick?.();
	}
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<div
	class="relative z-[100] flex {className || ''}"
	onclick={handleClick}
	onkeydown={(e) => {
		if (onClick && (e.key === 'Enter' || e.key === ' ')) {
			e.preventDefault();
			handleClick();
		}
	}}
	role={onClick ? 'button' : undefined}
	tabindex={onClick ? 0 : undefined}
	{...restProps}
>
	<IconImage {type} size={32} />
	<Text style={textStyle}>
		{amountContent}
	</Text>
	{#if children}
		{@render children()}
	{/if}
</div>
