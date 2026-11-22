import type {
	PlanetData,
	PlanetType,
	ClientModelData,
	PlayerData,
	ClientPlayer,
	StarshipData
} from 'astriarch-engine';
import { StarShipType, Fleet } from 'astriarch-engine';
import Konva from 'konva';

// Import planet images
import planetAsteroidImage from '#lib/assets/images/planet-asteroid.png';
import planetDeadImage from '#lib/assets/images/planet-dead.png';
import planetAridImage from '#lib/assets/images/planet-arid.png';
import planetTerrestrialImage from '#lib/assets/images/planet-terestrial.png';

const PLANET_SIZE = 20; // Base planet size matching original
const PLANET_IMAGE_WIDTH = 36; // Width for planet images (wider aspect ratio)
const PLANET_IMAGE_HEIGHT = 32; // Height for planet images (shorter aspect ratio)
const SELECTION_COLOR = '#13f3fb'; // Cyan color for selection indicators

// Space platform SVG path data (extracted from space_platform.svg)
const SPACE_PLATFORM_PATH =
	'M 7.6958653,3.2861441 5.0389955,3.2902841 5.044307,4.036119 6.7058765,4.4126148 5.0501514,4.8567873 5.0566117,5.7639415 5.8962508,5.98615 5.0596539,6.1911344 5.0627023,6.6191798 5.3903794,6.983517 4.5827461,7.4685395 3.6776773,6.9989502 4.118251,6.6883587 4.1115511,6.2098655 3.2102136,5.9529947 4.1545105,5.8321729 4.1467178,4.7885653 2.4079264,4.4140722 4.1580059,4.1225342 4.1682022,3.3046399 1.475193,3.2913167 M 1.4853612,3.1581024 C 1.6080175,2.5808663 1.8906406,2.049767 2.3009308,1.6256062 3.1135027,0.78341915 4.3232033,0.45603762 5.4496076,0.77344551 6.576012,1.0908534 7.4368035,2.0016965 7.6901009,3.1442427';
const SPACE_PLATFORM_SIZE = 10; // Size for space platform icons
const SPACE_PLATFORM_ORIGINAL_SIZE = 8.467; // Original SVG viewBox size

/** First and longest delay before retrying a planet image that failed to load. */
export const IMAGE_RETRY_MIN_MS = 1000;
export const IMAGE_RETRY_MAX_MS = 30_000;

/** The delay before retry number `failures` (1-based): 1s, 2s, 4s, ... up to 30s. */
export function imageRetryDelayMs(failures: number): number {
	return Math.min(IMAGE_RETRY_MIN_MS * 2 ** Math.max(0, failures - 1), IMAGE_RETRY_MAX_MS);
}

// Image URLs whose load failure was already logged, so a load that keeps
// failing (offline, or a stale hashed asset after a redeploy) logs once.
const loggedImageFailures = new Set<string>();

/** Forgets which image failures were logged. For tests. */
export function resetImageFailureLog(): void {
	loggedImageFailures.clear();
}

export function createDrawnPlanet(planetData: PlanetData, gameModel: ClientModelData) {
	return new DrawnPlanet(planetData, gameModel);
}

export class DrawnPlanet {
	public group: Konva.Group;
	private planetData: PlanetData;
	private knownPlanetType: PlanetType | null = null;
	private gameModel: ClientModelData;
	private owner: PlayerData | ClientPlayer | null = null;
	private textBlockForeground = 'yellow';
	private textBlockStrengthForeground = 'yellow';
	private productionItemStatusColor: string | null = null;

	// Visual elements
	private planetImage: Konva.Image | null = null;
	private planetRing: Konva.Circle | null = null; // Persistent ring for all planets
	private nameText!: Konva.Text;
	private strengthTextMobile!: Konva.Text;
	private strengthTextDefense!: Konva.Text;
	private fleetStrengthIndicator: Konva.Group | null = null; // Mobile ship strength indicator (left side)
	private spacePlatformIndicators: Konva.Group | null = null; // Space platform icons (right side)
	private defenderStrengthIndicator: Konva.Group | null = null; // Defender strength indicator (far right)
	private statusIndicator: Konva.Circle | null = null;
	private waypointLine: Konva.Line | null = null;

	// Inputs the current visuals were built from. update() runs on every model
	// change; these let it skip work (and Konva redraws) when nothing visible changed.
	private requestedImageType: PlanetType | null = null;
	// Retry backoff for a planet image that failed to load. update() runs every
	// tick, so it just skips the load until imageRetryAt; no timer is needed.
	private failedImageType: PlanetType | null = null;
	private imageFailures = 0;
	private imageRetryAt = 0;
	private ringOwnerColor: string | null = null;
	private strengthIndicatorsKey = '';
	private waypointDelta: { dx: number; dy: number } | null = null;
	private destroyed = false;

