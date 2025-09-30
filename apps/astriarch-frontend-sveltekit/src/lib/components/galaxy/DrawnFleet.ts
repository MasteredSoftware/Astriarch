import type { FleetData, PlayerData, ClientModelData, StarShipType } from 'astriarch-engine';
import Konva from 'konva';
import { DrawnTravelLine, TravelLineType } from './DrawnTravelLine';

const FLEET_ICON_SIZE = 16;
const ETA_TEXT_SIZE = 8;

// SVG path data for different ship types
const SHIP_PATHS = {
	scout:
		'M36.2629 44.0343L27.1314 18L27.1314 44.0343L36.2629 52V44.0343Z M18 44.0343L27.1314 18L27.1314 44.0343L18 52L18 44.0343Z',
	destroyer:
		'M33.5075 22.702L25.5 11L25.5 28.4503L33.5075 33.9934L33.5075 42L40 36.8676L37.8358 32.1457L37.8358 20.649L35.0224 17.5695L33.5075 22.702Z M17.4925 22.702L25.5 11L25.5 28.4503L17.4925 33.9934L17.4925 42L11 36.8676L13.1642 32.1457L13.1642 20.649L15.9776 17.5695L17.4925 22.702Z',
	cruiser:
		'M44 36.2571L29.04 11L29.04 21.2971L27.0971 21.2971L27.0971 38.9771L30.0114 38.9771L30.0114 45L39.1429 38.0057L40.5029 38.0057L44 36.2571Z M10.1943 36.2571L25.1543 11L25.1543 21.2971L27.0971 21.2971L27.0971 38.9771L24.1829 38.9771L24.1829 45L15.0514 38.0057L13.6914 38.0057L10.1943 36.2571Z',
	battleship:
		'M23.5772 16.9008L28 11L28 40.6446L24.9594 45L11 39.9421L11 35.7273L21.0894 17.7438L21.0894 28.9835L23.5772 28.9835L23.5772 16.9008Z M32.4228 16.9008L28 11L28 40.6446L31.0407 45L45 39.9421L45 35.7273L34.9106 17.7438L34.9106 28.9835L32.4228 28.9835L32.4228 16.9008Z'
};

export function createDrawnFleet(fleetData: FleetData, gameModel: ClientModelData) {
	return new DrawnFleet(fleetData, gameModel);
}

export class DrawnFleet {
	public group: Konva.Group;
	private fleetData: FleetData;
	private gameModel: ClientModelData;
	private owner: PlayerData | null = null;

	// Visual elements
	private travelLine!: DrawnTravelLine;
	private fleetIcon!: Konva.Path; // Changed from Konva.Rect to Konva.Path for SVG
	private etaText!: Konva.Text;

	// Calculated position properties
	private travelDistancePoint = { x: 0, y: 0 };

	constructor(fleetData: FleetData, gameModel: ClientModelData) {
		this.group = new Konva.Group();
		this.fleetData = fleetData;
		this.gameModel = gameModel;

		this.createVisualElements();
		this.update(gameModel);
	}

	/**
	 * Determines the largest hull type in the fleet (highest priority ship type)
	 */
	private getLargestHullType(): StarShipType {
		const { starships } = this.fleetData;

		// Return scout as default if no starships
		if (!starships || starships.length === 0) {
			return 2 as StarShipType; // Scout
		}

		// Priority order: Battleship > Cruiser > Destroyer > Scout > System Defense
		const priorities = {
			[5]: 5, // Battleship
			[4]: 4, // Cruiser
			[3]: 3, // Destroyer
			[2]: 2, // Scout
			[1]: 1, // System Defense
			[6]: 1 // Space Platform (treated like defender)
		};

		let largestType = 2; // Default to Scout
		let highestPriority = 0;

		for (const ship of starships) {
			const priority = priorities[ship.type] || 0;
			if (priority > highestPriority) {
				highestPriority = priority;
				largestType = ship.type;
			}
		}

		return largestType as StarShipType;
	}

	/**
	 * Gets the SVG path data for the specified ship type
	 */
	private getShipIconPath(shipType: StarShipType): string {
		switch (shipType) {
			case 2: // Scout
				return SHIP_PATHS.scout;
			case 3: // Destroyer
				return SHIP_PATHS.destroyer;
			case 4: // Cruiser
				return SHIP_PATHS.cruiser;
			case 5: // Battleship
				return SHIP_PATHS.battleship;
			default:
				return SHIP_PATHS.scout; // Default fallback
		}
	}

