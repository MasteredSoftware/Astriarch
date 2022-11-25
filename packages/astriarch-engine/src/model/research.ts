export enum ResearchType {
  UNKNOWN = 0,
  NEW_SHIP_TYPE_DEFENDER = 1,
  NEW_SHIP_TYPE_SCOUT = 2,
  NEW_SHIP_TYPE_DESTROYER = 3,
  NEW_SHIP_TYPE_CRUISER = 4,
  NEW_SHIP_TYPE_BATTLESHIP = 5,
  COMBAT_IMPROVEMENT_ATTACK = 6, //data key is "chance" 0 - 1 of increasing damage by 50%
  COMBAT_IMPROVEMENT_DEFENSE = 7, //data key is "chance" 0 - 1 of decreasing damage by 50%
  PROPULSION_IMPROVEMENT = 8, //data key is "percent" 1 - 10
  BUILDING_EFFICIENCY_IMPROVEMENT_FARMS = 9, //data key is "percent" 1 - 2 increased efficiency of farms
  BUILDING_EFFICIENCY_IMPROVEMENT_MINES = 10, //data key is "percent" 1 - 2 increased efficiency of mines
  BUILDING_EFFICIENCY_IMPROVEMENT_COLONIES = 11, //data key is "percent" 1 - 2 increases population growth on planet
  BUILDING_EFFICIENCY_IMPROVEMENT_FACTORIES = 12, //data key is "percent" 1 - 2 increased efficiency of factories
  SPACE_PLATFORM_IMPROVEMENT = 13, //data key is "max" 1 - 5 maximum space platforms player can build on a planet
}

export interface ResearchTypeProgress {
  type: ResearchType;
  currentResearchLevel: number;
  researchPointsBase: number; //based on the type and data, some types are intrinsically more expensive
  isCustomShip: boolean;
  maxResearchLevel: number;
  researchPointsCompleted: number;
}

export interface ResearchData {
  researchProgressByType: { [T in ResearchType]: ResearchTypeProgress };
  researchTypeInQueue: ResearchType | null; //for now a player can only research one new item at a time
  researchPercent: number; // 0 - 1, the rest goes to gold/taxes
}
