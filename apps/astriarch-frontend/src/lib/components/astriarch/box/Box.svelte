<script lang="ts">
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	type $$Props = {
		class?: string;
		style?: string;
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		[key: string]: any;
	};
</script>

<div class={$$props.class || ''} style={$$props.style || ''} {...$$restProps}>
	<slot />
</div>
