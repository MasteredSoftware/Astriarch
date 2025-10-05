# Astriarch Design System

Complete design system based on your Figma design with all colors and styles systematically organized.

## Color Palette

### Primary Colors

```css
--astriarch-primary-fill: #00ffff;
--astriarch-primary-stroke: linear-gradient(
	299.62deg,
	rgba(0, 0, 0, 0.5) 7.75%,
	#00ffff 82.21%,
	#ffffff 100%
);
```

### General UI Colors

```css
--astriarch-ui-dark-blue: #1b1f25;
--astriarch-ui-dark-grey: #313e46;
--astriarch-ui-light-grey: #90a9ba;
--astriarch-ui-white: #ffffff;
--astriarch-ui-white-75: rgba(255, 255, 255, 0.75);
--astriarch-ui-white-50: rgba(255, 255, 255, 0.5);
--astriarch-ui-modal-bg: rgba(27, 31, 37, 0.9);
--astriarch-bg-glass: rgba(27, 31, 37, 0.8);
```

### Theme Colors

```css
--astriarch-green-theme: #7bfe2b;
--astriarch-orange-theme: #ff9111;
--astriarch-purple-theme: #c240ff;
```

### Element/Resource Colors

```css
--astriarch-food: #f87b54;
--astriarch-energy: #ffce22;
--astriarch-research: #00ffc2;
--astriarch-ore: #b6e827;
--astriarch-iridium: #aa77ff;
--astriarch-population: #23bdff;
```

### Status Colors

```css
--astriarch-status-bad: #ff0000;
--astriarch-status-medium: #fff500;
--astriarch-status-good: #00ff38;
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
<div class="bg-astriarch-food p-2 text-white">Food Resource</div>
<div class="bg-astriarch-energy p-2 text-black">Energy Resource</div>

<!-- Resource borders -->
<div class="border-astriarch-food border-2 p-2">Food Border</div>
<div class="border-astriarch-energy border-2 p-2">Energy Border</div>
```

### Status Colors

```html
<!-- Status indicators -->
<span class="text-astriarch-status-good">✓ Good Status</span>
<span class="text-astriarch-status-medium">⚠ Medium Status</span>
<span class="text-astriarch-status-bad">✗ Bad Status</span>

<!-- Status backgrounds -->
<div class="bg-astriarch-status-good p-2 text-black">Success</div>
<div class="bg-astriarch-status-medium p-2 text-black">Warning</div>
<div class="bg-astriarch-status-bad p-2 text-white">Error</div>
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
		{ name: 'Iridium', value: 12.3, class: 'text-astriarch-iridium' }
	];
</script>

<div class="bg-astriarch-glass rounded-lg p-4">
	{#each resources as resource}
		<div class="flex items-center justify-between">
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
	<button
		class="bg-astriarch-primary rounded px-4 py-2 text-black transition-opacity hover:opacity-80"
	>
		<slot />
	</button>
{:else if variant === 'glass'}
	<button
		class="bg-astriarch-glass text-astriarch-ui-white border-astriarch-primary hover:bg-astriarch-primary rounded border px-4 py-2 transition-colors hover:text-black"
	>
		<slot />
	</button>
{:else if variant === 'gradient'}
	<button
		class="border-gradient-astriarch bg-astriarch-ui-dark-blue text-astriarch-ui-white hover:bg-astriarch-primary rounded px-4 py-2 transition-colors hover:text-black"
	>
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

<div class="bg-astriarch-ui-dark-blue overflow-hidden rounded-lg">
	<div class={`${themeClasses[theme]} p-3 font-semibold`}>
		<slot name="header" />
	</div>
	<div class="text-astriarch-ui-white p-4">
		<slot />
	</div>
</div>
```

## Typography

### Font Family

```css
--astriarch-font-orbitron: 'Orbitron', system-ui, -apple-system, sans-serif;
```

The design system uses **Orbitron** as the primary font family for that sci-fi aesthetic.

### Typography Scale

#### Headlines

```html
<!-- Headline 72px - Hero text -->
<h1 class="text-astriarch-headline-72 text-astriarch-ui-white">Main Title</h1>

<!-- Headline 56px - Large section headers -->
<h2 class="text-astriarch-headline-56 text-astriarch-ui-white">Section Header</h2>

<!-- Headline 42px - Medium headers -->
<h3 class="text-astriarch-headline-42 text-astriarch-ui-white">Subsection</h3>

<!-- Headline 38px - Small headers -->
<h4 class="text-astriarch-headline-38 text-astriarch-ui-white">Small Header</h4>

<!-- Headline 32px - Component titles -->
<h5 class="text-astriarch-headline-32 text-astriarch-ui-white">Component Title</h5>

<!-- Headline 24px - Card titles -->
<h6 class="text-astriarch-headline-24 text-astriarch-ui-white">Card Title</h6>
```

