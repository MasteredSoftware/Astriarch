# Browser Compatibility Report

## Overview
This report summarizes the browser compatibility and system requirements for the Astriarch game frontend. The frontend is built using modern web technologies, including SvelteKit, Vite, Konva (HTML5 Canvas), and WebSockets.

## Technology Stack & Compatibility

### Frontend Framework & Build Tool
- **SvelteKit**: Requires modern JavaScript environments. Supported in Chrome 80+, Firefox 78+, Safari 13.1+, and Edge 79+.
- **Vite**: Uses ES Modules. Supported in Chrome 80+, Firefox 78+, Safari 13.1+, and Edge 79+.

### Graphics & UI
- **Konva (HTML5 Canvas)**: Used for the galaxy map and fleet rendering. Supported in all modern browsers. Performance is dependent on hardware acceleration (GPU).
- **Tailwind CSS 4**: Uses modern CSS features like CSS variables and Grid. Supported in Chrome 90+, Firefox 80+, Safari 14.1+, and Edge 90+.

### Real-time Communication
- **WebSockets**: Supported in all modern browsers.

## Compatibility Issues Identified
- **Legacy Browsers**: Internet Explorer 11 and other pre-2020 browsers are not supported due to the reliance on ES Modules and modern CSS features.
- **Hardware Acceleration**: Since the game heavily uses the HTML5 Canvas via Konva for rendering the galaxy map, browsers without hardware acceleration or on very old hardware may experience significant lag or rendering issues.
- **Safari Versioning**: Older versions of Safari (before 14.1) may have issues with some of the CSS features used in the UI.

## Minimum System Requirements

### Web Browser
- **Google Chrome**: Version 100+
- **Mozilla Firefox**: Version 100+
- **Apple Safari**: Version 15+
- **Microsoft Edge**: Version 100+

### Operating System
- **Windows**: Windows 10 or newer
- **macOS**: macOS 10.15 or newer
- **Linux**: A modern desktop environment with a recent kernel (e.g., Ubuntu 20.04+)

### Hardware Requirements
- **CPU**: Dual-core processor (modern equivalent)
- **Memory**: 4GB RAM minimum (8GB recommended for smoother performance)
- **GPU**: Dedicated or integrated GPU supporting hardware-accelerated HTML5 Canvas rendering.
- **Network**: Stable internet connection for WebSocket communication.
