import { StarshipAdvantageData, StarShipType } from "../model/fleet";
import { PlanetImprovementType, PlanetProductionItemData, PlanetProductionItemType } from "../model/planet";
import { Fleet } from "./fleet";

export class PlanetProductionItem {

  private static constructPlanetProductionItem(
    itemType: PlanetProductionItemType,
  ): PlanetProductionItemData {
    return {
      itemType,
      improvementData: undefined,
      starshipData: undefined,
      turnsToComplete: 99,
      productionCostComplete: 0,
      baseProductionCost: 0,
      energyCost: 0,
      oreCost: 0,
      iridiumCost: 0
    }
  }

  public static constructPlanetImprovement(type: PlanetImprovementType):PlanetProductionItemData {
    const base = this.constructPlanetProductionItem(PlanetProductionItemType.PlanetImprovement);
    base.improvementData = {type};
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

  public static constructPlanetImprovementToDestroy(type: PlanetImprovementType):PlanetProductionItemData {
    const base = this.constructPlanetProductionItem(PlanetProductionItemType.PlanetImprovement);
    base.improvementData = {type};

    base.baseProductionCost = base.baseProductionCost / 4;
    return base;
  }

  public static constructStarShipInProduction(type: StarShipType, customShipData?:StarshipAdvantageData):PlanetProductionItemData {
    const base = this.constructPlanetProductionItem(PlanetProductionItemType.PlanetImprovement);
    base.starshipData = {type, customShipData};

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
      let baseShipAdvantageFactor = baseShipAdvantage.advantageAgainst - (baseShipAdvantage.disadvantageAgainst - 1);
      //increase cost based on advantages/disadvantages
      let advantageFactorDifference = customShipData.advantageAgainst - (customShipData.disadvantageAgainst - 1) - baseShipAdvantageFactor;
      let costMultiplier = Math.max(1.0, 1 + advantageFactorDifference / 10);

      base.baseProductionCost = Math.ceil(base.baseProductionCost * costMultiplier);
      base.oreCost = Math.ceil(base.oreCost * costMultiplier);
      base.iridiumCost = Math.ceil(base.iridiumCost * costMultiplier);
      base.energyCost = Math.ceil(base.energyCost * costMultiplier);
    }
    return base;
  }
}