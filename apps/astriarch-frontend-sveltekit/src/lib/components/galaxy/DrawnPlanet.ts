import Konva from 'konva';
import type { PlanetData, PlanetType, ClientModelData, PlayerData } from 'astriarch-engine';

const PLANET_SIZE = 20; // Base planet size matching original
const FLEET_ICON_SIZE = 11;
const PLATFORM_ICON_SIZE = 11;

export class DrawnPlanet extends Konva.Group {
  private planetData: PlanetData;
  private knownPlanetType: PlanetType | null = null;
  private textBlockForeground = "yellow";
  private textBlockStrengthForeground = "yellow";
  private textBlockStrengthText = "";
  private productionItemStatusColor: string | null = null;
  
  // Visual elements
  private planetCircle!: Konva.Circle;
  private planetImage: Konva.Image | null = null;
  private nameText!: Konva.Text;
  private strengthText!: Konva.Text;
  private fleetIcon: Konva.Rect | null = null;
  private platformIcon: Konva.Rect | null = null;
  private statusIndicator: Konva.Circle | null = null;
  private waypointLine: Konva.Line | null = null;

  constructor(planetData: PlanetData) {
    super();
    this.planetData = planetData;
    
    // Position planet at its hex midpoint
    this.x(planetData.boundingHexMidPoint.x);
    this.y(planetData.boundingHexMidPoint.y);
    
    this.createVisualElements();
  }

  private createVisualElements() {
    // Main planet circle (fallback when no sprite is available)
    this.planetCircle = new Konva.Circle({
      x: 0,
      y: 0,
      radius: PLANET_SIZE / 2,
      fill: 'black',
      stroke: 'white',
      strokeWidth: 2,
      visible: true
    });
    this.add(this.planetCircle);

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
    this.add(this.nameText);

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
    this.add(this.strengthText);
  }

  public updateForGameState(clientGameModel: ClientModelData) {
    const player = clientGameModel.mainPlayer;
    this.resetVisualState();
    
    // Check if player owns this planet
    const ownedPlanet = clientGameModel.mainPlayerOwnedPlanets[this.planetData.id];
    
    if (ownedPlanet) {
      this.updateOwnedPlanet(ownedPlanet, player);
    } else {
      this.updateUnknownPlanet(clientGameModel);
    }
    
    this.updateVisualElements();
  }

  private resetVisualState() {
    this.productionItemStatusColor = null;
    this.textBlockStrengthText = "";
    
    // Remove dynamic elements
    if (this.fleetIcon) {
      this.fleetIcon.destroy();
      this.fleetIcon = null;
    }
    if (this.platformIcon) {
      this.platformIcon.destroy();
      this.platformIcon = null;
    }
    if (this.statusIndicator) {
      this.statusIndicator.destroy();
      this.statusIndicator = null;
    }
    if (this.waypointLine) {
      this.waypointLine.destroy();
      this.waypointLine = null;
    }
  }

  private updateOwnedPlanet(planet: PlanetData, player: PlayerData) {
    // Set colors to player color
    const playerColor = `rgb(${player.color.r}, ${player.color.g}, ${player.color.b})`;
    this.textBlockForeground = playerColor;
    this.textBlockStrengthForeground = playerColor;

    // Calculate fleet strength
    const fleetStrength = this.calculateFleetStrength(planet);
    this.textBlockStrengthText = fleetStrength.toString();

    // Check for mobile fleets
    if (this.hasMobileFleets(planet)) {
      this.createFleetIcon(playerColor);
    }

    // Check for space platforms
    if (this.hasSpacePlatforms(planet)) {
      this.createPlatformIcon(playerColor);
    }

    // Set production status
    this.updateProductionStatus(planet);

    // Set planet type and appearance
    this.updatePlanetAppearance(planet.type);
  }

  private updateUnknownPlanet(clientGameModel: ClientModelData) {
    // Find this planet in client planets to get known type
    const clientPlanet = clientGameModel.clientPlanets.find(p => p.id === this.planetData.id);
    
    if (clientPlanet?.type) {
      this.knownPlanetType = clientPlanet.type;
      this.updatePlanetAppearance(clientPlanet.type);
      
      if (clientPlanet.type === 3) { // DeadPlanet
        this.textBlockForeground = "black";
      } else {
        this.textBlockForeground = "yellow";
      }
    } else {
      this.textBlockForeground = "yellow";
    }
    
    this.textBlockStrengthForeground = "yellow";
  }