	private createVisualElements() {
		// Fleet icon (starship representation) - will be updated in updateFleetIcon
		const largestHullType = this.getLargestHullType();
		const pathData = this.getShipIconPath(largestHullType);

		this.fleetIcon = new Konva.Path({
			data: pathData,
			fill: '#00FFFF',
			stroke: 'white',
			strokeWidth: 0.5,
			scaleX: FLEET_ICON_SIZE / 55, // Scale down from original SVG size
			scaleY: FLEET_ICON_SIZE / 55,
			offsetX: 27.5, // Center the icon (half of original width)
			offsetY: 35, // Center the icon (half of original height)
			visible: false
		});
		this.group.add(this.fleetIcon);

		// ETA text showing turns remaining
		this.etaText = new Konva.Text({
			x: 8,
			y: -4,
			text: 'ETA',
			fontSize: ETA_TEXT_SIZE,
			fontFamily: 'Orbitron, monospace',
			fontStyle: 'bold',
			fill: '#00FFFF',
			visible: false
		});
		this.group.add(this.etaText);

		// Travel line will be created when needed in updateTravelLine
	}
	public update(clientGameModel: ClientModelData) {
		this.gameModel = clientGameModel;

		// Find the owner of this fleet by looking through fleetsInTransit
		this.owner = null;

		// Check main player first
		for (const fleet of clientGameModel.mainPlayer.fleetsInTransit) {
			if (fleet === this.fleetData) {
				this.owner = clientGameModel.mainPlayer;
				break;
			}
		}

		// Then check other client players (future enhancement)
		// Note: ClientPlayer structure might not include fleetsInTransit
		// Most fleets will likely belong to the main player for now

		this.updateFleetIcon();
		this.updateTravelLine();
		this.updateVisualElements();
	}

	/**
	 * Updates the fleet icon to match the largest hull type in the current fleet
	 */
	private updateFleetIcon() {
		const largestHullType = this.getLargestHullType();
		const pathData = this.getShipIconPath(largestHullType);

		// Update the path data for the fleet icon
		this.fleetIcon.data(pathData);

		// Update the icon scale based on ship type (larger ships = slightly larger icons)
		let scale = FLEET_ICON_SIZE / 55; // Base scale
		switch (largestHullType) {
			case 5: // Battleship
				scale *= 1.2;
				break;
			case 4: // Cruiser
				scale *= 1.1;
				break;
			case 3: // Destroyer
				scale *= 1.05;
				break;
			default: // Scout and others
				break;
		}

		this.fleetIcon.scaleX(scale);
		this.fleetIcon.scaleY(scale);
	}