	// Selection state and elements
	private isSelected: boolean = false;
	private selectionRingOuter: Konva.Circle | null = null;
	private selectionRingMiddle: Konva.Circle | null = null;
	private selectionRingInner: Konva.Circle | null = null;

	constructor(planetData: PlanetData, gameModel: ClientModelData) {
		// name/planetId/selected let tests (e.g. the perf harness) find planets on the canvas.
		this.group = new Konva.Group({ name: 'planet', planetId: planetData.id, selected: false });
		this.planetData = planetData;
		this.gameModel = gameModel;

		console.log('Creating DrawnPlanet:', {
			id: planetData.id,
			name: planetData.name,
			boundingHexMidPoint: planetData.boundingHexMidPoint,
			type: planetData.type,
			hasFleet: !!planetData.planetaryFleet?.starships?.length,
			hasBuildQueue: !!planetData.buildQueue?.length
		});

		// Position planet at its hex midpoint
		this.group.x(planetData.boundingHexMidPoint.x);
		this.group.y(planetData.boundingHexMidPoint.y);

		this.createVisualElements();
		this.update(gameModel);

		console.log('DrawnPlanet created and positioned at:', {
			x: this.group.x(),
			y: this.group.y()
		});
	}

	private createVisualElements() {
		// Planet image - will be shown when planet type is known
		this.createPlanetImage();

		// Planet ring - persistent ring for all planets (matches Figma design)
		this.createPlanetRing();

		// Planet name text - positioned below planet
		this.nameText = new Konva.Text({
			x: -30,
			y: PLANET_SIZE / 2 + 5,
			width: 60,
			text: this.planetData.name || this.planetData.id.toString(),
			fontSize: 8,
			fontFamily: 'Orbitron, monospace',
			fontStyle: 'bold',
			fill: this.textBlockForeground,
			align: 'center',
			perfectDrawEnabled: false,
			listening: false // Disable events
		});
		this.group.add(this.nameText);

		// Mobile fleet strength text - positioned top-left of planet
		this.strengthTextMobile = new Konva.Text({
			x: -28,
			y: -24,
			width: 24,
			text: '', // Will be set in updateFleetStrengthIndicator()
			fontSize: 7,
			fontFamily: 'Orbitron, monospace',
			fontStyle: 'bold',
			fill: this.textBlockStrengthForeground,
			align: 'left',
			perfectDrawEnabled: false,
			listening: false // Disable events
		});
		this.group.add(this.strengthTextMobile);

		// Defender strength text - positioned top-right of planet
		this.strengthTextDefense = new Konva.Text({
			x: 4,
			y: -24,
			width: 24,
			text: '', // Will be set in updateFleetStrengthIndicator()
			fontSize: 7,
			fontFamily: 'Orbitron, monospace',
			fontStyle: 'bold',
			fill: this.textBlockStrengthForeground,
			align: 'right',
			perfectDrawEnabled: false,
			listening: false // Disable events
		});
		this.group.add(this.strengthTextDefense);
	}

	update(gameModel: ClientModelData): void {
		this.gameModel = gameModel;

		// Update planet data reference with fresh data from the game model
		const ownedPlanet = gameModel.mainPlayerOwnedPlanets[this.planetData.id];
		if (ownedPlanet) {
			// Update with owned planet data (full PlanetData)
			this.planetData = ownedPlanet;
		} else {
			// Check if this is a known client planet and update accordingly
			const clientPlanet = gameModel.clientPlanets.find((cp) => cp.id === this.planetData.id);
			if (clientPlanet) {
				// Update the planet data with fresh client data while preserving the original type structure
				this.planetData = {
					...this.planetData, // Keep existing data structure
					name: clientPlanet.name,
					originPoint: clientPlanet.originPoint,
					boundingHexMidPoint: clientPlanet.boundingHexMidPoint,
					// Only update type if clientPlanet has a non-null type
					...(clientPlanet.type && { type: clientPlanet.type })
				};
			}
		}

		// Enhanced owner detection using multiple data sources
		this.owner = null;

		// Check if this planet is owned by the main player
		if (gameModel.mainPlayerOwnedPlanets[this.planetData.id]) {
			this.owner = gameModel.mainPlayer;
			//console.log(`Planet ${this.planetData.name} (${this.planetData.id}) is owned by main player`);
		} else {
			// Check for other players' ownership using lastKnownPlanetFleetStrength
			const lastKnownData = gameModel.mainPlayer.lastKnownPlanetFleetStrength[this.planetData.id];
			if (lastKnownData?.lastKnownOwnerId) {
				// Find the player with this ID
				const knownOwner = gameModel.clientPlayers.find(
					(player) => player.id === lastKnownData.lastKnownOwnerId
				);
				if (knownOwner) {
					this.owner = knownOwner;
					//console.log(`Planet ${this.planetData.name} (${this.planetData.id}) last known owner: ${knownOwner.name} (cycle ${lastKnownData.cycleLastExplored})`);
				} else {
					//console.log(`Planet ${this.planetData.name} (${this.planetData.id}) has unknown owner ID: ${lastKnownData.lastKnownOwnerId}`);
				}
			} else {
				if (lastKnownData) {
					//console.log(`Planet ${this.planetData.name} (${this.planetData.id}) was explored but has no known owner (cycle ${lastKnownData.cycleLastExplored})`);
				} else {
					//console.log(`Planet ${this.planetData.name} (${this.planetData.id}) has never been explored`);
				}
			}
		}

		// Update planet type if available and planet is known (explored)
		// Check if this planet is in the player's known planets list
		const isKnownPlanet = gameModel.mainPlayer.knownPlanetIds.includes(this.planetData.id);

		if (isKnownPlanet && this.planetData.type) {
			this.knownPlanetType = this.planetData.type;
		} else {
			this.knownPlanetType = null;
		}

		this.updateVisuals();
	}