#### Body Text

```html
<!-- Body 19px - Large body text -->
<p class="text-astriarch-body-19 text-astriarch-ui-white">Large body text for important content</p>
<p class="text-astriarch-body-19-semibold text-astriarch-ui-white">Large body text emphasized</p>

<!-- Body 18px - Medium body text -->
<p class="text-astriarch-body-18 text-astriarch-ui-white">Medium body text for general content</p>
<p class="text-astriarch-body-18-semibold text-astriarch-ui-white">Medium body text emphasized</p>

<!-- Body 16px - Standard body text -->
<p class="text-astriarch-body-16 text-astriarch-ui-white">Standard body text for most content</p>
<p class="text-astriarch-body-16-semibold text-astriarch-ui-white">Standard body text emphasized</p>

<!-- Body 14px - Small body text -->
<p class="text-astriarch-body-14 text-astriarch-ui-white">Small body text for secondary content</p>
<p class="text-astriarch-body-14-semibold text-astriarch-ui-white">Small body text emphasized</p>
```

#### Captions

```html
<!-- Caption 12px - Standard captions -->
<span class="text-astriarch-caption-12 text-astriarch-ui-light-grey">Standard caption text</span>
<span class="text-astriarch-caption-12-semibold text-astriarch-ui-light-grey"
	>Emphasized caption</span
>

<!-- Caption 10px - Small captions -->
<span class="text-astriarch-caption-10 text-astriarch-ui-light-grey">Small caption text</span>
<span class="text-astriarch-caption-10-semibold text-astriarch-ui-light-grey"
	>Small emphasized caption</span
>
```

#### Call to Action

```html
<!-- CTA 16px - Primary buttons -->
<button class="text-astriarch-cta-16 bg-astriarch-primary rounded px-6 py-3 text-black">
	Primary Action
</button>

<!-- CTA 14px - Secondary buttons -->
<button
	class="text-astriarch-cta-14 bg-astriarch-ui-dark-grey text-astriarch-ui-white rounded px-4 py-2"
>
	Secondary Action
</button>

<!-- CTA 12px - Small buttons -->
<button
	class="text-astriarch-cta-12 bg-astriarch-ui-dark-grey text-astriarch-ui-white rounded px-3 py-1"
>
	Small Action
</button>
```

#### Labels

```html
<!-- Label 12px - Form labels, section labels -->
<label class="text-astriarch-label-12 text-astriarch-ui-light-grey"> Field Label </label>
```

### Typography Usage Examples

#### Section Header Component

```svelte
<div class="mb-6">
	<h2 class="text-astriarch-headline-32 text-astriarch-primary mb-2">Planet Overview</h2>
	<p class="text-astriarch-body-16 text-astriarch-ui-light-grey">
		Manage your planet's resources and development
	</p>
</div>
```

#### Card Component with Typography

```svelte
<div class="bg-astriarch-glass rounded-lg p-4">
	<h3 class="text-astriarch-headline-24 text-astriarch-ui-white mb-2">Resource Production</h3>
	<div class="space-y-2">
		<div class="flex items-center justify-between">
			<span class="text-astriarch-body-16 text-astriarch-ui-light-grey">Food:</span>
			<span class="text-astriarch-body-16-semibold text-astriarch-food">+2.4</span>
		</div>
		<span class="text-astriarch-caption-12 text-astriarch-ui-light-grey">per turn</span>
	</div>
</div>
```

#### Button with Proper Typography

```svelte
<button class="bg-astriarch-primary rounded px-6 py-3 transition-opacity hover:opacity-80">
	<span class="text-astriarch-cta-16 text-black"> Build Structure </span>
</button>
```

#### Form with Labels

```svelte
<div class="space-y-4">
	<div>
		<label class="text-astriarch-label-12 text-astriarch-ui-light-grey mb-1 block">
			Planet Name
		</label>
		<input
			class="text-astriarch-body-16 bg-astriarch-ui-dark-grey text-astriarch-ui-white border-astriarch-primary w-full rounded border px-3 py-2"
			type="text"
			value="Terra Prime"
		/>
	</div>
</div>
```

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
