<script lang="ts">
	interface Props {
		fontFamily?: string;
		class?: string;
		style?: string;
		children?: any;
	}

	let {
		fontFamily = 'Orbitron',
		class: className,
		style,
		children,
		...restProps
	}: Props = $props();

	const textStyle = $derived(`font-family: ${fontFamily}; ${style || ''}`);
</script>

<span style={textStyle} class={className || ''} {...restProps}>
	{#if children}
		{@render children()}
	{/if}
</span>
