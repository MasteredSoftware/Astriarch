import type { PlanetData, PlanetType, ClientModelData, PlayerData } from 'astriarch-engine';
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
  private owner: PlayerData | null = null;
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
    
    // Position planet at its hex midpoint
    this.group.x(planetData.boundingHexMidPoint.x);
    this.group.y(planetData.boundingHexMidPoint.y);
    
    this.createVisualElements();
    this.update(gameModel);
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
    
    // Update owner information
    this.owner = this.planetData.ownerPlayerID ? 
      gameModel.players.find(p => p.id === this.planetData.ownerPlayerID) || null : null;

    // Update planet type if known
    const knownPlanet = gameModel.knownPlanets[this.planetData.id];
    if (knownPlanet?.type) {
      this.knownPlanetType = knownPlanet.type;
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
      fillColor = this.owner.color || '#444';
      strokeColor = this.lightenColor(fillColor, 0.3);
    }

    // Modify based on planet type if known
    if (this.knownPlanetType) {
      switch (this.knownPlanetType) {
        case 'Terran':
          fillColor = this.owner ? fillColor : '#4a90e2';
          break;
        case 'Desert':
          fillColor = this.owner ? fillColor : '#d4a574';
          break;
        case 'Ice':
          fillColor = this.owner ? fillColor : '#87ceeb';
          break;
        case 'Volcanic':
          fillColor = this.owner ? fillColor : '#ff6b47';
          break;
        case 'Toxic':
          fillColor = this.owner ? fillColor : '#9acd32';
          break;
        case 'Barren':
          fillColor = this.owner ? fillColor : '#696969';
          break;
      }
    }

    this.planetCircle.fill(fillColor);
    this.planetCircle.stroke(strokeColor);
  }

  private updateFleetStrength(): void {
    if (!this.strengthText) return;

    let strengthText = '';
    
    // Show planet fleet strength if we own it or have scouted it
    const knownPlanet = this.gameModel.knownPlanets[this.planetData.id];
    if (knownPlanet && (this.owner?.id === this.gameModel.humanPlayerID || knownPlanet.scoutLevel > 0)) {
      const strength = knownPlanet.fleetStrength || 0;
      if (strength > 0) {
        strengthText = strength.toString();
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
    this.fleetIcon = new Konva.Rect({
      x: -FLEET_ICON_SIZE / 2,
      y: -FLEET_ICON_SIZE / 2,
      width: FLEET_ICON_SIZE,
      height: FLEET_ICON_SIZE,
      fill: this.owner?.color || 'white',
      stroke: 'black',
      strokeWidth: 1,
      cornerRadius: 2
    });
    this.group.add(this.fleetIcon);
  }

  private updateProductionStatus(): void {
    // Show production status for owned planets
    if (this.owner?.id === this.gameModel.humanPlayerID) {
      const knownPlanet = this.gameModel.knownPlanets[this.planetData.id];
      if (knownPlanet?.currentProductionItem) {
        this.showProductionIndicator();
      } else if (this.statusIndicator) {
        this.statusIndicator.destroy();
        this.statusIndicator = null;
      }
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
