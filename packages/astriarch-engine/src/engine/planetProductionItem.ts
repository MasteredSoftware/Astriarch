import { StarshipAdvantageData, StarShipType } from '../model/fleet';
import { PlanetImprovementType, PlanetProductionItemData, PlanetProductionItemType, PlanetData } from '../model/planet';
import { GameTools } from '../utils/gameTools';
import { Fleet } from './fleet';
import { PlayerData } from '../model/player';
import { PlanetById } from '../model/clientModel';
import { Research } from './research';
import { Player } from './player';

export enum CanBuildResult {
  CanBuild = 'can-build',
  CannotBuildInsufficientResources = 'cannot-build-insufficient-resources',
  CannotBuildInsufficientSlots = 'cannot-build-insufficient-slots',
  CannotBuildPrerequisitesNotMet = 'cannot-build-prerequisites-not-met',
  CannotBuildSpacePlatformLimit = 'cannot-build-space-platform-limit',
}

export interface CanBuildValidationResult {
  result: CanBuildResult;
  reason?: string;
}

export class PlanetProductionItem {
  private static constructPlanetProductionItem(itemType: PlanetProductionItemType): PlanetProductionItemData {
    return {
      itemType,
      improvementData: undefined,
      starshipData: undefined,
      turnsToComplete: 99,
      productionCostComplete: 0,
      baseProductionCost: 0,
      energyCost: 0,
      oreCost: 0,
      iridiumCost: 0,
      resourcesSpent: false,
    };
  }

  public static constructPlanetImprovement(type: PlanetImprovementType): PlanetProductionItemData {
    const base = this.constructPlanetProductionItem(PlanetProductionItemType.PlanetImprovement);
    base.improvementData = { type };
    //setup production costs
    switch (type) {
      case PlanetImprovementType.Colony:
        base.baseProductionCost = 16;
        base.oreCost = 2;
        base.iridiumCost = 1;
        base.energyCost = 3;
        break;
      case PlanetImprovementType.Factory:
        base.baseProductionCost = 32;
        base.oreCost = 4;
        base.iridiumCost = 2;
        base.energyCost = 6;
        break;
      case PlanetImprovementType.Farm:
        base.baseProductionCost = 4;
        base.energyCost = 1;
        break;
      case PlanetImprovementType.Mine:
        base.baseProductionCost = 8;
        base.oreCost = 1;
        base.energyCost = 2;
        break;
    }
    return base;
  }

  public static constructPlanetImprovementToDestroy(type: PlanetImprovementType): PlanetProductionItemData {
    const base = this.constructPlanetProductionItem(PlanetProductionItemType.PlanetImprovementToDestroy);
    base.improvementData = { type };

    base.baseProductionCost = base.baseProductionCost / 4;
    return base;
  }

  public static constructStarShipInProduction(
    type: StarShipType,
    customShipData?: StarshipAdvantageData,
  ): PlanetProductionItemData {
    const base = this.constructPlanetProductionItem(PlanetProductionItemType.StarShipInProduction);
    base.starshipData = { type, customShipData };

    switch (type) {
      case StarShipType.SpacePlatform:
        base.baseProductionCost = 162; //space platforms should take a while to build
        base.oreCost = 12;
        base.iridiumCost = 6;
        base.energyCost = 18;
        break;
      case StarShipType.Battleship:
        base.baseProductionCost = 104;
        base.oreCost = 16;
        base.iridiumCost = 8;
        base.energyCost = 24;
        break;
      case StarShipType.Cruiser:
        base.baseProductionCost = 41;
        base.oreCost = 8;
        base.iridiumCost = 4;
        base.energyCost = 12;
        break;
      case StarShipType.Destroyer:
        base.baseProductionCost = 16;
        base.oreCost = 4;
        base.iridiumCost = 2;
        base.energyCost = 6;
        break;
      case StarShipType.Scout:
        base.baseProductionCost = 6;
        base.oreCost = 2;
        base.iridiumCost = 1;
        base.energyCost = 3;
        break;
      case StarShipType.SystemDefense:
        base.baseProductionCost = 2;
        base.oreCost = 1;
        base.energyCost = 1;
        break;
    }

    const baseShipAdvantage = Fleet.getStarshipStandardAdvantageByType(type);
    if (customShipData && baseShipAdvantage) {
      const baseShipAdvantageFactor = baseShipAdvantage.advantageAgainst - (baseShipAdvantage.disadvantageAgainst - 1);
      //increase cost based on advantages/disadvantages
      const advantageFactorDifference =
        customShipData.advantageAgainst - (customShipData.disadvantageAgainst - 1) - baseShipAdvantageFactor;
      const costMultiplier = Math.max(1.0, 1 + advantageFactorDifference / 10);

      base.baseProductionCost = Math.ceil(base.baseProductionCost * costMultiplier);
      base.oreCost = Math.ceil(base.oreCost * costMultiplier);
      base.iridiumCost = Math.ceil(base.iridiumCost * costMultiplier);
      base.energyCost = Math.ceil(base.energyCost * costMultiplier);
    }
    return base;
  }

  public static toString(item: PlanetProductionItemData) {
    if (
      [PlanetProductionItemType.PlanetImprovement, PlanetProductionItemType.PlanetImprovementToDestroy].includes(
        item.itemType,
      )
    ) {
      if (!item.improvementData) {
        throw new Error('No improvementData for PlanetProductionItemData');
      }
      return item.itemType === PlanetProductionItemType.PlanetImprovementToDestroy
        ? 'Demolish '
        : '' + GameTools.planetImprovementTypeToFriendlyName(item.improvementData?.type);
    }
    if (!item.starshipData) {
      throw new Error('No starshipData for PlanetProductionItemData');
    }
    const isCustom = Boolean(item.starshipData.customShipData);
    return GameTools.starShipTypeToFriendlyName(item.starshipData.type, isCustom);
  }