	private updateVisuals(): void {
		this.updatePlanetAppearance();
		this.updatePlanetImage();
		this.updatePlanetRing();
		this.updateFleetStrengthIndicator();
		this.updateProductionStatus();
		this.updateSelectionState();
		this.updateWaypointLine();
	}

	private getPlanetImageUrl(planetType: PlanetType): string {
		switch (planetType) {
			case 1: // AsteroidBelt
				return planetAsteroidImage;
			case 2: // DeadPlanet
				return planetDeadImage;
			case 3: // PlanetClass1 (Arid)
				return planetAridImage;
			case 4: // PlanetClass2 (Terrestrial)
				return planetTerrestrialImage;
			default:
				return planetAridImage; // fallback
		}
	}

	private createPlanetImage(): void {
		// Planet image will be created/updated when we know the planet type
		this.planetImage = null;
	}

	private createPlanetRing(): void {
		// Planet ring will be created for all planets
		this.planetRing = null;
	}

	private updatePlanetImage(): void {
		// Only show planet image if we know the planet type (explored)
		if (!this.knownPlanetType) {
			this.planetImage?.visible(false);
			return;
		}
		if (this.knownPlanetType === this.requestedImageType) {
			// Already loaded (or loading) the right image
			this.planetImage?.visible(true);
			return;
		}

		if (this.knownPlanetType === this.failedImageType && performance.now() < this.imageRetryAt) {
			// Backing off after a failed load of this type
			return;
		}

		const planetType = this.knownPlanetType;
		this.requestedImageType = planetType;
		const imageUrl = this.getPlanetImageUrl(planetType);
		const imageObj = new Image();

		imageObj.onload = () => {
			// Ignore a load that was superseded by a newer type, or a destroyed planet
			if (this.destroyed || this.requestedImageType !== planetType) return;
			this.failedImageType = null;
			this.imageFailures = 0;

			if (this.planetImage) {
				this.planetImage.image(imageObj);
				this.planetImage.visible(true);
				return;
			}

			this.planetImage = new Konva.Image({
				x: -PLANET_IMAGE_WIDTH / 2,
				y: -PLANET_IMAGE_HEIGHT / 2,
				width: PLANET_IMAGE_WIDTH,
				height: PLANET_IMAGE_HEIGHT,
				image: imageObj,
				visible: true,
				perfectDrawEnabled: false,
				listening: false // Disable events
			});

			// Add image to the group
			this.group.add(this.planetImage);

			// Proper layering: planet image at bottom, then ring on top, then UI elements
			this.planetImage.moveToBottom();
			if (this.planetRing) {
				this.planetRing.moveUp(); // Move ring above planet image
			}
		};

		imageObj.onerror = (error) => {
			if (!loggedImageFailures.has(imageUrl)) {
				loggedImageFailures.add(imageUrl);
				console.error(`Failed to load planet image for ${this.planetData.name}:`, error, imageUrl);
			}
			// Let a later update() retry with backoff, unless a newer type was requested since
			if (!this.destroyed && this.requestedImageType === planetType) {
				this.requestedImageType = null;
				if (this.failedImageType !== planetType) {
					this.failedImageType = planetType;
					this.imageFailures = 0;
				}
				this.imageFailures++;
				this.imageRetryAt = performance.now() + imageRetryDelayMs(this.imageFailures);
			}
		};

		imageObj.src = imageUrl;
	}

