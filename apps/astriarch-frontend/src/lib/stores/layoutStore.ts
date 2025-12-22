import { writable, derived } from 'svelte/store';
import { browser } from '$app/environment';

// Layout mode types
export type LayoutMode = 'portrait' | 'landscape';

// Breakpoint configuration
const LANDSCAPE_MIN_WIDTH = 1024; // Minimum width for landscape mode
const LANDSCAPE_MIN_ASPECT_RATIO = 1.2; // Minimum aspect ratio for landscape mode

// Store for screen dimensions
function createScreenDimensionsStore() {
	const { subscribe, set } = writable({
		width: browser ? window.innerWidth : 0,
		height: browser ? window.innerHeight : 0
	});

	if (browser) {
		// Set initial values
		set({
			width: window.innerWidth,
			height: window.innerHeight
		});

		// Listen for resize events with debouncing
		let resizeTimeout: ReturnType<typeof setTimeout>;
		const handleResize = () => {
			clearTimeout(resizeTimeout);
			resizeTimeout = setTimeout(() => {
				set({
					width: window.innerWidth,
					height: window.innerHeight
				});
			}, 100); // Debounce for 100ms
		};

		window.addEventListener('resize', handleResize);

		// Listen for orientation change events
		const handleOrientationChange = () => {
			// Small delay to allow browser to complete orientation change
			setTimeout(() => {
				set({
					width: window.innerWidth,
					height: window.innerHeight
				});
			}, 200);
		};

		window.addEventListener('orientationchange', handleOrientationChange);

		// Cleanup function (though writable stores don't support this directly,
		// we'll handle it through the component lifecycle)
		if (typeof window !== 'undefined') {
			const originalOnDestroy = window.onbeforeunload;
			window.onbeforeunload = (event) => {
				window.removeEventListener('resize', handleResize);
				window.removeEventListener('orientationchange', handleOrientationChange);
				if (originalOnDestroy) return originalOnDestroy.call(window, event);
			};
		}
	}

	return { subscribe };
}

// Screen dimensions store
export const screenDimensions = createScreenDimensionsStore();

// Derived store for screen width
export const screenWidth = derived(screenDimensions, ($dimensions) => $dimensions.width);

// Derived store for screen height
export const screenHeight = derived(screenDimensions, ($dimensions) => $dimensions.height);

// Derived store for aspect ratio
export const aspectRatio = derived(screenDimensions, ($dimensions) => {
	if ($dimensions.height === 0) return 1;
	return $dimensions.width / $dimensions.height;
});

// Derived store for layout mode
export const layoutMode = derived(
	[screenDimensions, aspectRatio],
	([$dimensions, $aspectRatio]) => {
		// Landscape mode if:
		// 1. Width is at least LANDSCAPE_MIN_WIDTH pixels, AND
		// 2. Aspect ratio is at least LANDSCAPE_MIN_ASPECT_RATIO (wider than tall)
		const isLandscape =
			$dimensions.width >= LANDSCAPE_MIN_WIDTH && $aspectRatio >= LANDSCAPE_MIN_ASPECT_RATIO;

		return isLandscape ? 'landscape' : 'portrait';
	}
);

// Derived store for responsive breakpoints
export const breakpoints = derived(screenWidth, ($width) => ({
	isMobile: $width < 640,
	isTablet: $width >= 640 && $width < 1024,
	isDesktop: $width >= 1024,
	isLargeDesktop: $width >= 1440,
	isExtraLarge: $width >= 1920
}));

// Computed layout dimensions for game components
export const layoutDimensions = derived(
	[layoutMode, screenDimensions],
	([$layoutMode, $dimensions]) => {
		const HEADER_HEIGHT = 80; // Approximate header height
		const SIDEBAR_WIDTH_PERCENT = 0.5; // Sidebar takes 50% of screen width in landscape mode
		const PANEL_MARGIN = 16; // Margin around panels (mx-4 = 16px)
		const BOTTOM_NAV_HEIGHT = 48; // Height of bottom navigation bar

		if ($layoutMode === 'landscape') {
			// Landscape mode: sidebar on right (50%), full height canvas on left (50%)
			const sidebarWidth = $dimensions.width * SIDEBAR_WIDTH_PERCENT;
			return {
				canvasWidth: $dimensions.width - sidebarWidth - PANEL_MARGIN * 2, // Account for margins
				canvasHeight: $dimensions.height - HEADER_HEIGHT - PANEL_MARGIN * 2,
				sidebarWidth,
				sidebarHeight: $dimensions.height - HEADER_HEIGHT - PANEL_MARGIN * 2,
				hasBottomNav: false,
				panelPosition: 'right' as const
			};
		} else {
			// Portrait mode: bottom panel, full width canvas
			return {
				canvasWidth: $dimensions.width - PANEL_MARGIN * 2,
				canvasHeight: ($dimensions.height - HEADER_HEIGHT - BOTTOM_NAV_HEIGHT) * 0.5, // 50% for canvas
				sidebarWidth: 0,
				sidebarHeight: 0,
				hasBottomNav: true,
				panelPosition: 'bottom' as const
			};
		}
	}
);

// Debug store to log layout changes (can be removed in production)
if (browser) {
	layoutMode.subscribe((mode) => {
		console.log('Layout mode changed to:', mode);
	});

	screenDimensions.subscribe((dimensions) => {
		console.log('Screen dimensions changed to:', dimensions);
	});
}

// Export actions for manual layout recalculation (if needed)
export const layoutActions = {
	// Force recalculate layout (useful after manual DOM changes)
	recalculate: () => {
		if (browser) {
			window.dispatchEvent(new Event('resize'));
		}
	}
};
