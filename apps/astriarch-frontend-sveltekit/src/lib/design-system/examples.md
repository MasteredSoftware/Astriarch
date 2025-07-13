# Astriarch Design System

## Primary Colors

We've established the core design system colors based on your Figma design:

### CSS Custom Properties
```css
/* Available in :root */
--astriarch-primary-fill: #00FFFF;
--astriarch-primary-stroke: linear-gradient(299.62deg, rgba(0, 0, 0, 0.5) 7.75%, #00FFFF 82.21%, #FFFFFF 100%);
```

### Tailwind Utility Classes

#### Background Colors
```html
<!-- Primary fill background -->
<div class="bg-astriarch-primary">Content</div>

<!-- Primary gradient stroke background -->
<div class="bg-astriarch-primary-stroke">Content</div>
```

#### Text Colors
```html
<!-- Primary fill text -->
<span class="text-astriarch-primary">Primary Text</span>
```

#### Border Colors
```html
<!-- Primary fill border -->
<div class="border border-astriarch-primary">Content</div>

<!-- Gradient border (using pseudo-element) -->
<div class="border-gradient-astriarch">Content with gradient border</div>
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
```

### Svelte Component Usage
```svelte
<script>
  // Can also access via CSS custom properties in style blocks
</script>

<!-- Using Tailwind classes -->
<div class="bg-astriarch-primary text-white p-4">
  Primary Background
</div>

<!-- Using gradient stroke -->
<div class="bg-astriarch-primary-stroke text-white p-4">
  Gradient Background
</div>

<!-- Using gradient border -->
<div class="border-gradient-astriarch bg-slate-900 text-white p-4">
  Gradient Border
</div>

<style>
  /* Using CSS custom properties directly */
  .custom-element {
    background-color: var(--astriarch-primary-fill);
    border: 2px solid var(--astriarch-primary-fill);
  }
  
  .custom-gradient {
    background: var(--astriarch-primary-stroke);
  }
</style>
```

## Next Steps

This foundation gives us:
1. **Consistent primary color** (`#00FFFF`) across the application
2. **Gradient stroke pattern** matching your Figma design
3. **Multiple usage patterns** (Tailwind classes, CSS custom properties)
4. **Future extensibility** for additional design system tokens

We can now extend this system with:
- Secondary colors
- Spacing scales
- Typography scales
- Component-specific design tokens
- Animation/transition patterns