	private updatePlanetRing(): void {
		// Persistent ring for all planets; its gradient reflects the owner color
		const ownerColor = this.owner ? this.getOwnerColor() : null;
		if (this.planetRing && ownerColor === this.ringOwnerColor) return;
		this.ringOwnerColor = ownerColor;

		// Metallic gradient matching the Figma design, tinted with the owner color if owned
		const colorStops = ownerColor
			? [0, '#313E46', 0.31, ownerColor + '88', 0.51, '#FFFFFF', 1, ownerColor + 'D4']
			: [0, '#313E46', 0.31, '#A0B0BA88', 0.51, '#FFFFFF', 1, '#69747BD4'];
		const opacity = ownerColor ? 0.8 : 0.7;

		if (this.planetRing) {
			// Konva rebuilds stroke gradients on every draw, so update in place
			this.planetRing.strokeLinearGradientColorStops(colorStops);
			this.planetRing.opacity(opacity);
			return;
		}

		const ringRadius = PLANET_SIZE / 2 + 4; // 4px larger than planet radius
		this.planetRing = new Konva.Circle({
			x: 0,
			y: 0,
			radius: ringRadius,
			fill: 'transparent',
			strokeLinearGradientStartPoint: { x: -ringRadius * 2, y: -ringRadius * 2 },
			strokeLinearGradientEndPoint: { x: ringRadius * 2, y: ringRadius * 2 },
			strokeLinearGradientColorStops: colorStops,
			strokeWidth: 2,
			opacity,
			shadowColor: 'black',
			shadowBlur: 2,
			shadowOffset: { x: 0, y: 2 },
			shadowOpacity: 0.25,
			visible: true,
			perfectDrawEnabled: false,
			shadowForStrokeEnabled: false,
			listening: false // Disable events
		});

		// Add ring and position it above planet image
		this.group.add(this.planetRing);

		// Proper layering: planet image at bottom, then ring on top, then UI elements on top
		if (this.planetImage) {
			this.planetImage.moveToBottom();
			this.planetRing.moveUp(); // Move ring above planet image
		}
	}

	private getOwnerColor(): string {
		if (!this.owner) return '#FFFFFF';

		const ownerColor = this.owner.color;
		if (typeof ownerColor === 'string') {
			// Ensure it's in hex format for gradient concatenation
			const colorStr = ownerColor as string;
			return colorStr.startsWith('#')
				? colorStr
				: colorStr.startsWith('rgb')
					? this.rgbToHex(colorStr)
					: colorStr;
		} else if (ownerColor && typeof ownerColor === 'object') {
			// Convert ColorRgbaData to hex
			const r = Math.round(ownerColor.r || 0);
			const g = Math.round(ownerColor.g || 0);
			const b = Math.round(ownerColor.b || 0);
			return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
		}
		return '#FFFFFF';
	}

	private rgbToHex(rgb: string): string {
		// Simple rgb() to hex conversion
		const match = rgb.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
		if (match && match[1] && match[2] && match[3]) {
			const r = parseInt(match[1]).toString(16).padStart(2, '0');
			const g = parseInt(match[2]).toString(16).padStart(2, '0');
			const b = parseInt(match[3]).toString(16).padStart(2, '0');
			return `#${r}${g}${b}`;
		}
		return '#FFFFFF';
	}

	private updatePlanetAppearance(): void {
		// This method previously updated planet circle colors
		// Now that we use planet images and rings, this is a placeholder
		// Could be used for future planet appearance customizations
	}

	private calculateMobileStrength(): number {
		let mobileStrength = 0;

		// For owned planets with planetary fleet data
		if (this.owner && this.owner.id === this.gameModel.mainPlayer.id) {
			// Calculate mobile fleet strength (only mobile ships)
			mobileStrength =
				this.planetData.planetaryFleet.starships
					.filter((ship) => Fleet.starshipTypeIsMobile(ship.type))
					.reduce((total: number, ship: StarshipData) => total + ship.health, 0) ?? 0;
			return mobileStrength;
		}

		// For non-owned or other players' planets, check last known fleet data
		const lastKnownData =
			this.gameModel.mainPlayer.lastKnownPlanetFleetStrength[this.planetData.id];
		if (lastKnownData?.fleetData?.starships?.length) {
			mobileStrength = lastKnownData.fleetData.starships
				.filter((ship) => Fleet.starshipTypeIsMobile(ship.type))
				.reduce((total: number, ship: StarshipData) => total + ship.health, 0);
		}

		return mobileStrength;
	}

	private calculateDefenderStrength(): number {
		let defenderStrength = 0;

		// For owned planets with planetary fleet data
		if (this.owner && this.owner.id === this.gameModel.mainPlayer.id) {
			// Calculate defender strength (SystemDefense ships only)
			defenderStrength = this.planetData.planetaryFleet.starships
				.filter((ship) => ship.type === StarShipType.SystemDefense)
				.reduce((total: number, ship: StarshipData) => total + ship.health, 0);
			return defenderStrength;
		}
		// For non-owned or other players' planets, check last known fleet data
		const lastKnownData =
			this.gameModel.mainPlayer.lastKnownPlanetFleetStrength[this.planetData.id];
		if (lastKnownData?.fleetData?.starships?.length) {
			defenderStrength = lastKnownData.fleetData.starships
				.filter((ship) => ship.type === StarShipType.SystemDefense)
				.reduce((total: number, ship: StarshipData) => total + ship.health, 0);
		}

		return defenderStrength;
	}