	public updateTravelLine() {
		// Only show travel elements if fleet is actually traveling
		if (!this.fleetData.totalTravelDistance || this.fleetData.totalTravelDistance <= 0) {
			this.hideAllElements();
			return;
		}

		if (
			!this.fleetData.parsecsToDestination ||
			!this.fleetData.destinationHexMidPoint ||
			!this.fleetData.travelingFromHexMidPoint
		) {
			this.hideAllElements();
			return;
		}

		// Create travel line if it doesn't exist
		if (!this.travelLine) {
			this.travelLine = new DrawnTravelLine({
				type: TravelLineType.FLEET_IN_TRANSIT,
				fromX: 0,
				fromY: 0,
				toX: 0,
				toY: 0
			});
			this.group.add(this.travelLine.group);
		}

		// Calculate travel progress
		const traveled =
			(this.fleetData.totalTravelDistance - this.fleetData.parsecsToDestination) /
			this.fleetData.totalTravelDistance;

		// Calculate current position along travel line
		const fromX = this.fleetData.travelingFromHexMidPoint.x;
		const fromY = this.fleetData.travelingFromHexMidPoint.y;
		const toX = this.fleetData.destinationHexMidPoint.x;
		const toY = this.fleetData.destinationHexMidPoint.y;

		this.travelDistancePoint.x = fromX - (fromX - toX) * traveled;
		this.travelDistancePoint.y = fromY - (fromY - toY) * traveled;

		// Calculate travel direction for positioning and rotation
		const deltaX = toX - fromX;
		const deltaY = toY - fromY;
		const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

		// Normalize direction vector
		const directionX = deltaX / distance;
		const directionY = deltaY / distance;

		// Calculate distance from fleet to destination
		const distanceToDestination = Math.sqrt(
			Math.pow(toX - this.travelDistancePoint.x, 2) + Math.pow(toY - this.travelDistancePoint.y, 2)
		);

		// Start the travel line a few pixels in front of the fleet icon
		const offsetDistance = 8; // pixels to offset from fleet icon
		const lineStartX = this.travelDistancePoint.x + directionX * offsetDistance;
		const lineStartY = this.travelDistancePoint.y + directionY * offsetDistance;

		// Only show travel line if fleet is far enough from destination
		const shouldShowTravelLine = distanceToDestination > offsetDistance;

		if (shouldShowTravelLine) {
			// Update travel line from offset position to destination
			this.travelLine.updateEndpoints(lineStartX, lineStartY, toX, toY);
			this.travelLine.show();
		} else {
			// Hide travel line when fleet is too close to destination
			this.travelLine.hide();
		}

		// Position fleet icon at current travel position
		this.fleetIcon.x(this.travelDistancePoint.x);
		this.fleetIcon.y(this.travelDistancePoint.y);

		// Calculate and apply rotation to match travel direction
		const angleRadians = Math.atan2(deltaY, deltaX);
		const angleDegrees = (angleRadians * 180) / Math.PI;

		// Rotate the ship icon to face the travel direction
		// The original SVG ships point upward, so we need to adjust by 90 degrees
		this.fleetIcon.rotation(angleDegrees + 90);

		// Calculate ETA
		const turnsToDestination = this.calculateTurnsToDestination();
		const turnText = turnsToDestination > 1 ? ' Years' : ' Year';
		const etaString = `${turnsToDestination}${turnText}`;
		this.etaText.text(etaString);

		// Position ETA text relative to fleet icon with smart offset
		let offsetX = 8;
		if (toX > fromX) {
			// Traveling left to right, show text to the left of icon
			if (turnsToDestination > 9) offsetX = -40;
			else if (turnsToDestination === 1) offsetX = -30;
			else offsetX = -35;
		}

		this.etaText.x(this.travelDistancePoint.x + offsetX);
		this.etaText.y(this.travelDistancePoint.y + 4);

		// Don't show elements here - let updateVisualElements handle visibility after color updates
	}

	private calculateTurnsToDestination(): number {
		if (!this.fleetData.parsecsToDestination || !this.owner) {
			return 0;
		}

		// TODO: Get actual fleet speed from game engine
		// For now, assume base speed of 1 parsec per turn
		const fleetSpeed = 1;
		return Math.ceil(this.fleetData.parsecsToDestination / fleetSpeed);
	}

	private updateVisualElements() {
		// Always use cyan for consistent UI theme
		const color = '#00FFFF';

		// Update colors based on cyan theme
		if (this.travelLine) {
			this.travelLine.updateStyleCustom(color);
		}
		this.fleetIcon.fill(color);
		this.etaText.fill(color);

		// Show fleet icon and ETA text if fleet is traveling (travel line visibility handled in updateTravelLine)
		if (
			this.fleetData.totalTravelDistance &&
			this.fleetData.totalTravelDistance > 0 &&
			this.fleetData.parsecsToDestination &&
			this.fleetData.destinationHexMidPoint &&
			this.fleetData.travelingFromHexMidPoint
		) {
			this.fleetIcon.visible(true);
			this.etaText.visible(true);
		} else {
			this.hideAllElements();
		}
	}

	private showAllElements() {
		if (this.travelLine) {
			this.travelLine.show();
		}
		this.fleetIcon.visible(true);
		this.etaText.visible(true);
	}

	private hideAllElements() {
		if (this.travelLine) {
			this.travelLine.hide();
		}
		this.fleetIcon.visible(false);
		this.etaText.visible(false);
	}

	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	public isInBounds(_x: number, _y: number): boolean {
		// Fleet icons are typically not interactive for hit testing
		// This matches the original implementation
		return false;
	}

	public getFleetData(): FleetData {
		return this.fleetData;
	}

	public destroyFleet() {
		// Clean up Konva objects
		this.group.destroyChildren();
		this.group.destroy();
	}
}
