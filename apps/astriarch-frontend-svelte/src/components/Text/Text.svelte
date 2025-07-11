<script lang="ts">
  export let textAlign: 'left' | 'center' | 'right' = 'left';
  export let textTransform: 'none' | 'uppercase' | 'lowercase' | 'capitalize' = 'none';
  
  let className = '';
  export { className as class };
</script>

<span 
  class={className}
  style="
    text-align: {textAlign};
    text-transform: {textTransform};
  "
>
  <slot></slot>
</span>