	private getPlatformCount(): number {
		let platformCount = 0;

		// For owned planets with planetary fleet data
		if (this.owner && this.owner.id === this.gameModel.mainPlayer.id) {
			// Count space platforms
			platformCount = this.planetData.planetaryFleet.starships.filter(
				(ship) => ship.type === StarShipType.SpacePlatform
			).length;
		}
		// For non-owned or other players' planets, check last known fleet data
		else {
			const lastKnownData =
				this.gameModel.mainPlayer.lastKnownPlanetFleetStrength[this.planetData.id];
			if (lastKnownData?.fleetData?.starships?.length) {
				platformCount = lastKnownData.fleetData.starships.filter(
					(ship) => ship.type === StarShipType.SpacePlatform
				).length;
			}
		}

		return platformCount;
	}

	private updateFleetStrengthIndicator(): void {
		const mobileStrength = this.calculateMobileStrength();
		const defenderStrength = this.calculateDefenderStrength();
		const platformCount = this.getPlatformCount();

		// Rebuild the dot/platform indicators only when what they show changes
		const mobileDots = mobileStrength > 0 ? this.calculateRelativeStrength(mobileStrength) : 0;
		const defenderDots =
			defenderStrength > 0 ? this.calculateRelativeStrength(defenderStrength) : 0;
		const ownerColor = this.owner ? this.getOwnerColor() : null;
		const key = `${mobileDots}|${defenderDots}|${platformCount}|${ownerColor}`;
		if (key !== this.strengthIndicatorsKey) {
			this.strengthIndicatorsKey = key;
			this.rebuildStrengthIndicators(mobileDots, defenderDots, platformCount);
		}

		// Update text-based strength displays (no-op in Konva when unchanged)
		const mobileText = mobileStrength > 0 ? Math.round(mobileStrength).toString() : '';
		this.strengthTextMobile.text(mobileText);

		const defenseText = defenderStrength > 0 ? Math.round(defenderStrength).toString() : '';
		this.strengthTextDefense.text(defenseText);
	}

	private rebuildStrengthIndicators(
		mobileDots: number,
		defenderDots: number,
		platformCount: number
	): void {
		// Remove existing indicators
		if (this.fleetStrengthIndicator) {
			this.fleetStrengthIndicator.destroy();
			this.fleetStrengthIndicator = null;
		}
		if (this.spacePlatformIndicators) {
			this.spacePlatformIndicators.destroy();
			this.spacePlatformIndicators = null;
		}
		if (this.defenderStrengthIndicator) {
			this.defenderStrengthIndicator.destroy();
			this.defenderStrengthIndicator = null;
		}

		// Show mobile ship strength indicator (left side)
		if (mobileDots > 0) {
			this.createFleetStrengthIndicator(mobileDots);
		}

		// Show space platform indicators (right side)
		if (platformCount > 0) {
			this.createSpacePlatformIndicators(platformCount);
		}

		// Show defender strength indicator (far right)
		if (defenderDots > 0) {
			this.createDefenderStrengthIndicator(defenderDots);
		}
	}

	private createSpacePlatformIndicators(platformCount: number): void {
		// Get owner color for the platforms
		const ownerColor = this.owner ? this.getOwnerColor() : '#90a9ba';

		// Create group for the platform indicators
		this.spacePlatformIndicators = new Konva.Group({
			perfectDrawEnabled: false,
			listening: false
		});

		// Maximum 5 platforms, positioned counter-clockwise starting from bottom-right
		const maxPlatforms = Math.min(platformCount, 5);
		const arcRadius = 28; // Distance from planet center (beyond defenders)

		// Specific angles for each platform position (counter-clockwise from bottom-right)
		// Position 1: bottom right, Position 2: bottom middle-right, Position 3: right
		// Position 4: top middle-right, Position 5: top right
		const platformAngles = [45, 15, -15, -45, -75]; // In degrees

		// Create platform icons at each position
		for (let i = 0; i < maxPlatforms; i++) {
			const angle = platformAngles[i];
			if (angle === undefined) continue;
			const angleRad = (angle * Math.PI) / 180;

			// Calculate position on the arc
			const x = Math.cos(angleRad) * arcRadius;
			const y = Math.sin(angleRad) * arcRadius;

			// Create the platform icon using SVG path (filled with owner color)
			const platform = new Konva.Path({
				data: SPACE_PLATFORM_PATH,
				x: x,
				y: y,
				fill: ownerColor, // Filled instead of transparent
				stroke: ownerColor,
				strokeWidth: 0.5,
				scaleX: SPACE_PLATFORM_SIZE / SPACE_PLATFORM_ORIGINAL_SIZE,
				scaleY: SPACE_PLATFORM_SIZE / SPACE_PLATFORM_ORIGINAL_SIZE,
				offsetX: SPACE_PLATFORM_ORIGINAL_SIZE / 2,
				offsetY: SPACE_PLATFORM_ORIGINAL_SIZE / 2,
				opacity: 0.9,
				perfectDrawEnabled: false,
				shadowForStrokeEnabled: false,
				listening: false
			});

			this.spacePlatformIndicators.add(platform);
		}

		// Add the indicators to the main group
		this.group.add(this.spacePlatformIndicators);
	}

