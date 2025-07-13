# Astriarch Design System

Complete design system based on your Figma design with all colors and styles systematically organized.

## Color Palette

### Primary Colors
```css
--astriarch-primary-fill: #00FFFF;
--astriarch-primary-stroke: linear-gradient(299.62deg, rgba(0, 0, 0, 0.5) 7.75%, #00FFFF 82.21%, #FFFFFF 100%);
```

### General UI Colors
```css
--astriarch-ui-dark-blue: #1B1F25;
--astriarch-ui-dark-grey: #313E46;
--astriarch-ui-light-grey: #90A9BA;
--astriarch-ui-white: #FFFFFF;
--astriarch-ui-white-75: rgba(255, 255, 255, 0.75);
--astriarch-ui-white-50: rgba(255, 255, 255, 0.5);
--astriarch-ui-modal-bg: rgba(27, 31, 37, 0.9);
--astriarch-bg-glass: rgba(27, 31, 37, 0.8);
```

### Theme Colors
```css
--astriarch-green-theme: #7BFE2B;
--astriarch-orange-theme: #FF9111;
--astriarch-purple-theme: #C240FF;
```

### Element/Resource Colors
```css
--astriarch-food: #F87B54;
--astriarch-energy: #FFCE22;
--astriarch-research: #00FFC2;
--astriarch-ore: #B6E827;
--astriarch-iridium: #AA77FF;
--astriarch-population: #23BDFF;
```

### Status Colors
```css
--astriarch-status-bad: #FF0000;
--astriarch-status-medium: #FFF500;
--astriarch-status-good: #00FF38;
```

## Tailwind Utility Classes

### Primary Colors
```html
<!-- Primary backgrounds and text -->
<div class="bg-astriarch-primary text-astriarch-ui-white">Primary</div>
<div class="bg-astriarch-primary-stroke">Gradient Background</div>
<div class="border-gradient-astriarch">Gradient Border</div>
```

### UI Colors
```html
<!-- UI backgrounds -->
<div class="bg-astriarch-ui-dark-blue text-astriarch-ui-white">Dark Blue</div>
<div class="bg-astriarch-ui-dark-grey text-astriarch-ui-white">Dark Grey</div>
<div class="bg-astriarch-glass text-astriarch-ui-white">Glass Effect</div>
<div class="bg-astriarch-modal text-astriarch-ui-white">Modal Background</div>

<!-- UI text colors -->
<span class="text-astriarch-ui-light-grey">Light Grey Text</span>
<span class="text-astriarch-ui-white">White Text</span>
```

### Theme Colors
```html
<!-- Theme backgrounds and text -->
<div class="bg-astriarch-green text-black">Green Theme</div>
<div class="bg-astriarch-orange text-black">Orange Theme</div>
<div class="bg-astriarch-purple text-white">Purple Theme</div>

<span class="text-astriarch-green">Green Text</span>
<span class="text-astriarch-orange">Orange Text</span>
<span class="text-astriarch-purple">Purple Text</span>
```

### Resource/Element Colors
```html
<!-- Resource indicators -->
<div class="flex space-x-4">
  <span class="text-astriarch-food">🍎 Food</span>
  <span class="text-astriarch-energy">⚡ Energy</span>
  <span class="text-astriarch-research">🔬 Research</span>
  <span class="text-astriarch-ore">⛏️ Ore</span>
  <span class="text-astriarch-iridium">💎 Iridium</span>
  <span class="text-astriarch-population">👥 Population</span>
</div>

<!-- Resource backgrounds -->
<div class="bg-astriarch-food text-white p-2">Food Resource</div>
<div class="bg-astriarch-energy text-black p-2">Energy Resource</div>

<!-- Resource borders -->
<div class="border-2 border-astriarch-food p-2">Food Border</div>
<div class="border-2 border-astriarch-energy p-2">Energy Border</div>
```

### Status Colors
```html
<!-- Status indicators -->
<span class="text-astriarch-status-good">✓ Good Status</span>
<span class="text-astriarch-status-medium">⚠ Medium Status</span>
<span class="text-astriarch-status-bad">✗ Bad Status</span>

<!-- Status backgrounds -->
<div class="bg-astriarch-status-good text-black p-2">Success</div>
<div class="bg-astriarch-status-medium text-black p-2">Warning</div>
<div class="bg-astriarch-status-bad text-white p-2">Error</div>
```

