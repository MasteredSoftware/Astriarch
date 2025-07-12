import Konva from 'konva';
import type { FleetData, PlayerData, ClientModelData } from 'astriarch-engine';

const FLEET_ICON_SIZE = 11;
const ETA_TEXT_SIZE = 8;
const TRAVEL_LINE_WIDTH = 1.5;

export class DrawnFleet extends Konva.Group {
  private fleetData: FleetData;
  private owner: PlayerData | null = null;
  
  // Visual elements
  private travelLine!: Konva.Line;
  private fleetIcon!: Konva.Rect;
  private etaText!: Konva.Text;
  
  // Calculated position properties
  private travelDistancePoint = { x: 0, y: 0 };

  constructor(fleetData: FleetData) {
    super();
    this.fleetData = fleetData;
    
    this.createVisualElements();
    this.updateTravelLine();
  }

  private createVisualElements() {
    // Travel line from origin to destination
    this.travelLine = new Konva.Line({
      points: [0, 0, 0, 0],
      stroke: 'green',
      strokeWidth: TRAVEL_LINE_WIDTH,
      visible: false
    });
    this.add(this.travelLine);

    // Fleet icon (starship representation)
    this.fleetIcon = new Konva.Rect({
      x: -FLEET_ICON_SIZE / 2,
      y: -FLEET_ICON_SIZE / 2,
      width: FLEET_ICON_SIZE,
      height: FLEET_ICON_SIZE,
      fill: 'green',
      stroke: 'white',
      strokeWidth: 1,
      visible: false
    });
    this.add(this.fleetIcon);

    // ETA text showing turns remaining
    this.etaText = new Konva.Text({
      x: 8,
      y: -4,
      text: 'ETA',
      fontSize: ETA_TEXT_SIZE,
      fontFamily: 'Orbitron, monospace',
      fontStyle: 'bold',
      fill: 'green',
      visible: false
    });
    this.add(this.etaText);
  }

  public updateForGameState(clientGameModel: ClientModelData) {
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

    this.updateTravelLine();
    this.updateVisualElements();
  }

  public updateTravelLine() {
    // Only show travel elements if fleet is actually traveling
    if (!this.fleetData.totalTravelDistance || this.fleetData.totalTravelDistance <= 0) {
      this.hideAllElements();
      return;
    }

    if (!this.fleetData.parsecsToDestination || 
        !this.fleetData.destinationHexMidPoint || 
        !this.fleetData.travelingFromHexMidPoint) {
      this.hideAllElements();
      return;
    }

    // Calculate travel progress
    const traveled = (this.fleetData.totalTravelDistance - this.fleetData.parsecsToDestination) / 
                     this.fleetData.totalTravelDistance;

    // Calculate current position along travel line
    const fromX = this.fleetData.travelingFromHexMidPoint.x;
    const fromY = this.fleetData.travelingFromHexMidPoint.y;
    const toX = this.fleetData.destinationHexMidPoint.x;
    const toY = this.fleetData.destinationHexMidPoint.y;

    this.travelDistancePoint.x = fromX - (fromX - toX) * traveled;
    this.travelDistancePoint.y = fromY - (fromY - toY) * traveled;

    // Update travel line from current position to destination
    this.travelLine.points([
      this.travelDistancePoint.x, this.travelDistancePoint.y,
      toX, toY
    ]);

    // Position fleet icon at current travel position
    this.fleetIcon.x(this.travelDistancePoint.x - FLEET_ICON_SIZE / 2);
    this.fleetIcon.y(this.travelDistancePoint.y - FLEET_ICON_SIZE / 2);

    // Calculate ETA
    const turnsToDestination = this.calculateTurnsToDestination();
    const turnText = turnsToDestination > 1 ? " Turns" : " Turn";
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

    this.showAllElements();
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
    const color = this.owner?.color?.toString() || 'green';
    
    // Update colors based on owner
    this.travelLine.stroke(color);
    this.fleetIcon.fill(color);
    this.etaText.fill(color);
  }

  private showAllElements() {
    this.travelLine.visible(true);
    this.fleetIcon.visible(true);
    this.etaText.visible(true);
  }

  private hideAllElements() {
    this.travelLine.visible(false);
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
    this.destroyChildren();
    super.destroy();
  }
}