	private createDefenderStrengthIndicator(relativeStrength: number): void {
		// Get owner color for the dots
		const ownerColor = this.owner ? this.getOwnerColor() : '#FFFFFF';

		// Create group for the defender indicator - positioned hugging the right side of the planet
		this.defenderStrengthIndicator = new Konva.Group({
			x: PLANET_SIZE / 2 + 8, // Position close to planet edge
			y: 0, // Centered vertically on the planet
			perfectDrawEnabled: false,
			listening: false
		});

		// Use same dot sizing as mobile fleet indicator
		const dotSize = 4;
		const dotSpacing = 2;
		const maxDots = 5; // Single column only, max 5 dots

		// Limit to single column (max 5 dots)
		const dotsToShow = Math.min(relativeStrength, maxDots);

		// Create dots in a single vertical column
		for (let i = 0; i < dotsToShow; i++) {
			// Position dots vertically from bottom up
			const y =
				(maxDots - 1 - i) * (dotSize + dotSpacing) - ((maxDots - 1) * (dotSize + dotSpacing)) / 2;

			const dot = new Konva.Circle({
				x: 0, // Single column at x=0
				y: y,
				radius: dotSize / 2,
				fill: ownerColor,
				stroke: 'black',
				strokeWidth: 0.5,
				opacity: 0.9,
				perfectDrawEnabled: false,
				shadowForStrokeEnabled: false,
				listening: false
			});
			this.defenderStrengthIndicator.add(dot);
		}

		// Add the indicator to the main group
		this.group.add(this.defenderStrengthIndicator);
	}

	private createFleetStrengthIndicator(relativeStrength: number): void {
		// Get owner color for the dots
		const ownerColor = this.owner ? this.getOwnerColor() : '#FFFFFF';

		// Create group for the indicator - positioned to the left of the planet
		this.fleetStrengthIndicator = new Konva.Group({
			x: -PLANET_SIZE / 2 - 8, // Position to the left of the planet
			y: 0, // Centered vertically on the planet
			perfectDrawEnabled: false,
			listening: false // Disable events
		});

		// Larger, more visible dots
		const dotSize = 4; // Increased from 2
		const dotSpacing = 2; // Spacing between dots
		const maxDotsPerColumn = 5; // Maximum dots in a single column
		const columnSpacing = 6; // Spacing between columns

		// Create dots in vertical columns, starting from bottom
		for (let i = 0; i < relativeStrength; i++) {
			const columnIndex = Math.floor(i / maxDotsPerColumn);
			const dotInColumn = i % maxDotsPerColumn;

			// Position dots vertically from bottom up
			const x = -(columnIndex * columnSpacing);
			const y =
				(maxDotsPerColumn - 1 - dotInColumn) * (dotSize + dotSpacing) -
				((maxDotsPerColumn - 1) * (dotSize + dotSpacing)) / 2;

			const dot = new Konva.Circle({
				x: x,
				y: y,
				radius: dotSize / 2,
				fill: ownerColor,
				stroke: 'black',
				strokeWidth: 0.5,
				opacity: 0.9,
				perfectDrawEnabled: false,
				shadowForStrokeEnabled: false,
				listening: false // Disable events
			});
			this.fleetStrengthIndicator.add(dot);
		}

		// Add the indicator to the main group
		this.group.add(this.fleetStrengthIndicator);
	}

	private calculateRelativeStrength(fleetStrength: number): number {
		// Collect all known fleet strengths across the galaxy to establish relative scale
		const allFleetStrengths: number[] = [];

		// Add fleet strengths from owned planets
		Object.entries(this.gameModel.mainPlayerOwnedPlanets).forEach(([, planetData]) => {
			if (planetData?.planetaryFleet?.starships?.length) {
				const strength = planetData.planetaryFleet.starships.reduce(
					(total: number, ship: StarshipData) => total + ship.health,
					0
				);
				if (strength > 0) allFleetStrengths.push(strength);
			}
		});

		// Add fleet strengths from last known data for all planets
		Object.values(this.gameModel.mainPlayer.lastKnownPlanetFleetStrength).forEach((knownData) => {
			if (knownData?.fleetData?.starships?.length) {
				const strength = knownData.fleetData.starships.reduce(
					(total: number, ship: StarshipData) => total + ship.health,
					0
				);
				if (strength > 0) allFleetStrengths.push(strength);
			}
		});

		// If no other fleets are known, use a simple 1-dot system
		if (allFleetStrengths.length <= 1) {
			return 1;
		}

		// Sort fleet strengths to establish percentiles
		allFleetStrengths.sort((a, b) => a - b);

		// Calculate percentile of current fleet strength
		const position = allFleetStrengths.findIndex((strength) => strength >= fleetStrength);
		const percentile = position >= 0 ? position / (allFleetStrengths.length - 1) : 1;

		// Map percentile to dot count (1-15 dots, allowing for multiple columns)
		// Bottom 20% = 1-2 dots, next 20% = 3-4 dots, etc.
		if (percentile <= 0.1) return 1; // Bottom 10%
		if (percentile <= 0.25) return 2; // Bottom 25%
		if (percentile <= 0.4) return 3; // Bottom 40%
		if (percentile <= 0.55) return 4; // Bottom 55%
		if (percentile <= 0.7) return 5; // Bottom 70%
		if (percentile <= 0.8) return 7; // Bottom 80%
		if (percentile <= 0.9) return 9; // Bottom 90%
		if (percentile <= 0.95) return 12; // Bottom 95%
		return 15; // Top 5% - maximum dots
	}

