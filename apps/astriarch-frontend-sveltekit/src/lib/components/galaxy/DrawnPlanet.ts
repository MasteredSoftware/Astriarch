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
const FLEET_ICON_SIZE = 11;
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
	private fleetIcon: Konva.Rect | null = null;
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
		this.updateFleetStrength();
		this.updateFleetIcon();
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

					// Proper layering: planet ring at bottom, then planet image, then UI elements
					if (this.planetRing) {
						this.planetRing.moveToBottom();
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
			// Get owner color or use default metallic colors
			const ownerColor = this.owner ? this.getOwnerColor() : '#3B4350';
			
			// Create sophisticated ring - use Circle with stroke for ring effect
			this.planetRing = new Konva.Circle({
				x: 0,
				y: 0,
				radius: ringRadius,
				fill: 'transparent',
				stroke: ownerColor,
				strokeWidth: 2,
				opacity: this.owner ? 0.7 : 0.6,
				visible: true
			});

			// Add ring behind the planet but above background elements
			this.group.add(this.planetRing);
			this.planetRing.moveToBottom();

			// Make sure planet elements stay on top
			if (this.planetImage) {
				this.planetImage.moveToTop();
			}
		} else {
			// Update existing ring color
			const ownerColor = this.owner ? this.getOwnerColor() : '#3B4350';
			this.planetRing.stroke(ownerColor);
			this.planetRing.opacity(this.owner ? 0.7 : 0.6);
		}
	}

	private getOwnerColor(): string {
		if (!this.owner) return 'white';

		const ownerColor = this.owner.color;
		if (typeof ownerColor === 'string') {
			return ownerColor;
		} else if (ownerColor && typeof ownerColor === 'object') {
			return `rgb(${ownerColor.r || 0}, ${ownerColor.g || 0}, ${ownerColor.b || 0})`;
		}
		return 'white';
	}

	private updatePlanetAppearance(): void {
		let fillColor = 'black';
		let strokeColor = 'white';

		// For unexplored planets, color by owner if known
		if (!this.knownPlanetType) {
			if (this.owner) {
				// Convert ColorRgbaData to string if needed
				const ownerColor = this.owner.color;
				if (typeof ownerColor === 'string') {
					fillColor = ownerColor;
				} else if (ownerColor && typeof ownerColor === 'object') {
					// Assume it's a ColorRgbaData object with r, g, b properties
					fillColor = `rgb(${ownerColor.r || 0}, ${ownerColor.g || 0}, ${ownerColor.b || 0})`;
				} else {
					fillColor = '#444';
				}
				strokeColor = this.lightenColor(fillColor, 0.3);
			} else {
				// Modify based on planet type if we have some knowledge
				if (this.planetData.type) {
					switch (this.planetData.type) {
						case 1: // AsteroidBelt
							fillColor = '#8a8a8a';
							break;
						case 2: // DeadPlanet
							fillColor = '#444444';
							break;
						case 3: // PlanetClass1
							fillColor = '#4a90e2';
							break;
						case 4: // PlanetClass2
							fillColor = '#50c878';
							break;
					}
				}
			}
		}
	}

	private updateFleetStrength(): void {
		if (!this.strengthText) return;

		let strengthText = '';

		// Show fleet strength for owned planets with planetary fleet data
		if (
			this.owner &&
			this.owner.id === this.gameModel.mainPlayer.id &&
			this.planetData.planetaryFleet?.starships?.length
		) {
			// Calculate total fleet strength (sum of all ship health/strength)
			const fleetStrength = this.planetData.planetaryFleet.starships.reduce(
				(total: number, ship: StarshipData) => total + ship.health,
				0
			);
			strengthText = fleetStrength.toString();
		}
		// For non-owned or other players' planets, check last known fleet data
		else {
			const lastKnownData =
				this.gameModel.mainPlayer.lastKnownPlanetFleetStrength[this.planetData.id];
			if (lastKnownData?.fleetData?.starships?.length) {
				// Calculate last known fleet strength
				const lastKnownFleetStrength = lastKnownData.fleetData.starships.reduce(
					(total: number, ship: StarshipData) => total + ship.health,
					0
				);
				if (lastKnownFleetStrength > 0) {
					// Show exact strength if we own the planet, otherwise show "?" for unknown current strength
					if (this.owner && this.owner.id === this.gameModel.mainPlayer.id) {
						strengthText = lastKnownFleetStrength.toString();
					} else {
						strengthText = `${lastKnownFleetStrength}?`; // Last known strength with uncertainty indicator
					}
				}
			}
			// Also check current planetary fleet for visible data
			else if (this.planetData.planetaryFleet?.starships?.length) {
				// We can see there are ships but don't know the exact strength
				strengthText = '?'; // Unknown current strength indicator
			}
		}

		this.strengthText.text(strengthText);
		this.textBlockStrengthText = strengthText;
	}

	private updateFleetIcon(): void {
		const hasFleet = this.textBlockStrengthText !== '';

		if (hasFleet && !this.fleetIcon) {
			this.createFleetIcon();
		} else if (!hasFleet && this.fleetIcon) {
			this.fleetIcon.destroy();
			this.fleetIcon = null;
		}
	}

	private createFleetIcon(): void {
		// Get owner color as string - handle both PlayerData and ClientPlayer
		let ownerColor = 'white';
		if (this.owner?.color) {
			const color = this.owner.color;
			if (typeof color === 'string') {
				ownerColor = color;
			} else if (typeof color === 'object') {
				ownerColor = `rgb(${color.r || 0}, ${color.g || 0}, ${color.b || 0})`;
			}
		}

		this.fleetIcon = new Konva.Rect({
			x: -FLEET_ICON_SIZE / 2,
			y: -FLEET_ICON_SIZE / 2,
			width: FLEET_ICON_SIZE,
			height: FLEET_ICON_SIZE,
			fill: ownerColor,
			stroke: 'black',
			strokeWidth: 1,
			cornerRadius: 2
		});
		this.group.add(this.fleetIcon);
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
					0, '#313E46',           // Dark start
					0.31, '#A0B0BA88',     // Semi-transparent light gray
					0.51, '#FFFFFF',       // White middle
					1, '#69747BD4'         // Semi-transparent dark gray end
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