  private updatePlanetAppearance(planetType: PlanetType | null) {
    if (!planetType) {
      // Unknown planet - show basic circle
      this.planetCircle.fill('black');
      this.planetCircle.stroke('white');
      return;
    }

    // Set planet appearance based on type
    switch (planetType) {
      case 1: // AsteroidBelt
        this.planetCircle.fill('#666666');
        this.planetCircle.stroke('#999999');
        break;
      case 2: // DeadPlanet
        this.planetCircle.fill('#4a4a4a');
        this.planetCircle.stroke('#666666');
        break;
      case 3: // PlanetClass1
        this.planetCircle.fill('#8B4513');
        this.planetCircle.stroke('#CD853F');
        break;
      case 4: // PlanetClass2
        this.planetCircle.fill('#228B22');
        this.planetCircle.stroke('#32CD32');
        break;
      default:
        this.planetCircle.fill('black');
        this.planetCircle.stroke('white');
    }
  }

  private calculateFleetStrength(planet: PlanetData): number {
    // Simple fleet strength calculation
    if (planet.planetaryFleet?.starships) {
      return planet.planetaryFleet.starships.length;
    }
    return 0;
  }

  private hasMobileFleets(planet: PlanetData): boolean {
    // Check if planet has mobile ships
    return planet.planetaryFleet?.starships?.some(ship => 
      ship.type !== 6 // Assuming 6 is SpacePlatform type
    ) || false;
  }

  private hasSpacePlatforms(planet: PlanetData): boolean {
    // Check if planet has space platforms
    return planet.planetaryFleet?.starships?.some(ship => 
      ship.type === 6 // Assuming 6 is SpacePlatform type
    ) || false;
  }

  private createFleetIcon(color: string) {
    this.fleetIcon = new Konva.Rect({
      x: PLANET_SIZE / 2 - 2,
      y: PLANET_SIZE / 2 - 2,
      width: FLEET_ICON_SIZE,
      height: FLEET_ICON_SIZE,
      fill: color,
      stroke: 'white',
      strokeWidth: 1,
      cornerRadius: 2
    });
    this.add(this.fleetIcon);
  }

  private createPlatformIcon(color: string) {
    this.platformIcon = new Konva.Rect({
      x: -PLANET_SIZE / 2 - 8,
      y: PLANET_SIZE / 2 - 2,
      width: PLATFORM_ICON_SIZE,
      height: PLATFORM_ICON_SIZE,
      fill: color,
      stroke: 'white',
      strokeWidth: 1,
      cornerRadius: 1
    });
    this.add(this.platformIcon);
  }

  private updateProductionStatus(planet: PlanetData) {
    if (!planet.buildQueue || planet.buildQueue.length === 0) {
      this.productionItemStatusColor = "#CCCCCC"; // Idle
      this.createStatusIndicator();
      return;
    }

    const nextItem = planet.buildQueue[0];
    if (nextItem.itemType === 1) { // PlanetImprovement
      this.productionItemStatusColor = "#00FF00"; // Green for buildings
    } else if (nextItem.itemType === 2) { // StarShipInProduction
      this.productionItemStatusColor = "#336699"; // Blue for ships
    } else if (nextItem.itemType === 3) { // PlanetImprovementToDestroy
      this.productionItemStatusColor = "#FF0000"; // Red for destruction
    }
    
    this.createStatusIndicator();
  }

  private createStatusIndicator() {
    if (!this.productionItemStatusColor) return;
    
    this.statusIndicator = new Konva.Circle({
      x: -PLANET_SIZE / 2 - 4,
      y: 0,
      radius: 3,
      fill: this.productionItemStatusColor,
      stroke: this.productionItemStatusColor,
      strokeWidth: 1
    });
    this.add(this.statusIndicator);
  }

  private updateVisualElements() {
    // Update text colors and content
    this.nameText.fill(this.textBlockForeground);
    this.strengthText.fill(this.textBlockStrengthForeground);
    this.strengthText.text(this.textBlockStrengthText);
    
    // Update text content
    this.nameText.text(this.planetData.name || this.planetData.id.toString());
  }

  // Method for handling clicks (to be called by the canvas)
  public handleClick() {
    console.log(`Planet ${this.planetData.name || this.planetData.id} clicked`);
    // TODO: Implement planet selection logic
  }
}