	private updateProductionStatus(): void {
		// Show production indicator for owned planets with build queue
		if (this.owner && this.planetData.buildQueue?.length > 0) {
			// Determine production status color based on the first item in queue
			const firstItem = this.planetData.buildQueue[0];
			if (firstItem) {
				// Color based on production item type or completion status
				if (firstItem.turnsToComplete <= 1) {
					this.productionItemStatusColor = 'lime'; // Almost complete
				} else if (firstItem.resourcesSpent) {
					this.productionItemStatusColor = 'yellow'; // In progress
				} else {
					this.productionItemStatusColor = 'orange'; // Waiting for resources
				}
			} else {
				this.productionItemStatusColor = 'gray'; // Unknown status
			}
			this.showProductionIndicator();
		} else if (this.statusIndicator) {
			this.statusIndicator.destroy();
			this.statusIndicator = null;
			this.productionItemStatusColor = null;
		}
	}

	private showProductionIndicator(): void {
		if (this.statusIndicator) {
			this.statusIndicator.fill(this.productionItemStatusColor || 'yellow');
		} else {
			this.statusIndicator = new Konva.Circle({
				x: PLANET_SIZE / 2 - 3,
				y: -PLANET_SIZE / 2 + 3,
				radius: 3,
				fill: this.productionItemStatusColor || 'yellow',
				stroke: 'black',
				strokeWidth: 1,
				perfectDrawEnabled: false,
				shadowForStrokeEnabled: false,
				listening: false // Disable events
			});
			this.group.add(this.statusIndicator);
		}
	}

	private createSelectionRings(): void {
		if (!this.selectionRingOuter) {
			// Outer selection ring (matches Figma design: white stroke, 16% opacity, thick stroke)
			this.selectionRingOuter = new Konva.Circle({
				x: 0,
				y: 0,
				radius: 26,
				fill: 'transparent',
				stroke: 'white', // White stroke like Figma
				strokeWidth: 6, // Thick stroke like Figma: stroke-width="14"
				opacity: 0.16, // Low opacity like Figma: stroke-opacity="0.16"
				visible: false,
				perfectDrawEnabled: false,
				shadowForStrokeEnabled: false,
				listening: false // Disable events
			});
			this.group.add(this.selectionRingOuter);

			// Middle selection ring (complex gradient design matching Figma)
			this.selectionRingMiddle = new Konva.Circle({
				x: 0,
				y: 0,
				radius: 22, // Smaller than outer ring
				fill: 'transparent',
				strokeLinearGradientStartPoint: { x: -25, y: -25 },
				strokeLinearGradientEndPoint: { x: 25, y: 25 },
				strokeLinearGradientColorStops: [
					0,
					'#313E46', // Dark start
					0.31,
					'#A0B0BA88', // Semi-transparent light gray
					0.51,
					'#FFFFFF', // White middle
					1,
					'#69747BD4' // Semi-transparent dark gray end
				],
				strokeWidth: 1,
				opacity: 1.0, // Full opacity since gradient handles transparency
				shadowColor: 'black',
				shadowBlur: 4,
				shadowOffset: { x: 0, y: 4 },
				shadowOpacity: 0.25,
				visible: false,
				perfectDrawEnabled: false,
				shadowForStrokeEnabled: false,
				listening: false // Disable events
			});
			this.group.add(this.selectionRingMiddle);

			// Inner selection ring (cyan, thin)
			this.selectionRingInner = new Konva.Circle({
				x: 0,
				y: 0,
				radius: 18, // Just outside the planet/ownership ring
				fill: 'transparent',
				stroke: SELECTION_COLOR,
				strokeWidth: 1,
				opacity: 0.6,
				visible: false,
				perfectDrawEnabled: false,
				shadowForStrokeEnabled: false,
				listening: false // Disable events
			});
			this.group.add(this.selectionRingInner);

			// The rings are created lazily, after the indicators exist; keep the
			// indicators drawn above them (rebuilds add indicators at the top).
			this.raiseStrengthIndicators();
		}
	}

