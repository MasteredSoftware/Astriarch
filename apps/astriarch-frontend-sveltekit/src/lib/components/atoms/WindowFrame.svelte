<script lang="ts">
  export let className: string = '';
  export let showLogo: boolean = true;
  export let version: string = 'v2.0';
  export let fallbackMode: boolean = true; // Use CSS fallback if SVGs aren't available

  // SVG assets for the window frame layers (when available)
  const bgSvg = 'window-frame/bg.svg';
  const stroke1Svg = 'window-frame/stroke-1.svg';
  const stroke2Svg = 'window-frame/stroke-2.svg';
  const stroke3Svg = 'window-frame/stroke-3.svg';
  
  // Logo asset
  const logoSrc = 'logo/astriarch-logo.png';
</script>

<div 
  class="relative w-full h-full {className}"
  role="presentation"
  aria-label="Window Frame"
>
  {#if fallbackMode}
    <!-- CSS Fallback Mode - Styled with design system -->
    <div class="absolute inset-0 bg-astriarch-ui-dark-blue rounded-lg border-2 border-astriarch-ui-light-grey/30"></div>
    <div class="absolute inset-1 border border-astriarch-primary/50 rounded"></div>
    <div class="absolute inset-2 border border-astriarch-ui-light-grey/20 rounded"></div>
    
    <!-- Content Slot Area -->
    <div class="absolute inset-[12px] overflow-hidden">
      <slot />
    </div>
  {:else}
    <!-- SVG Mode - Uses actual Figma assets -->
    <!-- Background Layer -->
    <div class="absolute inset-0">
      <img 
        src={bgSvg}
        alt=""
        class="w-full h-full object-fill"
        aria-hidden="true"
      />
    </div>

    <!-- Content Slot Area -->
    <div class="absolute inset-[5.73%_2.894%_5.819%_2.894%] overflow-hidden">
      <slot />
    </div>

    <!-- Stroke Layers (from outermost to innermost) -->
    
    <!-- Stroke 3 (Outermost) -->
    <div class="absolute inset-[5.73%_2.894%_5.819%_2.894%]">
      <div class="absolute inset-[-3.239%_-2.211%_-4.049%_-2.211%]">
        <img 
          src={stroke3Svg}
          alt=""
          class="w-full h-full object-fill"
          aria-hidden="true"
        />
      </div>
    </div>

    <!-- Stroke 2 (Middle) -->
    <div class="absolute inset-[5.73%_2.894%_5.819%_2.894%]">
      <div class="absolute inset-[-1.619%_-1.228%_-2.429%_-1.228%]">
        <img 
          src={stroke2Svg}
          alt=""
          class="w-full h-full object-fill"
          aria-hidden="true"
        />
      </div>
    </div>

    <!-- Stroke 1 (Innermost) -->
    <div class="absolute inset-[5.73%_2.894%_5.819%_2.894%]">
      <div class="absolute inset-[0_-0.246%_-0.81%_-0.246%]">
        <img 
          src={stroke1Svg}
          alt=""
          class="w-full h-full object-fill"
          aria-hidden="true"
        />
      </div>
    </div>
  {/if}

  <!-- Logo Area (Bottom Left) -->
  {#if showLogo}
    <div class="absolute bottom-[2.865%] left-[1.852%] w-32 h-6">
      <!-- Logo Image -->
      <div class="absolute inset-0 opacity-40">
        <img 
          src={logoSrc}
          alt="Astriarch"
          class="w-full h-full object-contain object-left"
        />
      </div>
      
      <!-- Version Text -->
      <div class="absolute bottom-0 left-20 right-0 top-1">
        <p class="text-astriarch-caption-10 text-astriarch-ui-light-grey opacity-40 font-mono leading-none">
          {version}
        </p>
      </div>
    </div>
  {/if}
</div>
