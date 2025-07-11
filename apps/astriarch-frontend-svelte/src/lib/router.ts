import { writable } from 'svelte/store';

// Create a store for the current route
export const currentRoute = writable('home');

// Function to navigate to a different route
export function navigate(route: string) {
  currentRoute.set(route);
  // Update the URL hash for bookmarking
  window.location.hash = route;
}

// Initialize from URL hash if present
export function initRouter() {
  const hash = window.location.hash.slice(1);
  if (hash) {
    currentRoute.set(hash);
  }
  
  // Listen for hash changes
  window.addEventListener('hashchange', () => {
    const newHash = window.location.hash.slice(1);
    currentRoute.set(newHash || 'home');
  });
}
