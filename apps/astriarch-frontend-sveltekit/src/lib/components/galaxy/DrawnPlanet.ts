import type {
	PlanetData,
	PlanetType,
	ClientModelData,
	PlayerData,
	ClientPlayer,
	StarshipData
} from 'astriarch-engine';
import Konva from 'konva';

// Import planet images
import planetAsteroidImage from '$lib/assets/images/planet-asteroid.png';
import planetDeadImage from '$lib/assets/images/planet-dead.png';
import planetAridImage from '$lib/assets/images/planet-arid.png';
import planetTerrestrialImage from '$lib/assets/images/planet-terestrial.png';

const PLANET_SIZE = 20; // Base planet size matching original
const PLANET_IMAGE_WIDTH = 36; // Width for planet images (wider aspect ratio)
const PLANET_IMAGE_HEIGHT = 32; // Height for planet images (shorter aspect ratio)
const SELECTION_COLOR = '#13f3fb'; // Cyan color for selection indicators

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
	private textBlockStrengthText = '';
	private productionItemStatusColor: string | null = null;

	// Visual elements
	private planetImage: Konva.Image | null = null;
	private planetRing: Konva.Circle | null = null; // Persistent ring for all planets
	private nameText!: Konva.Text;
	private strengthText!: Konva.Text;
	private fleetStrengthIndicator: Konva.Group | null = null; // New visual fleet strength indicator
	private platformIcon: Konva.Rect | null = null;
	private statusIndicator: Konva.Circle | null = null;
	private waypointLine: Konva.Line | null = null;

	// Selection state and elements
	private isSelected: boolean = false;
	private selectionRingOuter: Konva.Circle | null = null;
	private selectionRingMiddle: Konva.Circle | null = null;
	private selectionRingInner: Konva.Circle | null = null;

	constructor(planetData: PlanetData, gameModel: ClientModelData) {
		this.group = new Konva.Group();
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
			align: 'center'
		});
		this.group.add(this.nameText);

		// Fleet strength text - positioned above planet
		this.strengthText = new Konva.Text({
			x: -20,
			y: -20,
			width: 40,
			text: this.textBlockStrengthText,
			fontSize: 7,
			fontFamily: 'Orbitron, monospace',
			fontStyle: 'bold',
			fill: this.textBlockStrengthForeground,
			align: 'center'
		});
		this.group.add(this.strengthText);
	}

	update(gameModel: ClientModelData): void {
		this.gameModel = gameModel;

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
		if (this.knownPlanetType) {
			if (!this.planetImage) {
				// Create new image
				const imageObj = new Image();
				const imageUrl = this.getPlanetImageUrl(this.knownPlanetType);

				imageObj.onload = () => {
					this.planetImage = new Konva.Image({
						x: -PLANET_IMAGE_WIDTH / 2,
						y: -PLANET_IMAGE_HEIGHT / 2,
						width: PLANET_IMAGE_WIDTH,
						height: PLANET_IMAGE_HEIGHT,
						image: imageObj,
						visible: true
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
					console.error(
						`Failed to load planet image for ${this.planetData.name}:`,
						error,
						imageUrl
					);
				};

				imageObj.src = imageUrl;
			} else {
				// Update existing image if planet type changed
				const newImageUrl = this.getPlanetImageUrl(this.knownPlanetType);

				const imageObj = new Image();
				imageObj.onload = () => {
					if (this.planetImage) {
						this.planetImage.image(imageObj);
						this.planetImage.visible(true);
					}
				};

				imageObj.onerror = (error) => {
					console.error(
						`Failed to update planet image for ${this.planetData.name}:`,
						error,
						newImageUrl
					);
				};

				imageObj.src = newImageUrl;
			}
		} else {
			// Hide planet image and show fallback circle for unexplored planets
			if (this.planetImage) {
				this.planetImage.visible(false);
			}
		}
	}

	private updatePlanetRing(): void {
		// Create persistent ring for all planets
		const ringRadius = PLANET_SIZE / 2 + 4; // 4px larger than planet radius

		if (!this.planetRing) {
			// Create sophisticated metallic ring with gradient matching Figma design
			const ownerColor = this.owner ? this.getOwnerColor() : null;

			if (ownerColor) {
				// For owned planets, create a gradient that incorporates the owner color
				this.planetRing = new Konva.Circle({
					x: 0,
					y: 0,
					radius: ringRadius,
					fill: 'transparent',
					strokeLinearGradientStartPoint: { x: -ringRadius * 2, y: -ringRadius * 2 },
					strokeLinearGradientEndPoint: { x: ringRadius * 2, y: ringRadius * 2 },
					strokeLinearGradientColorStops: [
						0,
						'#313E46', // Dark metallic start
						0.31,
						ownerColor + '88', // Owner color with transparency
						0.51,
						'#FFFFFF', // White highlight
						1,
						ownerColor + 'D4' // Owner color with more transparency
					],
					strokeWidth: 2,
					opacity: 0.8,
					shadowColor: 'black',
					shadowBlur: 2,
					shadowOffset: { x: 0, y: 2 },
					shadowOpacity: 0.25,
					visible: true
				});
			} else {
				// For unowned planets, use the original metallic gradient from Figma
				this.planetRing = new Konva.Circle({
					x: 0,
					y: 0,
					radius: ringRadius,
					fill: 'transparent',
					strokeLinearGradientStartPoint: { x: -ringRadius * 2, y: -ringRadius * 2 },
					strokeLinearGradientEndPoint: { x: ringRadius * 2, y: ringRadius * 2 },
					strokeLinearGradientColorStops: [
						0,
						'#313E46', // Dark metallic start
						0.31,
						'#A0B0BA88', // Semi-transparent light metallic
						0.51,
						'#FFFFFF', // White highlight
						1,
						'#69747BD4' // Semi-transparent dark metallic end
					],
					strokeWidth: 2,
					opacity: 0.7,
					shadowColor: 'black',
					shadowBlur: 2,
					shadowOffset: { x: 0, y: 2 },
					shadowOpacity: 0.25,
					visible: true
				});
			}

			// Add ring and position it above planet image
			this.group.add(this.planetRing);

			// Proper layering: planet image at bottom, then ring on top, then UI elements on top
			if (this.planetImage) {
				this.planetImage.moveToBottom();
				this.planetRing.moveUp(); // Move ring above planet image
			}
		} else {
			// Update existing ring - need to recreate for gradient changes
			this.planetRing.destroy();
			this.planetRing = null;

			// Recreate with new gradient
			const ownerColor = this.owner ? this.getOwnerColor() : null;

			if (ownerColor) {
				// For owned planets, create a gradient that incorporates the owner color
				this.planetRing = new Konva.Circle({
					x: 0,
					y: 0,
					radius: ringRadius,
					fill: 'transparent',
					strokeLinearGradientStartPoint: { x: -ringRadius * 2, y: -ringRadius * 2 },
					strokeLinearGradientEndPoint: { x: ringRadius * 2, y: ringRadius * 2 },
					strokeLinearGradientColorStops: [
						0,
						'#313E46', // Dark metallic start
						0.31,
						ownerColor + '88', // Owner color with transparency
						0.51,
						'#FFFFFF', // White highlight
						1,
						ownerColor + 'D4' // Owner color with more transparency
					],
					strokeWidth: 2,
					opacity: 0.8,
					shadowColor: 'black',
					shadowBlur: 2,
					shadowOffset: { x: 0, y: 2 },
					shadowOpacity: 0.25,
					visible: true
				});
			} else {
				// For unowned planets, use the original metallic gradient from Figma
				this.planetRing = new Konva.Circle({
					x: 0,
					y: 0,
					radius: ringRadius,
					fill: 'transparent',
					strokeLinearGradientStartPoint: { x: -ringRadius * 2, y: -ringRadius * 2 },
					strokeLinearGradientEndPoint: { x: ringRadius * 2, y: ringRadius * 2 },
					strokeLinearGradientColorStops: [
						0,
						'#313E46', // Dark metallic start
						0.31,
						'#A0B0BA88', // Semi-transparent light metallic
						0.51,
						'#FFFFFF', // White highlight
						1,
						'#69747BD4' // Semi-transparent dark metallic end
					],
					strokeWidth: 2,
					opacity: 0.7,
					shadowColor: 'black',
					shadowBlur: 2,
					shadowOffset: { x: 0, y: 2 },
					shadowOpacity: 0.25,
					visible: true
				});
			}

			// Add to group and position properly
			this.group.add(this.planetRing);

			// Proper layering: planet image at bottom, then ring on top, then UI elements on top
			if (this.planetImage) {
				this.planetImage.moveToBottom();
				this.planetRing.moveUp(); // Move ring above planet image
			}
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
		if (match) {
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

	private calculateFleetStrength(): number {
		let fleetStrength = 0;

		// For owned planets with planetary fleet data
		if (
			this.owner &&
			this.owner.id === this.gameModel.mainPlayer.id &&
			this.planetData.planetaryFleet?.starships?.length
		) {
			// Calculate total fleet strength (sum of all ship health/strength)
			fleetStrength = this.planetData.planetaryFleet.starships.reduce(
				(total: number, ship: StarshipData) => total + ship.health,
				0
			);
		}
		// For non-owned or other players' planets, check last known fleet data
		else {
			const lastKnownData =
				this.gameModel.mainPlayer.lastKnownPlanetFleetStrength[this.planetData.id];
			if (lastKnownData?.fleetData?.starships?.length) {
				// Calculate last known fleet strength
				fleetStrength = lastKnownData.fleetData.starships.reduce(
					(total: number, ship: StarshipData) => total + ship.health,
					0
				);
			}
			// Also check current planetary fleet for visible data
			else if (this.planetData.planetaryFleet?.starships?.length) {
				// We can see there are ships, use a default strength value
				fleetStrength = this.planetData.planetaryFleet.starships.reduce(
					(total: number, ship: StarshipData) => total + ship.health,
					0
				);
			}
		}

		return fleetStrength;
	}

	private updateFleetStrengthIndicator(): void {
		const fleetStrength = this.calculateFleetStrength();

		// Remove existing indicator
		if (this.fleetStrengthIndicator) {
			this.fleetStrengthIndicator.destroy();
			this.fleetStrengthIndicator = null;
		}

		// Only show indicator if there's a fleet
		if (fleetStrength > 0) {
			this.createFleetStrengthIndicator(fleetStrength);
		}

		// Clear the old text-based strength display
		this.strengthText.text('');
		this.textBlockStrengthText = '';
	}

	private createFleetStrengthIndicator(fleetStrength: number): void {
		// Calculate relative strength based on all known fleet strengths
		const relativeStrength = this.calculateRelativeStrength(fleetStrength);

		// Get owner color for the dots
		const ownerColor = this.owner ? this.getOwnerColor() : '#FFFFFF';

		// Create group for the indicator - positioned to the left of the planet
		this.fleetStrengthIndicator = new Konva.Group({
			x: -PLANET_SIZE / 2 - 8, // Position to the left of the planet
			y: 0 // Centered vertically on the planet
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
				opacity: 0.9
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
		if (!this.statusIndicator) {
			this.statusIndicator = new Konva.Circle({
				x: PLANET_SIZE / 2 - 3,
				y: -PLANET_SIZE / 2 + 3,
				radius: 3,
				fill: this.productionItemStatusColor || 'yellow',
				stroke: 'black',
				strokeWidth: 1
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
				listening: false
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
				listening: false
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
				listening: false
			});
			this.group.add(this.selectionRingInner);
		}
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

	private lightenColor(color: string, factor: number): string {
		// Simple color lightening - in a real implementation you'd want a proper color utility
		if (color.startsWith('#')) {
			const hex = color.slice(1);
			const num = parseInt(hex, 16);
			const r = Math.min(255, Math.floor((num >> 16) + (255 - (num >> 16)) * factor));
			const g = Math.min(
				255,
				Math.floor(((num >> 8) & 0x00ff) + (255 - ((num >> 8) & 0x00ff)) * factor)
			);
			const b = Math.min(255, Math.floor((num & 0x0000ff) + (255 - (num & 0x0000ff)) * factor));
			return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
		}
		return color;
	}

	// Public methods
	getPlanetData(): PlanetData {
		return this.planetData;
	}

	setSelected(selected: boolean): void {
		this.isSelected = selected;
		this.updateSelectionState();
	}

	getSelected(): boolean {
		return this.isSelected;
	}

	destroy(): void {
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
		if (this.group) {
			this.group.destroy();
		}
	}

	setVisible(visible: boolean): void {
		if (this.group) {
			this.group.visible(visible);
		}
	}

	// Event handling methods
	onClick(callback: (planet: DrawnPlanet) => void): void {
		if (this.group) {
			this.group.on('click', () => callback(this));
		}
	}

	onMouseEnter(callback: (planet: DrawnPlanet) => void): void {
		if (this.group) {
			this.group.on('mouseenter', () => callback(this));
		}
	}

	onMouseLeave(callback: (planet: DrawnPlanet) => void): void {
		if (this.group) {
			this.group.on('mouseleave', () => callback(this));
		}
	}
}