  /**
   * Checks if a player has sufficient resources to build an item
   */
  public static hasSufficientResources(
    player: PlayerData,
    ownedPlanets: PlanetById,
    item: PlanetProductionItemData,
  ): boolean {
    // Get total resources across all owned planets
    const totalResources = Player.getTotalResourceAmount(player, ownedPlanets);

    return (
      totalResources.energy >= item.energyCost &&
      totalResources.ore >= item.oreCost &&
      totalResources.iridium >= item.iridiumCost
    );
  }

  /**
   * Checks if a planet has available slots for building improvements
   */
  public static hasSufficientSlots(planet: PlanetData, item: PlanetProductionItemData): boolean {
    // Only check slots for planet improvements
    if (item.itemType !== PlanetProductionItemType.PlanetImprovement) {
      return true;
    }

    // Count currently built improvements
    const currentImprovements = Object.values(planet.builtImprovements).reduce((sum, count) => sum + count, 0);

    // Count improvement items in the build queue
    const queuedImprovements = planet.buildQueue.filter(
      (queueItem) => queueItem.itemType === PlanetProductionItemType.PlanetImprovement,
    ).length;

    const totalImprovements = currentImprovements + queuedImprovements;

    return totalImprovements < planet.maxImprovements;
  }

  /**
   * Checks if building prerequisites are met
   */
  public static hasPrerequisitesMet(planet: PlanetData, item: PlanetProductionItemData): boolean {
    if (item.itemType === PlanetProductionItemType.PlanetImprovement) {
      // Planet improvements have no prerequisites
      return true;
    }

    if (item.itemType === PlanetProductionItemType.StarShipInProduction && item.starshipData) {
      const shipType = item.starshipData.type;

      switch (shipType) {
        case StarShipType.SystemDefense:
        case StarShipType.Scout:
          // No prerequisites for defenders and scouts
          return true;

        case StarShipType.Destroyer:
        case StarShipType.SpacePlatform:
          // Require at least one factory
          return planet.builtImprovements[PlanetImprovementType.Factory] > 0;

        case StarShipType.Cruiser:
        case StarShipType.Battleship:
          // Require at least one space platform
          const spacePlatformCount = Fleet.countStarshipsByType(planet.planetaryFleet).spaceplatforms;
          return spacePlatformCount > 0;

        default:
          return true;
      }
    }

    return true;
  }

  /**
   * Checks if space platform limit has been reached
   */
  public static hasReachedSpacePlatformLimit(
    planet: PlanetData,
    player: PlayerData,
    item: PlanetProductionItemData,
  ): boolean {
    // Only check for space platforms
    if (
      item.itemType !== PlanetProductionItemType.StarShipInProduction ||
      !item.starshipData ||
      item.starshipData.type !== StarShipType.SpacePlatform
    ) {
      return false;
    }

    // Count current space platforms on this planet
    const currentSpacePlatforms = Fleet.countStarshipsByType(planet.planetaryFleet).spaceplatforms;

    // Count space platforms in build queue
    const queuedSpacePlatforms = planet.buildQueue.filter(
      (queueItem) =>
        queueItem.itemType === PlanetProductionItemType.StarShipInProduction &&
        queueItem.starshipData?.type === StarShipType.SpacePlatform,
    ).length;

    const totalSpacePlatforms = currentSpacePlatforms + queuedSpacePlatforms + 1; // +1 for the one we're trying to build

    // Get max space platform count from research
    const maxSpacePlatforms = Research.getMaxSpacePlatformCount(player.research);

    return totalSpacePlatforms > maxSpacePlatforms;
  }

  /**
   * Comprehensive validation to check if an item can be built
   */
  public static canBuild(
    planet: PlanetData,
    player: PlayerData,
    ownedPlanets: PlanetById,
    item: PlanetProductionItemData,
  ): CanBuildValidationResult {
    // Check resource requirements
    if (!this.hasSufficientResources(player, ownedPlanets, item)) {
      return {
        result: CanBuildResult.CannotBuildInsufficientResources,
        reason: `Insufficient resources: need ${item.energyCost} energy, ${item.oreCost} ore, ${item.iridiumCost} iridium`,
      };
    }

    // Check slot availability for improvements
    if (!this.hasSufficientSlots(planet, item)) {
      return {
        result: CanBuildResult.CannotBuildInsufficientSlots,
        reason: 'No available building slots on this planet',
      };
    }

    // Check prerequisites
    if (!this.hasPrerequisitesMet(planet, item)) {
      if (item.itemType === PlanetProductionItemType.StarShipInProduction && item.starshipData) {
        const shipType = item.starshipData.type;
        if (shipType === StarShipType.Destroyer || shipType === StarShipType.SpacePlatform) {
          return {
            result: CanBuildResult.CannotBuildPrerequisitesNotMet,
            reason: 'Requires a Factory to build',
          };
        }
        if (shipType === StarShipType.Cruiser || shipType === StarShipType.Battleship) {
          return {
            result: CanBuildResult.CannotBuildPrerequisitesNotMet,
            reason: 'Requires a Space Platform to build',
          };
        }
      }
      return {
        result: CanBuildResult.CannotBuildPrerequisitesNotMet,
        reason: 'Prerequisites not met',
      };
    }

    // Check space platform limit
    if (this.hasReachedSpacePlatformLimit(planet, player, item)) {
      return {
        result: CanBuildResult.CannotBuildSpacePlatformLimit,
        reason: 'Maximum space platforms reached for this planet',
      };
    }

    return {
      result: CanBuildResult.CanBuild,
    };
  }
}