### Direct CSS Usage
```css
/* Use the custom properties directly */
.my-component {
  background-color: var(--astriarch-primary-fill);
  border: 1px solid var(--astriarch-primary-fill);
}

.my-gradient-component {
  background: var(--astriarch-primary-stroke);
}

.resource-indicator {
  color: var(--astriarch-food);
  border-color: var(--astriarch-food);
}

.status-indicator--good {
  background-color: var(--astriarch-status-good);
}
```

## Practical Usage Examples

### Resource Display Component
```svelte
<script>
  const resources = [
    { name: 'Food', value: 150.2, class: 'text-astriarch-food' },
    { name: 'Energy', value: 89.7, class: 'text-astriarch-energy' },
    { name: 'Research', value: 45.1, class: 'text-astriarch-research' },
    { name: 'Ore', value: 67.8, class: 'text-astriarch-ore' },
    { name: 'Iridium', value: 12.3, class: 'text-astriarch-iridium' },
  ];
</script>

<div class="bg-astriarch-glass p-4 rounded-lg">
  {#each resources as resource}
    <div class="flex justify-between items-center">
      <span class="text-astriarch-ui-light-grey">{resource.name}:</span>
      <span class={resource.class}>{resource.value.toFixed(1)}</span>
    </div>
  {/each}
</div>
```

### Status Indicator Component
```svelte
<script>
  export let status = 'good'; // 'good', 'medium', 'bad'
  
  const statusClasses = {
    good: 'text-astriarch-status-good',
    medium: 'text-astriarch-status-medium',
    bad: 'text-astriarch-status-bad'
  };
</script>

<span class={statusClasses[status]}>
  <slot />
</span>
```

### Primary Button Component
```svelte
<script>
  export let variant = 'primary'; // 'primary', 'glass', 'gradient'
</script>

{#if variant === 'primary'}
  <button class="bg-astriarch-primary text-black px-4 py-2 rounded hover:opacity-80 transition-opacity">
    <slot />
  </button>
{:else if variant === 'glass'}
  <button class="bg-astriarch-glass text-astriarch-ui-white border border-astriarch-primary px-4 py-2 rounded hover:bg-astriarch-primary hover:text-black transition-colors">
    <slot />
  </button>
{:else if variant === 'gradient'}
  <button class="border-gradient-astriarch bg-astriarch-ui-dark-blue text-astriarch-ui-white px-4 py-2 rounded hover:bg-astriarch-primary hover:text-black transition-colors">
    <slot />
  </button>
{/if}
```

### Theme Card Component
```svelte
<script>
  export let theme = 'primary'; // 'primary', 'green', 'orange', 'purple'
  
  const themeClasses = {
    primary: 'bg-astriarch-primary text-black',
    green: 'bg-astriarch-green text-black',
    orange: 'bg-astriarch-orange text-black',
    purple: 'bg-astriarch-purple text-white'
  };
</script>

<div class="bg-astriarch-ui-dark-blue rounded-lg overflow-hidden">
  <div class={`${themeClasses[theme]} p-3 font-semibold`}>
    <slot name="header" />
  </div>
  <div class="p-4 text-astriarch-ui-white">
    <slot />
  </div>
</div>
```

## Typography

### Font Family
```css
--astriarch-font-orbitron: 'Orbitron', system-ui, -apple-system, sans-serif;
```

The design system uses **Orbitron** as the primary font family, which is already configured globally. All components inherit this sci-fi aesthetic font automatically.

## Next Steps

This comprehensive design system provides:

1. **Complete Color Palette** - All colors from your Figma design systematically organized
2. **Tailwind Integration** - Ready-to-use utility classes for rapid development
3. **CSS Custom Properties** - Direct access for custom styling
4. **Practical Examples** - Real-world component patterns
5. **Consistent Theming** - Unified approach across the entire application

### Future Extensions
- Animation/transition patterns
- Spacing scales (if needed beyond Tailwind defaults)  
- Component-specific design tokens
- Dark/light mode variations
- Accessibility considerations (contrast ratios, etc.)
