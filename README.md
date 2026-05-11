# Astriarch - Ruler of the stars

Astriarch Ruler of the Stars, Space Strategy Game
http://www.astriarch.com/

## Quickstart

`docker-compose up`

Then visit the frontend at:

`http://localhost:3000`


Database only:

`docker-compose up -d mongodb`


Run Frontend and Backend by navigating to the proper directory and run:

`pnpm run dev`

then visit `http://localhost:5173`

## E2E Testing

Playwright end-to-end tests live in the frontend workspace and run against a real frontend + backend + MongoDB stack.

Prerequisites:

- Node.js 18+
- `pnpm install`
- `npx playwright install chromium`
- MongoDB running locally (`docker-compose up -d mongodb`)

Run the suite:

- `pnpm --filter astriarch-frontend test:e2e`
- `pnpm --filter astriarch-frontend test:e2e:headed`
- `pnpm --filter astriarch-frontend test:e2e:ui`

Notes:

- The Playwright config starts a dedicated test backend on port `8002` and frontend on port `4173`.
- Test cleanup is performed via a test-only backend endpoint (`/api/test/cleanup`) that is enabled only when `NODE_ENV=test`.
- Add new scenarios under `apps/astriarch-frontend/e2e/scenarios` and reuse fixtures/helpers from `apps/astriarch-frontend/e2e/fixtures` and `apps/astriarch-frontend/e2e/helpers`.


## Overview

Astriarch - Ruler of the Stars is a real-time, Multi-player Space Strategy Game.
Build planetary improvements and star ships to capture planets and defeat your enemies.
Your ultimate goal is to become the master of the known universe, and earn the title of Astriarch!

## Background

Developed in 2010 by <a href="http://www.masteredsoftware.com/" target="_blank">Mastered Software</a>, Astriarch combines aspects of other classic space strategy games such as <a href="http://en.wikipedia.org/wiki/Master_of_Orion_II:_Battle_at_Antares" target="_blank" rel="nofollow">Master of Orion 2</a> (MOO2), <a href="http://hol.abime.net/3427" target="_blank" rel="nofollow">Stellar Conflict</a> (1987 Amiga), and <a href="http://en.wikipedia.org/wiki/Star_Control" target="_blank" rel="nofollow">Star Control</a>.
<br /><br />
Currently Astriarch is realeased as a free casual web game.&nbsp; Planned future enhancements include the ability to research and develop improvements, as well as galaxy special items and events.
<br /><br />
The name Astriarch comes from the Ancient Greek words for star (<a href="http://en.wiktionary.org/wiki/%E1%BC%84%CF%83%CF%84%CF%81%CE%BF%CE%BD#Ancient_Greek" target="_blank" rel="nofollow">ắstron</a>) and ruler (<a href="http://en.wiktionary.org/wiki/%E1%BC%80%CF%81%CF%87%CF%8C%CF%82" target="_blank" rel="nofollow">arkhos</a>)


## Credits

Astriarch - Ruler of the Stars, space strategy game designed and developed by <a href="http://www.masteredsoftware.com/" target="_blank">Mastered Software</a>, music by Resonant.

## License

This version of Astriarch - Ruler of the Stars is released under the MIT License.

