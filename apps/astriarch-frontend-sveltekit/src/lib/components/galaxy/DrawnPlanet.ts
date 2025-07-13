import type { PlanetData, PlanetType, ClientModelData, PlayerData, ClientPlayer } from 'astriarch-engine';
import Konva from 'konva';

const PLANET_SIZE = 20; // Base planet size matching original
const FLEET_ICON_SIZE = 11;

export function createDrawnPlanet(planetData: PlanetData, gameModel: ClientModelData) {
  return new DrawnPlanet(planetData, gameModel);
}

export class DrawnPlanet {
  public group: Konva.Group;
  private planetData: PlanetData;
  private knownPlanetType: PlanetType | null = null;
  private gameModel: ClientModelData;
  private owner: PlayerData | ClientPlayer | null = null;
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
    this.group.add(this.planetCircle);

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
      console.log(`Planet ${this.planetData.name} (${this.planetData.id}) is owned by main player`);
    } else {
      // Check for other players' ownership using lastKnownPlanetFleetStrength
      const lastKnownData = gameModel.mainPlayer.lastKnownPlanetFleetStrength[this.planetData.id];
      if (lastKnownData?.lastKnownOwnerId) {
        // Find the player with this ID
        const knownOwner = gameModel.clientPlayers.find(player => player.id === lastKnownData.lastKnownOwnerId);
        if (knownOwner) {
          this.owner = knownOwner;
          console.log(`Planet ${this.planetData.name} (${this.planetData.id}) last known owner: ${knownOwner.name} (cycle ${lastKnownData.cycleLastExplored})`);
        } else {
          console.log(`Planet ${this.planetData.name} (${this.planetData.id}) has unknown owner ID: ${lastKnownData.lastKnownOwnerId}`);
        }
      } else {
        if (lastKnownData) {
          console.log(`Planet ${this.planetData.name} (${this.planetData.id}) was explored but has no known owner (cycle ${lastKnownData.cycleLastExplored})`);
        } else {
          console.log(`Planet ${this.planetData.name} (${this.planetData.id}) has never been explored`);
        }
      }
    }

    // Update planet type if available in the planet data
    if (this.planetData.type) {
      this.knownPlanetType = this.planetData.type;
      console.log(`Planet ${this.planetData.name} type: ${this.knownPlanetType}`);
    }

    this.updateVisuals();
  }

  private updateVisuals(): void {
    this.updatePlanetAppearance();
    this.updateFleetStrength();
    this.updateFleetIcon();
    this.updateProductionStatus();
  }

  private updatePlanetAppearance(): void {
    if (!this.planetCircle) return;

    let fillColor = 'black';
    let strokeColor = 'white';

    // Color by owner
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
    }

    // Modify based on planet type if known
    if (this.knownPlanetType) {
      switch (this.knownPlanetType) {
        case 1: // AsteroidBelt
          fillColor = this.owner ? fillColor : '#8a8a8a';
          break;
        case 2: // DeadPlanet
          fillColor = this.owner ? fillColor : '#444444';
          break;
        case 3: // PlanetClass1
          fillColor = this.owner ? fillColor : '#4a90e2';
          break;
        case 4: // PlanetClass2
          fillColor = this.owner ? fillColor : '#50c878';
          break;
      }
    }

    this.planetCircle.fill(fillColor);
    this.planetCircle.stroke(strokeColor);
  }

  private updateFleetStrength(): void {
    if (!this.strengthText) return;

    let strengthText = '';
    
    // Show fleet strength for owned planets with planetary fleet data
    if (this.owner && this.owner.id === this.gameModel.mainPlayer.id && this.planetData.planetaryFleet?.starships?.length) {
      const fleetSize = this.planetData.planetaryFleet.starships.length;
      strengthText = fleetSize.toString();
    }
    // For non-owned or other players' planets, check last known fleet data
    else {
      const lastKnownData = this.gameModel.mainPlayer.lastKnownPlanetFleetStrength[this.planetData.id];
      if (lastKnownData?.fleetData?.starships?.length) {
        const lastKnownFleetSize = lastKnownData.fleetData.starships.length;
        if (lastKnownFleetSize > 0) {
          // Show exact number if we own the planet, otherwise show "?" for unknown current strength
          if (this.owner && this.owner.id === this.gameModel.mainPlayer.id) {
            strengthText = lastKnownFleetSize.toString();
          } else {
            strengthText = `${lastKnownFleetSize}?`; // Last known strength with uncertainty indicator
          }
        }
      }
      // Also check current planetary fleet for visible data
      else if (this.planetData.planetaryFleet?.starships?.length) {
        const fleetSize = this.planetData.planetaryFleet.starships.length;
        if (fleetSize > 0) {
          strengthText = '?'; // Unknown current strength indicator
        }
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

  private lightenColor(color: string, factor: number): string {
    // Simple color lightening - in a real implementation you'd want a proper color utility
    if (color.startsWith('#')) {
      const hex = color.slice(1);
      const num = parseInt(hex, 16);
      const r = Math.min(255, Math.floor((num >> 16) + (255 - (num >> 16)) * factor));
      const g = Math.min(255, Math.floor(((num >> 8) & 0x00FF) + (255 - ((num >> 8) & 0x00FF)) * factor));
      const b = Math.min(255, Math.floor((num & 0x0000FF) + (255 - (num & 0x0000FF)) * factor));
      return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
    }
    return color;
  }

  // Public methods
  getPlanetData(): PlanetData {
    return this.planetData;
  }

  destroy(): void {
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
