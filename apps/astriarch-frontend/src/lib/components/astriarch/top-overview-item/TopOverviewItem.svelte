<script lang="ts">
	import type { IconImageType } from '../types.js';
	import Text from '../text/Text.svelte';
	import IconImage from '../icon-image/IconImage.svelte';
	import { toShortNumberString } from '$lib/utils/number-helper';

	interface Props {
		amount: number;
		amountPerTurn?: number;
		type: IconImageType;
		color?: string;
		onClick?: () => void;
		children?: any;
		class?: string;
	}

	let {
		amount = 0,
		amountPerTurn,
		type,
		color,
		onClick,
		children,
		class: className,
		...restProps
	}: Props = $props();

	const amountFormatted = $derived(toShortNumberString(amount ?? 0));
	const amountPerTurnFormatted = $derived(
		amountPerTurn ? toShortNumberString(amountPerTurn) : null
	);
	const amountPerTurnSign = $derived(amountPerTurn ? (amountPerTurn > 0 ? '+' : '') : '');

	const baseTextStyle = $derived(`
    color: #FFF;
    font-size: 18px;
    font-weight: 600;
    line-height: 32px;
    letter-spacing: 0.09px;
    margin-left: 4px;
    display: inline-block;
    vertical-align: bottom;
  `);

	const perTurnTextStyle = $derived(`
    color: ${color || '#FFF'};
    font-size: 18px;
    font-weight: 600;
    line-height: 32px;
    letter-spacing: 0.09px;
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
	<div
		style="display: inline-flex; {['food', 'ore', 'iridium'].includes(type)
			? 'min-width: 110px;'
			: 'min-width: 65px;'}"
	>
		<Text style={baseTextStyle}>
			{amountFormatted}
		</Text>
		{#if amountPerTurnFormatted}
			<Text style={perTurnTextStyle}>
				&nbsp;&nbsp;{amountPerTurnSign}{amountPerTurnFormatted}
			</Text>
		{/if}
	</div>
	{#if children}
		{@render children()}
	{/if}
</div>