	private raiseStrengthIndicators(): void {
		this.fleetStrengthIndicator?.moveToTop();
		this.spacePlatformIndicators?.moveToTop();
		this.defenderStrengthIndicator?.moveToTop();
	}

	private updateSelectionState(): void {
		if (this.isSelected) {
			this.createSelectionRings();

			if (this.selectionRingOuter) this.selectionRingOuter.visible(true);
			if (this.selectionRingMiddle) this.selectionRingMiddle.visible(true);
			if (this.selectionRingInner) this.selectionRingInner.visible(true);

			// Update text color to selection color when selected
			this.nameText.fill(SELECTION_COLOR);
		} else {
			// Hide selection rings
			if (this.selectionRingOuter) this.selectionRingOuter.visible(false);
			if (this.selectionRingMiddle) this.selectionRingMiddle.visible(false);
			if (this.selectionRingInner) this.selectionRingInner.visible(false);

			// Restore normal text color
			this.nameText.fill(this.textBlockForeground);
		}
	}

	// Public methods
	getPlanetData(): PlanetData {
		return this.planetData;
	}

	setSelected(selected: boolean): void {
		this.isSelected = selected;
		this.group.setAttr('selected', selected);
		this.updateSelectionState();
	}

	getSelected(): boolean {
		return this.isSelected;
	}

	private updateWaypointLine(): void {
		// Check if this planet has a waypoint set
		if (this.planetData.waypointBoundingHexMidPoint) {
			const dx =
				this.planetData.waypointBoundingHexMidPoint.x - this.planetData.boundingHexMidPoint.x;
			const dy =
				this.planetData.waypointBoundingHexMidPoint.y - this.planetData.boundingHexMidPoint.y;

			// Create or update waypoint line with gradient transparency
			if (this.waypointLine && this.waypointDelta?.dx === dx && this.waypointDelta.dy === dy) {
				this.waypointLine.visible(true);
				return;
			}
			this.waypointDelta = { dx, dy };
			if (!this.waypointLine) {
				this.waypointLine = new Konva.Line({
					points: [
						0,
						0, // Start at planet center
						dx,
						dy // End at waypoint
					],
					stroke: '#7F7F7F',
					strokeWidth: 1,
					dash: [8, 4], // Dashed line to distinguish from fleet travel lines
					// Gradient opacity from opaque to transparent shows direction
					opacity: 1,
					strokeLinearGradientStartPoint: { x: 0, y: 0 },
					strokeLinearGradientEndPoint: { x: dx, y: dy },
					strokeLinearGradientColorStops: [
						0,
						'#7F7F7F',
						0.7,
						'#7F7F7F99',
						1,
						'#7F7F7F33' // Transparent at destination
					],
					perfectDrawEnabled: false,
					listening: false // Disable events
				});

				// Add line to the group, but behind other elements
				this.group.add(this.waypointLine);
				this.waypointLine.moveToBottom();

				// Move planet image above waypoint line if it exists
				if (this.planetImage) {
					this.planetImage.moveUp();
				}
				if (this.planetRing) {
					this.planetRing.moveUp();
				}
			} else {
				// Update existing line points and gradient
				this.waypointLine.points([0, 0, dx, dy]);
				this.waypointLine.strokeLinearGradientStartPoint({ x: 0, y: 0 });
				this.waypointLine.strokeLinearGradientEndPoint({ x: dx, y: dy });
				this.waypointLine.visible(true);
			}
		} else {
			// No waypoint set, hide the line if it exists
			if (this.waypointLine) {
				this.waypointLine.visible(false);
			}
		}
	}

	destroy(): void {
		this.destroyed = true;
		if (this.planetImage) {
			this.planetImage.destroy();
			this.planetImage = null;
		}
		if (this.planetRing) {
			this.planetRing.destroy();
			this.planetRing = null;
		}
		if (this.fleetStrengthIndicator) {
			this.fleetStrengthIndicator.destroy();
			this.fleetStrengthIndicator = null;
		}
		if (this.spacePlatformIndicators) {
			this.spacePlatformIndicators.destroy();
			this.spacePlatformIndicators = null;
		}
		if (this.defenderStrengthIndicator) {
			this.defenderStrengthIndicator.destroy();
			this.defenderStrengthIndicator = null;
		}
		if (this.selectionRingOuter) {
			this.selectionRingOuter.destroy();
			this.selectionRingOuter = null;
		}
		if (this.selectionRingMiddle) {
			this.selectionRingMiddle.destroy();
			this.selectionRingMiddle = null;
		}
		if (this.selectionRingInner) {
			this.selectionRingInner.destroy();
			this.selectionRingInner = null;
		}
		if (this.waypointLine) {
			this.waypointLine.destroy();
			this.waypointLine = null;
		}
		if (this.group) {
			this.group.destroy();
		}
	}

	setVisible(visible: boolean): void {
		if (this.group) {
			this.group.visible(visible);
		}
	}
}
