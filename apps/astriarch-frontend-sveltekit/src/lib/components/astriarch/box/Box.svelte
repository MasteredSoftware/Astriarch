<script lang="ts">
  type $$Props = {
    class?: string;
    style?: string;
    [key: string]: any;
  };
</script>

<div class={$$props.class || ''} style={$$props.style || ''} {...$$restProps}>
  <slot />
</div>
