// This is an example of how to load fonts programmatically
// Instead of using this approach, we've added the font link to index.html

export function loadFonts() {
  const link = document.createElement('link');
  link.href = 'https://fonts.googleapis.com/css2?family=Orbitron:wght@400;600;800&display=swap';
  link.rel = 'stylesheet';
  document.head.appendChild(link);
}

// You would then call this function in main.ts before mounting the app
// loadFonts();
