import { ClientModelData, PlanetById, PlanetLocation } from '../model/clientModel';
import { FleetData, StarShipType } from '../model/fleet';
import {
  CitizenWorkerType,
  PlanetData,
  PlanetHappinessType,
  PlanetImprovementType,
  PlanetProductionItemType,
  PlanetResourceType,
  PlanetType,
} from '../model/planet';
import { PlayerData, PlayerType } from '../model/player';
import { ResearchType } from '../model/research';
import { TradeType, TradingCenterResourceType } from '../model/tradingCenter';
import { Utils } from '../utils/utils';
import { BattleSimulator } from './battleSimulator';
import { Fleet } from './fleet';
import {
  GameCommand,
  GameCommandType,
  AdjustResearchPercentCommand,
  SubmitResearchItemCommand,
  SubmitTradeCommand,
  QueueProductionItemCommand,
  DemolishImprovementCommand,
  SendShipsCommand,
  UpdatePlanetWorkerAssignmentsCommand,
} from './GameCommands';
import { Grid } from './grid';
import { Planet, PlanetPerTurnResourceGeneration, PopulationAssignments } from './planet';
import { PlanetDistanceComparer } from './planetDistanceComparer';
import { PlanetProductionItem } from './planetProductionItem';
import { PlanetResourcePotentialComparer } from './planetResourcePotentialComparer';
import { Player } from './player';
import { Research } from './research';

export type PlanetResourcesPerTurn = Record<number, PlanetPerTurnResourceGeneration>;

/**
 * Configuration settings for AI difficulty levels
 * This allows easy tweaking and testing of AI behavior
 */
interface AISettings {
  // Food management - multipliers for totalPopulation
  foodSurplusAdjustmentLowMultiplier: number; // Multiplied by totalPopulation for low bound
  foodSurplusAdjustmentHighMultiplier: number; // Multiplied by totalPopulation for high bound
  // Energy surplus for building - varies by difficulty:
  // Easy/Normal: randomize from 0 to base * multiplier (makes them starve sometimes)
  // Hard/Expert: base + (planets * adder) (more consistent, scales with empire)
  useRandomizedEnergySurplus: boolean; // If true, use random 0 to base*multiplier, else use base + planets*adder
  energySurplusMultiplier: number; // For Easy/Normal: multiplier for random range
  energySurplusAdder: number; // For Hard/Expert: added per planet beyond first

  // Resource management
  mineralOverestimationLow: number; // Multiplier for mineral needs (low end of range)
  mineralOverestimationHigh: number; // Multiplier for mineral needs (high end of range)

  // Combat behavior
  additionalStrengthMultiplierNeededToAttackLow: number;
  additionalStrengthMultiplierNeededToAttackHigh: number;

  // Research allocation
  researchPercentMin: number;
  researchPercentMax: number;
  prioritizeCombatResearch: boolean; // Prefer attack/defense over building efficiency
  prioritizeFarmsEarly: boolean; // Include farm efficiency in early research

  // Intelligence gathering
  enableReScouting: boolean; // Whether to re-scout known planets
  scoutPriorityTopPercentage: number; // Top % of unknown planets to explore
  reScoutPriorityThreshold: number; // Minimum priority score to re-scout (absolute threshold, not percentile)
  quadrantIntelligence: boolean; // Prioritize nearby system expansion when under 4 owned planets

  // Fleet management
  enableFleetRepairs: boolean; // Whether to retreat damaged ships to repair-capable planets
  useEffectiveStrengthCalculation: boolean; // Use combat advantage calculations
  enableMultiPlanetAttacks: boolean; // Coordinate attacks from multiple planets
  useStrategicTargetPriority: boolean; // Use strategic value for target selection
  strategicDefense: boolean; // Retain defenders on planets without space platforms and prioritize building them

  // Fleet composition
  defenderBuildChance: number; // Chance to build system defenders (0-1)
  destroyerBuildChance: number; // Chance to build destroyers early (0-1)
  useBalancedFleetComposition: boolean; // Use 1:1:1 destroyer:cruiser:battleship ratio

  // Defense strategy
  defenseCalculationStrategy: 'simple' | 'moderate' | 'advanced'; // Consider enemy fleet strength for defense
  usePrioritizedTargetSorting: boolean; // Use complex value/distance/strength sorting
  enableStrategicReinforcements: boolean; // Send reinforcements to factory planets
}

/**
 * AI configuration by difficulty level
 * Allows centralized tuning of AI behavior
 */
const aiSettingsByDifficultyLevel: Record<PlayerType, AISettings> = {
  [PlayerType.Computer_Easy]: {
    foodSurplusAdjustmentLowMultiplier: -3,
    foodSurplusAdjustmentHighMultiplier: 1.5,
    useRandomizedEnergySurplus: true,
    energySurplusMultiplier: 4, // Divisor: random from 0 to (base + 1) / 4
    energySurplusAdder: 0,
    mineralOverestimationLow: 2.0,
    mineralOverestimationHigh: 4.0,
    additionalStrengthMultiplierNeededToAttackLow: 4.5,
    additionalStrengthMultiplierNeededToAttackHigh: 6.0,
    researchPercentMin: 0.1,
    researchPercentMax: 0.3,
    prioritizeCombatResearch: false,
    prioritizeFarmsEarly: false,
    enableReScouting: false, // Easy AI doesn't re-scout
    scoutPriorityTopPercentage: 0.2,
    reScoutPriorityThreshold: 30, // Unused since re-scouting is disabled
    quadrantIntelligence: false,
    enableFleetRepairs: false,
    useEffectiveStrengthCalculation: false,
    enableMultiPlanetAttacks: false,
    useStrategicTargetPriority: false,
    strategicDefense: false,
    defenderBuildChance: 0.5,
    destroyerBuildChance: 0.5,
    useBalancedFleetComposition: false,
    defenseCalculationStrategy: 'simple',
    usePrioritizedTargetSorting: false,
    enableStrategicReinforcements: false,
  },
  [PlayerType.Computer_Normal]: {
    foodSurplusAdjustmentLowMultiplier: -1.5,
    foodSurplusAdjustmentHighMultiplier: 1,
    useRandomizedEnergySurplus: true,
    energySurplusMultiplier: 2, // Divisor: random from 0 to (base + 1) / 2
    energySurplusAdder: 0,
    mineralOverestimationLow: 1.5,
    mineralOverestimationHigh: 2.5,
    additionalStrengthMultiplierNeededToAttackLow: 3.5,
    additionalStrengthMultiplierNeededToAttackHigh: 4.5,
    researchPercentMin: 0.3,
    researchPercentMax: 0.5,
    prioritizeCombatResearch: false,
    prioritizeFarmsEarly: false,
    enableReScouting: true,
    scoutPriorityTopPercentage: 0.3,
    reScoutPriorityThreshold: 45, // Moderate - re-scouts nearby/valuable targets
    quadrantIntelligence: true,
    enableFleetRepairs: false,
    useEffectiveStrengthCalculation: false,
    enableMultiPlanetAttacks: false,
    useStrategicTargetPriority: false,
    strategicDefense: false,
    defenderBuildChance: 0.25,
    destroyerBuildChance: 0.25,
    useBalancedFleetComposition: false,
    defenseCalculationStrategy: 'moderate',
    usePrioritizedTargetSorting: false,
    enableStrategicReinforcements: false,
  },
  [PlayerType.Computer_Hard]: {
    foodSurplusAdjustmentLowMultiplier: -0.5,
    foodSurplusAdjustmentHighMultiplier: 0,
    useRandomizedEnergySurplus: false,
    energySurplusMultiplier: 0,
    energySurplusAdder: 0.5, // base + (planets - 1) * 0.5
    mineralOverestimationLow: 1.1,
    mineralOverestimationHigh: 1.5,
    additionalStrengthMultiplierNeededToAttackLow: 2.5,
    additionalStrengthMultiplierNeededToAttackHigh: 3.5,
    researchPercentMin: 0.4,
    researchPercentMax: 0.55,
    prioritizeCombatResearch: true,
    prioritizeFarmsEarly: true,
    enableReScouting: true,
    scoutPriorityTopPercentage: 0.5,
    reScoutPriorityThreshold: 95, // Selective - nearby enemy planets
    quadrantIntelligence: true,
    enableFleetRepairs: true,
    useEffectiveStrengthCalculation: true,
    enableMultiPlanetAttacks: false,
    useStrategicTargetPriority: true,
    strategicDefense: true,
    defenderBuildChance: 0.15,
    destroyerBuildChance: 0,
    useBalancedFleetComposition: true,
    defenseCalculationStrategy: 'advanced',
    usePrioritizedTargetSorting: true,
    enableStrategicReinforcements: false,
  },
  [PlayerType.Computer_Expert]: {
    foodSurplusAdjustmentLowMultiplier: 0,
    foodSurplusAdjustmentHighMultiplier: 0,
    useRandomizedEnergySurplus: false,
    energySurplusMultiplier: 0,
    energySurplusAdder: 0.25, // base + (planets - 1) * 0.25
    mineralOverestimationLow: 1.0,
    mineralOverestimationHigh: 1.3,
    additionalStrengthMultiplierNeededToAttackLow: 1.5,
    additionalStrengthMultiplierNeededToAttackHigh: 2.5,
    researchPercentMin: 0.45,
    researchPercentMax: 0.6,
    prioritizeCombatResearch: true,
    prioritizeFarmsEarly: true,
    enableReScouting: true,
    scoutPriorityTopPercentage: 0.6, // Explore top 60% - more selective than before
    reScoutPriorityThreshold: 100, // Very selective - only very close enemy planets get re-scouted
    quadrantIntelligence: true,
    enableFleetRepairs: true,
    useEffectiveStrengthCalculation: true,
    enableMultiPlanetAttacks: true,
    useStrategicTargetPriority: true,
    strategicDefense: true,
    defenderBuildChance: 0.05,
    destroyerBuildChance: 0.8,
    useBalancedFleetComposition: true,
    defenseCalculationStrategy: 'advanced',
    usePrioritizedTargetSorting: true,
    enableStrategicReinforcements: true,
  },
  // Default settings for human players (unused but required for type safety)
  [PlayerType.Human]: {
    foodSurplusAdjustmentLowMultiplier: 0,
    foodSurplusAdjustmentHighMultiplier: 0,
    useRandomizedEnergySurplus: false,
    energySurplusMultiplier: 0,
    energySurplusAdder: 0.25,
    mineralOverestimationLow: 1.0,
    mineralOverestimationHigh: 1.0,
    additionalStrengthMultiplierNeededToAttackLow: 1.0,
    additionalStrengthMultiplierNeededToAttackHigh: 1.0,
    researchPercentMin: 0.5,
    researchPercentMax: 0.5,
    prioritizeCombatResearch: true,
    prioritizeFarmsEarly: true,
    enableReScouting: true,
    scoutPriorityTopPercentage: 1.0,
    reScoutPriorityThreshold: 50, // Unused for human players
    quadrantIntelligence: false,
    enableFleetRepairs: true,
    useEffectiveStrengthCalculation: true,
    enableMultiPlanetAttacks: true,
    useStrategicTargetPriority: true,
    strategicDefense: false,
    defenderBuildChance: 0,
    destroyerBuildChance: 0,
    useBalancedFleetComposition: true,
    defenseCalculationStrategy: 'advanced',
    usePrioritizedTargetSorting: true,
    enableStrategicReinforcements: true,
  },
};

/**
 * AI Decision Log entry for visualization and debugging
 */
export interface AIDecisionLog {
  turn: number;
  playerId: string;
  playerName: string;
  decision: string;
  category: 'research' | 'building' | 'combat' | 'economy' | 'exploration' | 'population';
  details: Record<string, unknown>;
  timestamp: number;
}

export class ComputerPlayer {
  // Set to true to enable detailed AI decision-making logs
  private static DEBUG_AI = false;
  private static aiDecisions: AIDecisionLog[] = [];

  /**
   * Get AI settings for a player based on their difficulty level
   */
  private static getAISettings(player: PlayerData): AISettings {
    return aiSettingsByDifficultyLevel[player.type] || aiSettingsByDifficultyLevel[PlayerType.Computer_Normal];
  }

  private static debugLog(...args: unknown[]) {
    if (this.DEBUG_AI) {
      console.debug(...args);
    }
  }

  /**
   * Log an AI decision for later analysis
   */
  private static logDecision(
    player: PlayerData,
    currentCycle: number,
    category: AIDecisionLog['category'],
    decision: string,
    details: Record<string, unknown>,
  ): void {
    if (this.DEBUG_AI) {
      this.aiDecisions.push({
        turn: currentCycle,
        playerId: player.id,
        playerName: player.name,
        decision,
        category,
        details,
        timestamp: Date.now(),
      });
    }
  }

  /**
   * Get all AI decisions logged so far
   */
  public static getAIDecisions(): AIDecisionLog[] {
    return this.aiDecisions;
  }

  /**
   * Clear the AI decision log
   */
  public static clearAIDecisions(): void {
    this.aiDecisions = [];
  }

  /**
   * Enable or disable AI debug logging
   */
  public static setDebugMode(enabled: boolean): void {
    this.DEBUG_AI = enabled;
  }

  // ============================================================================
  // AI Command Pipeline Helpers
  // ============================================================================

  /**
   * Create a GameCommand with common AI metadata fields pre-filled.
   */
  private static createAICommand<T extends GameCommand>(
    player: PlayerData,
    commandFields: Omit<T, 'playerId' | 'timestamp' | 'commandId' | 'metadata'>,
  ): T {
    return {
      ...commandFields,
      playerId: player.id,
      timestamp: Date.now(),
      commandId: Utils.generateUniqueId(),
      metadata: { source: 'ai' as const },
    } as T;
  }

  private static onComputerSentFleet(fleet: FleetData) {
    this.debugLog('Computer Sent Fleet:', fleet);
  }

  public static computerTakeTurn(clientModel: ClientModelData, grid: Grid): GameCommand[] {
    //determine highest priority for resource usage
    //early game should be building developments and capturing/exploring planets while keeping up food production
    //mid game should be building space-platforms, high-class ships and further upgrading planets
    //late game should be strategically engaging the enemy
    //check planet production, prefer high-class planets (or even weather strategic points should be developed instead of high-class planets?)
    //if the planet has slots available and we have enough resources build (in order when we don't have)
    //

    const player = clientModel.mainPlayer;
    const ownedPlanets = clientModel.mainPlayerOwnedPlanets;
    const allCommands: GameCommand[] = [];
    const ownedPlanetsSorted = Player.getOwnedPlanetsListSorted(player, ownedPlanets);

    // Manage research allocation based on game state and difficulty
    const researchCmds = this.computerManageResearch(clientModel, grid, player, ownedPlanets, ownedPlanetsSorted);
    allCommands.push(...researchCmds);

    this.computerSetPlanetBuildGoals(clientModel, grid, player, ownedPlanets, ownedPlanetsSorted);

    const tradeCmds = this.computerSubmitTrades(clientModel, grid, player, ownedPlanets, ownedPlanetsSorted);
    allCommands.push(...tradeCmds);

    const buildCmds = this.computerBuildImprovementsAndShips(clientModel, grid, player, ownedPlanets, ownedPlanetsSorted);
    allCommands.push(...buildCmds);

    //adjust population assignments as appropriate based on planet and needs
    const popCmds = this.computerAdjustPopulationAssignments(clientModel, grid, player, ownedPlanets, ownedPlanetsSorted);
    allCommands.push(...popCmds);

    // Retreat damaged ships on planets that lack repair improvements
    const { commands: repairCmds, repairShipIds } = this.computerManageFleetRepairs(clientModel, grid, player, ownedPlanets, ownedPlanetsSorted);
    allCommands.push(...repairCmds);

    //base strategies on computer-level
    //here is the basic strategy:
    //if there are unclaimed explored planets
    //find the closest one and send a detachment, based on planet class
    //for easy level send detachments based only on distance
    //normal mode additionally prefers class 2 planets
    //hard mode additionally prefers Dead planets and considers enemy force before making an attack
    //expert mode additionally prefers asteroid belts late in the game when it needs crystal

    //send scouts to unexplored planets (harder levels of computers know where better planets are?)

    const shipCmds = this.computerSendShips(clientModel, grid, player, ownedPlanets, ownedPlanetsSorted, repairShipIds);
    allCommands.push(...shipCmds);

    return allCommands;
  }

  public static computerAdjustPopulationAssignments(
    clientModel: ClientModelData,
    _grid: Grid,
    player: PlayerData,
    ownedPlanets: PlanetById,
    ownedPlanetsSorted: PlanetData[],
  ): GameCommand[] {
    // Record starting population assignments to compute net diffs later
    const startingAssignments: Record<number, PopulationAssignments> = {};
    // Snapshot individual citizen worker types for restoration after iterative algorithm
    const citizenWorkerSnapshot: Record<number, CitizenWorkerType[]> = {};
    for (const planet of ownedPlanetsSorted) {
      startingAssignments[planet.id] = Planet.countPopulationWorkerTypes(planet);
      citizenWorkerSnapshot[planet.id] = planet.population.map(c => c.workerType);
    }

    const planetPopulationWorkerTypes: Record<number, PopulationAssignments> = {};
    const planetResourcesPerTurn: PlanetResourcesPerTurn = {};
    const totalResources = Player.getTotalResourceAmount(player, ownedPlanets);
    const allPlanets: PlanetData[] = []; //this list will be for sorting

    for (const planet of ownedPlanetsSorted) {
      planetPopulationWorkerTypes[planet.id] = Planet.countPopulationWorkerTypes(planet);
      planetResourcesPerTurn[planet.id] = Planet.getPlanetWorkerResourceGeneration(planet, player);
      allPlanets.push(planet);

      this.debugLog(
        player.name,
        'Population Assignment for planet:',
        planet.name,
        planetPopulationWorkerTypes[planet.id],
      );
    }

    const totalPopulation = Player.getTotalPopulation(player, ownedPlanets);
    let totalFoodProduction = 0;
    let totalFoodAmountOnPlanets = 0;
    let totalPlanetsWithPopulationGrowthPotential = 0; //this will always give the computers some extra food surplus to avoid starving new population
    for (const planet of ownedPlanetsSorted) {
      totalFoodAmountOnPlanets += planet.resources.food;
      totalFoodProduction += planetResourcesPerTurn[planet.id].amountPerTurn.food;
      if (planet.population.length < Planet.maxPopulation(planet)) totalPlanetsWithPopulationGrowthPotential++;
    }
    totalFoodAmountOnPlanets -= totalPopulation; //this is what we'll eat this turn

    //this is what we'll keep in surplus to avoid starving more-difficult comps
    totalFoodAmountOnPlanets -= totalPlanetsWithPopulationGrowthPotential;

    //to make the easier computers even easier we will sometimes have them generate too much food and sometimes generate too little so they starve
    const aiSettings = this.getAISettings(player);
    // Scale adjustment bounds by total population
    const adjustmentLow = Math.floor(aiSettings.foodSurplusAdjustmentLowMultiplier * totalPopulation);
    const adjustmentHigh = Math.floor(aiSettings.foodSurplusAdjustmentHighMultiplier * totalPopulation);
    const totalFoodAmountOnPlanetsAdjustment = Utils.nextRandom(adjustmentLow, adjustmentHigh + 1);

    totalFoodAmountOnPlanets += totalFoodAmountOnPlanetsAdjustment;

    this.logDecision(player, clientModel.currentCycle, 'population', 'Food surplus adjustment', {
      totalPopulation,
      adjustmentLow,
      adjustmentHigh,
      actualAdjustment: totalFoodAmountOnPlanetsAdjustment,
      foodProduction: totalFoodProduction,
      currentFoodStockpile: totalFoodAmountOnPlanets,
    });

    let oreAmountRecommended = 0;
    let iridiumAmountRecommended = 0;
    //base mineral need on desired production (build goals)
    //  for each planet with a space platform
    //    if it is a class 1 or asteroid belt (planets with the most mineral potential), recommended ore and iridium should be for a battleship
    //    otherwise recommended ore and iridum should be for a cruiser
    //  for each planet without a space platform but at least one factory
    //    recommended ore and iridum should be for a destroyer
    //  for each planet witout a factory
    //    recommended ore for a scout only

    for (const planet of ownedPlanetsSorted) {
      if (planet.id in player.planetBuildGoals) {
        const ppi = player.planetBuildGoals[planet.id];
        oreAmountRecommended += ppi.oreCost;
        iridiumAmountRecommended += ppi.iridiumCost;
      } //this happens when we have placed our build goal into the queue already
      else {
        continue;
        //add a bit more?
        //oreAmountRecommended += 2;
        //iridiumAmountRecommended += 1;
      }
    }

    //further stunt the easy computers growth by over estimating ore and iridium amount recommended
    const mineralOverestimation =
      Utils.nextRandom(
        Math.floor(aiSettings.mineralOverestimationLow * 10),
        Math.floor(aiSettings.mineralOverestimationHigh * 10) + 1,
      ) / 10.0;

    let oreAmountNeeded = Math.round(oreAmountRecommended * mineralOverestimation) - totalResources.ore;
    let iridiumAmountNeeded = Math.round(iridiumAmountRecommended * mineralOverestimation) - totalResources.iridium;
    let foodDiff = 0;
    this.debugLog(player.name, 'Mineral Needs:', oreAmountNeeded, iridiumAmountNeeded);
    const foodResourcePotentialComparer = new PlanetResourcePotentialComparer(
      planetResourcesPerTurn,
      PlanetResourceType.FOOD,
    );

    if (totalPopulation > totalFoodProduction + totalFoodAmountOnPlanets) {
      //check to see if we can add farmers to class 1 and class 2 planets
      foodDiff = totalPopulation - (totalFoodProduction + totalFoodAmountOnPlanets);
      //first try to satiate by retasking miners/workers on planets with less food amount than population
      this.debugLog(player.name, 'potential food shortage:', foodDiff);

      //gather potential planets for adding farmers to
      //TODO: this should order by planets with farms as well as planets who's population demands more food than it produces (more potential for growth)
      allPlanets.sort((a, b) => foodResourcePotentialComparer.sortFunction(a, b));

      let neededFarmers = foodDiff;
      const planetCandidatesForAddingFarmers: PlanetData[] = [];

      if (neededFarmers > 0) {
        for (const p of allPlanets) {
          const rpt = planetResourcesPerTurn[p.id];
          const pw = planetPopulationWorkerTypes[p.id];
          if (neededFarmers > 0 && rpt.amountNextWorkerPerTurn.food > 0 && (pw.miners > 0 || pw.builders > 0)) {
            planetCandidatesForAddingFarmers.push(p);
            neededFarmers -= rpt.amountNextWorkerPerTurn.food;
            if (neededFarmers <= 0) break;
          }
        }
      }

      while (foodDiff > 0) {
        let changedAssignment = false;
        for (const p of planetCandidatesForAddingFarmers) {
          const pw = planetPopulationWorkerTypes[p.id];
          let maxMiners = pw.builders; //we don't want more miners than builders when we have food shortages
          if (p.type == PlanetType.PlanetClass2) {
            if (p.builtImprovements[PlanetImprovementType.Mine] == 0) maxMiners = 0;
            else maxMiners = 1;
          }
          if (pw.miners >= maxMiners && pw.miners > 0) {
            planetResourcesPerTurn[p.id] = Planet.updatePopulationWorkerTypesByDiff(p, player, 1, -1, 0);
            pw.farmers++;
            pw.miners--;
            foodDiff -= planetResourcesPerTurn[p.id].amountNextWorkerPerTurn.food;
            changedAssignment = true;
          } else if (pw.builders > 0) {
            planetResourcesPerTurn[p.id] = Planet.updatePopulationWorkerTypesByDiff(p, player, 1, 0, -1);
            pw.farmers++;
            pw.builders--;
            foodDiff -= planetResourcesPerTurn[p.id].amountNextWorkerPerTurn.food;
            changedAssignment = true;
          }

          if (foodDiff <= 0) break;
        }

        //if we got here and didn't change anything, break out
        if (!changedAssignment) break;
      } //while (foodDiff > 0)

      //if we weren't able to satisfy the population's hunger at this point,
      // we may just have to starve
    } //we can re-task farmers at class 1 and class 2 planets (and maybe dead planets?)
    else {
      foodDiff = totalFoodProduction + totalFoodAmountOnPlanets - totalPopulation;
      this.debugLog(player.name, 'potential food surplus:', foodDiff);

      //gather potential planets for removing farmers from
      //TODO: this should order by planets without farms and planets which have more food production than it's population demands (less potential for growth)
      allPlanets.sort((a, b) => foodResourcePotentialComparer.sortFunction(a, b));
      allPlanets.reverse();

      let unneededFarmers = foodDiff;
      const planetCandidatesForRemovingFarmers: PlanetData[] = [];
      if (unneededFarmers > 0) {
        for (const p of allPlanets) {
          const rpt = planetResourcesPerTurn[p.id];
          const pw = planetPopulationWorkerTypes[p.id];
          if (unneededFarmers > 0 && unneededFarmers > rpt.amountPerWorkerPerTurn.food && pw.farmers > 0) {
            planetCandidatesForRemovingFarmers.push(p);
            unneededFarmers -= rpt.amountPerWorkerPerTurn.food;
            if (unneededFarmers <= 0) break;
          }
        }
      }

      while (foodDiff > 0) {
        let changedAssignment = false;
        for (const p of planetCandidatesForRemovingFarmers) {
          const pw = planetPopulationWorkerTypes[p.id];
          if (foodDiff < planetResourcesPerTurn[p.id].amountPerWorkerPerTurn.food) continue; //if removing this farmer would create a shortage, skip this planet

          //check if we need more minerals, otherwise prefer production
          //on terrestrial planets, make sure we have a mine before we add a miner
          const addMiner = p.type !== PlanetType.PlanetClass2 || p.builtImprovements[PlanetImprovementType.Mine] > 0;
          if (addMiner && (oreAmountNeeded > 0 || iridiumAmountNeeded > 0) && pw.farmers > 0) {
            planetResourcesPerTurn[p.id] = Planet.updatePopulationWorkerTypesByDiff(p, player, -1, 1, 0);
            pw.farmers--;
            pw.miners++;
            oreAmountNeeded -= planetResourcesPerTurn[p.id].amountNextWorkerPerTurn.ore;
            iridiumAmountNeeded -= planetResourcesPerTurn[p.id].amountNextWorkerPerTurn.iridium;
            foodDiff -= planetResourcesPerTurn[p.id].amountPerWorkerPerTurn.food;
            changedAssignment = true;
          } else if (pw.farmers > 0) {
            planetResourcesPerTurn[p.id] = Planet.updatePopulationWorkerTypesByDiff(p, player, -1, 0, 1);
            pw.farmers--;
            pw.builders++;
            foodDiff -= planetResourcesPerTurn[p.id].amountPerWorkerPerTurn.food;
            changedAssignment = true;
          }

          if (foodDiff <= 0) break;
        }

        //if we got here and didn't change anything, break out
        if (!changedAssignment) break;
      } //while (foodDiff > 0)
    }

    const mineralResourceNeeded =
      oreAmountNeeded > iridiumAmountNeeded ? PlanetResourceType.ORE : PlanetResourceType.IRIDIUM;
    const mineralResourcePotentialComparer = new PlanetResourcePotentialComparer(
      planetResourcesPerTurn,
      mineralResourceNeeded,
    );
    let oreAmountNeededWorking = oreAmountNeeded * 1.0;
    let iridiumAmountNeededWorking = iridiumAmountNeeded * 1.0;
    //next see if we need miners, look for workers to reassign (don't reassign farmers at this point)
    if (oreAmountNeeded > 0 || iridiumAmountNeeded > 0) {
      const planetCandidatesForRemovingWorkers = []; //List<Planet>

      allPlanets.sort((a, b) => mineralResourcePotentialComparer.sortFunction(a, b));

      for (const p of allPlanets) {
        if (oreAmountNeededWorking < 0 && iridiumAmountNeededWorking < 0) {
          break;
        }
        const rpt = planetResourcesPerTurn[p.id];
        const pw = planetPopulationWorkerTypes[p.id];
        //leave at least one worker on terrestrial planets, leave 2 workers if we don't have a mine yet
        let minBuilders = 0;
        let minFarmers = -1;
        if (p.type == PlanetType.PlanetClass2) {
          minBuilders = p.builtImprovements[PlanetImprovementType.Mine] == 0 ? 2 : 1;
          minFarmers = 0; //also make sure we have one farmer before reassigning a worker to be miner
        }

        if (pw.builders > minBuilders && pw.farmers > minFarmers) {
          planetCandidatesForRemovingWorkers.push(p);
          oreAmountNeededWorking -= rpt.amountNextWorkerPerTurn.ore;
          iridiumAmountNeededWorking -= rpt.amountNextWorkerPerTurn.iridium;
        }
      }

      while (oreAmountNeeded > 0 || iridiumAmountNeeded > 0) {
        let changedAssignment = false;
        for (const p of planetCandidatesForRemovingWorkers) {
          const rpt = planetResourcesPerTurn[p.id];
          const pw = planetPopulationWorkerTypes[p.id];
          //double check we have enough workers still
          let minBuilders = 1;
          if (p.builtImprovements[PlanetImprovementType.Mine] == 0) minBuilders = 2;

          if (pw.builders > minBuilders) {
            planetResourcesPerTurn[p.id] = Planet.updatePopulationWorkerTypesByDiff(p, player, 0, 1, -1);
            pw.miners++;
            pw.builders--;
            oreAmountNeeded -= rpt.amountNextWorkerPerTurn.ore;
            iridiumAmountNeeded -= rpt.amountNextWorkerPerTurn.iridium;
            changedAssignment = true;
          }

          if (oreAmountNeeded <= 0 && iridiumAmountNeeded <= 0) break;
        }

        //if we got here and didn't change anything, break out
        if (!changedAssignment) break;
      } //while (oreAmountNeeded > 0 || iridiumAmountNeeded > 0)
    } else {
      //we have enough minerals, reassign miners to workers

      const planetCandidatesForRemovingMiners = []; //List<Planet>

      allPlanets.sort((a, b) => mineralResourcePotentialComparer.sortFunction(a, b));
      allPlanets.reverse();

      for (const p of allPlanets) {
        if (oreAmountNeededWorking > 0 || iridiumAmountNeededWorking > 0) {
          break;
        }
        const rpt = planetResourcesPerTurn[p.id];
        const pw = planetPopulationWorkerTypes[p.id];
        if (pw.miners > 0) {
          planetCandidatesForRemovingMiners.push(p);
          oreAmountNeededWorking += rpt.amountPerWorkerPerTurn.ore;
          iridiumAmountNeededWorking += rpt.amountPerWorkerPerTurn.iridium;
        }
      }

      while (oreAmountNeeded < 0 && iridiumAmountNeeded < 0) {
        let changedAssignment = false;
        for (const p of planetCandidatesForRemovingMiners) {
          const rpt = planetResourcesPerTurn[p.id];
          const pw = planetPopulationWorkerTypes[p.id];
          //double check we still have miners and that we don't over compensate
          if (
            pw.miners > 0 &&
            oreAmountNeeded + rpt.amountPerWorkerPerTurn.ore < 0 &&
            iridiumAmountNeeded + rpt.amountPerWorkerPerTurn.iridium < 0
          ) {
            planetResourcesPerTurn[p.id] = Planet.updatePopulationWorkerTypesByDiff(p, player, 0, -1, 1);
            pw.miners--;
            pw.builders++;
            oreAmountNeeded += rpt.amountPerWorkerPerTurn.ore;
            iridiumAmountNeeded += rpt.amountPerWorkerPerTurn.iridium;
            changedAssignment = true;
          }

          if (oreAmountNeeded > 0 || iridiumAmountNeeded > 0) break;
        }

        //if we got here and didn't change anything, break out
        if (!changedAssignment) break;
      } //while (oreAmountNeeded < 0 || iridiumAmountNeeded < 0)
    }

    // The iterative algorithm above mutates worker types in-place (it needs intermediate state
    // to make correct decisions). Compute net diffs from the starting snapshot, then restore
    // worker types so that CommandProcessor can authoritatively apply the final assignments.
    const commands: GameCommand[] = [];
    for (const planet of ownedPlanetsSorted) {
      const ending = Planet.countPopulationWorkerTypes(planet);
      const starting = startingAssignments[planet.id];
      if (!starting) continue;

      const farmerDiff = ending.farmers - starting.farmers;
      const minerDiff = ending.miners - starting.miners;
      const builderDiff = ending.builders - starting.builders;

      if (farmerDiff !== 0 || minerDiff !== 0 || builderDiff !== 0) {
        const popCmd = this.createAICommand<UpdatePlanetWorkerAssignmentsCommand>(player, {
          type: GameCommandType.UPDATE_PLANET_WORKER_ASSIGNMENTS,
          planetId: planet.id,
          workers: { farmerDiff, minerDiff, builderDiff },
        });
        commands.push(popCmd);
      }
    }

    // Restore citizen worker types to pre-algorithm state
    // CommandProcessor will re-apply the net diffs when processing the commands
    for (const planet of ownedPlanetsSorted) {
      const snapshot = citizenWorkerSnapshot[planet.id];
      if (snapshot) {
        planet.population.forEach((c, i) => { c.workerType = snapshot[i]; });
      }
    }

    return commands;
  }

  public static computerSetPlanetBuildGoals(
    clientModel: ClientModelData,
    grid: Grid,
    player: PlayerData,
    ownedPlanets: PlanetById,
    ownedPlanetsSorted: PlanetData[],
  ) {
    //first look for planets that need build goals set, either for ships or for improvements

    const planetCandidatesForNeedingImprovements: PlanetData[] = [];
    const planetCandidatesForNeedingSpacePlatforms: PlanetData[] = [];
    const planetCandidatesForNeedingShips: PlanetData[] = [];

    const planetCountNeedingExploration = this.countPlanetsNeedingExploration(clientModel, grid, player, ownedPlanets);

    for (const p of ownedPlanetsSorted) {
      //if this planet doesn't already have a build goal in player.planetBuildGoals
      if (!(p.id in player.planetBuildGoals)) {
        if (p.buildQueue.length) {
          this.debugLog(player.name, 'build queue on:', p.name, p.buildQueue[0]);
        }
        if (p.buildQueue.length <= 1) {
          const canBuildSpacePlatform =
            Planet.getSpacePlatformCount(p, true) < Research.getMaxSpacePlatformCount(player.research) &&
            p.builtImprovements[PlanetImprovementType.Factory] > 0;
          //even if we have something in queue we might want to set a goal to save up resources?

          //always check for improvements in case we need to destroy some
          planetCandidatesForNeedingImprovements.push(p);
          if (ownedPlanetsSorted.length > 1) {
            if (canBuildSpacePlatform) {
              planetCandidatesForNeedingSpacePlatforms.push(p);
            } else {
              planetCandidatesForNeedingShips.push(p);
            }
          } else {
            if (planetCountNeedingExploration != 0) {
              //if we need to explore some planets before building a space platform, do so
              planetCandidatesForNeedingShips.push(p);
            } else if (canBuildSpacePlatform) {
              planetCandidatesForNeedingSpacePlatforms.push(p);
            } else {
              planetCandidatesForNeedingShips.push(p);
            }
          }
        }
      }
    }

    //space platforms
    for (const p of planetCandidatesForNeedingSpacePlatforms) {
      player.planetBuildGoals[p.id] = PlanetProductionItem.constructStarShipInProduction(StarShipType.SpacePlatform);
    }

    const origRecommendedMines = 2;
    //build improvements
    for (const p of planetCandidatesForNeedingImprovements) {
      //planet class 2 should have 3 farms and 2 mines
      //planet class 1 should have 2 farms and 0 mines
      //dead planets should have 0 farms and 1 mine
      //asteroids should have 0 farms and 1 mine
      //otherwise build 1 factory if none exist
      //otherwise build 1 colony if none exist
      //otherwise build factories to recommended amount
      //otherwise build a spaceport space platform is none exist
      //otherwise colonies till we're filled up

      let recommendedFarms = 0;
      let recommendedMines = 0;
      let recommendedFactories = 1;
      const recommendedColonies = 1;

      const farmCount = Planet.builtAndBuildQueueImprovementTypeCount(p, PlanetImprovementType.Farm);
      const mineCount = Planet.builtAndBuildQueueImprovementTypeCount(p, PlanetImprovementType.Mine);
      const factoryCount = Planet.builtAndBuildQueueImprovementTypeCount(p, PlanetImprovementType.Factory);
      const colonyCount = Planet.builtAndBuildQueueImprovementTypeCount(p, PlanetImprovementType.Colony);

      //NOTE: we aren't checking gold for the purposes of farms, we'll just build them
      if (p.type == PlanetType.PlanetClass2) {
        if (ownedPlanetsSorted.length == 1) {
          //until we have another planet we need to build some mines to get resources
          recommendedFarms = 3;
          recommendedMines = origRecommendedMines;
        } else {
          recommendedFarms = 4;
          recommendedMines = 0;
        }
      } else if (p.type == PlanetType.PlanetClass1) {
        recommendedFarms = 2;
      } else if (p.type == PlanetType.DeadPlanet) {
        recommendedMines = 1;
      } else if (p.type == PlanetType.AsteroidBelt) {
        recommendedMines = 1;
      }
      recommendedFactories = p.maxImprovements - recommendedMines - recommendedFarms - recommendedColonies;

      //make sure farms are built before mines
      if (farmCount < recommendedFarms) {
        player.planetBuildGoals[p.id] = PlanetProductionItem.constructPlanetImprovement(PlanetImprovementType.Farm);
      } else if (mineCount < recommendedMines) {
        player.planetBuildGoals[p.id] = PlanetProductionItem.constructPlanetImprovement(PlanetImprovementType.Mine);
      } else if (factoryCount == 0 && recommendedFactories > 0) {
        player.planetBuildGoals[p.id] = PlanetProductionItem.constructPlanetImprovement(PlanetImprovementType.Factory);
      } else if (colonyCount < recommendedColonies) {
        player.planetBuildGoals[p.id] = PlanetProductionItem.constructPlanetImprovement(PlanetImprovementType.Colony);
      } else if (factoryCount < recommendedFactories) {
        player.planetBuildGoals[p.id] = PlanetProductionItem.constructPlanetImprovement(PlanetImprovementType.Factory);
      } else if (farmCount > recommendedFarms) {
        player.planetBuildGoals[p.id] = PlanetProductionItem.constructPlanetImprovementToDestroy(
          PlanetImprovementType.Farm,
        );
      } else if (mineCount > recommendedMines) {
        player.planetBuildGoals[p.id] = PlanetProductionItem.constructPlanetImprovementToDestroy(
          PlanetImprovementType.Mine,
        );
      } else if (factoryCount > recommendedFactories) {
        player.planetBuildGoals[p.id] = PlanetProductionItem.constructPlanetImprovementToDestroy(
          PlanetImprovementType.Factory,
        );
      } else if (colonyCount > recommendedColonies) {
        player.planetBuildGoals[p.id] = PlanetProductionItem.constructPlanetImprovementToDestroy(
          PlanetImprovementType.Colony,
        );
      }
      if (player.planetBuildGoals[p.id]) {
        this.debugLog(player.name, 'Planet:', p.name, 'Improvement Build Goal:', player.planetBuildGoals[p.id]);
        this.logDecision(player, clientModel.currentCycle, 'building', 'Set improvement build goal', {
          planetName: p.name,
          planetType: p.type,
          improvementType: player.planetBuildGoals[p.id].improvementData?.type,
          isDestroy: player.planetBuildGoals[p.id].itemType === PlanetProductionItemType.PlanetImprovementToDestroy,
          currentFarms: p.builtImprovements[PlanetImprovementType.Farm],
          currentMines: p.builtImprovements[PlanetImprovementType.Mine],
          currentFactories: p.builtImprovements[PlanetImprovementType.Factory],
        });
      }

      //after all that we should be ready to set fleet goals
    }

    //build ships
    for (const p of planetCandidatesForNeedingShips) {
      // Skip planets with non-empty build queues - they're already building something
      if (p.buildQueue.length > 0) {
        continue;
      }

      // Don't set new ship goals if planet already has one (even if queue is empty)
      // This prevents overwriting goals that couldn't be afforded yet
      if (player.planetBuildGoals[p.id] && player.planetBuildGoals[p.id].starshipData) {
        continue;
      }

      const mineCount = Planet.builtAndBuildQueueImprovementTypeCount(p, PlanetImprovementType.Mine);
      if (
        player.planetBuildGoals[p.id] &&
        (ownedPlanetsSorted.length > 3 || ownedPlanetsSorted.length == 1) &&
        mineCount < origRecommendedMines
      ) {
        //do this for now so that the computer builds improvements before too much scouting, however might want to revisit this so that there is some scouting done before all buildings are built
        continue;
      }
      // Fleet composition strategy based on difficulty and game state
      const aiSettings = this.getAISettings(player);

      // Strategic defense: if planet has no space platform and no defenders, build a defender first
      const starshipCounts = Fleet.countStarshipsByType(p.planetaryFleet);
      if (
        aiSettings.strategicDefense &&
        Planet.getSpacePlatformCount(p, false) === 0 &&
        starshipCounts.defenders === 0
      ) {
        player.planetBuildGoals[p.id] = PlanetProductionItem.constructStarShipInProduction(StarShipType.SystemDefense);
        this.logDecision(player, clientModel.currentCycle, 'building', 'Strategic defense: build defender for undefended planet', {
          planetName: p.name,
          planetType: p.type,
          hasSpacePlatform: false,
        });
        continue;
      }

      const buildDefenders = Utils.nextRandom(0, 100) / 100 < aiSettings.defenderBuildChance;
      const buildDestroyers = !buildDefenders && Utils.nextRandom(0, 100) / 100 < aiSettings.destroyerBuildChance;

      if (Planet.getSpacePlatformCount(p, false) > 0 && !buildDefenders) {
        // With space platforms, build balanced mixed fleets
        // Hard/Expert prefer balanced compositions, Normal/Easy more random
        if (aiSettings.useBalancedFleetComposition) {
          // Maintain 1:1:1 destroyer:cruiser:battleship ratio with scout support
          const rand = Utils.nextRandom(3);
          if (rand == 0) {
            player.planetBuildGoals[p.id] = PlanetProductionItem.constructStarShipInProduction(StarShipType.Destroyer);
          } else if (rand == 1) {
            player.planetBuildGoals[p.id] = PlanetProductionItem.constructStarShipInProduction(StarShipType.Cruiser);
          } else {
            player.planetBuildGoals[p.id] = PlanetProductionItem.constructStarShipInProduction(StarShipType.Battleship);
          }
        } else {
          // Normal/Easy: more random distribution
          const rand = Utils.nextRandom(4);
          if (rand < 2) {
            if (rand % 2 == 0)
              player.planetBuildGoals[p.id] = PlanetProductionItem.constructStarShipInProduction(
                StarShipType.Battleship,
              );
            else
              player.planetBuildGoals[p.id] = PlanetProductionItem.constructStarShipInProduction(
                StarShipType.Destroyer,
              );
          } else {
            if (rand % 2 == 1)
              player.planetBuildGoals[p.id] = PlanetProductionItem.constructStarShipInProduction(StarShipType.Cruiser);
            else
              player.planetBuildGoals[p.id] = PlanetProductionItem.constructStarShipInProduction(
                StarShipType.Destroyer,
              );
          }
        }
      } else if (planetCountNeedingExploration != 0) {
        //if there are unexplored planets still, build some scouts
        this.debugLog(player.name, planetCountNeedingExploration, 'Planets needing exploration, building scouts');
        player.planetBuildGoals[p.id] = PlanetProductionItem.constructStarShipInProduction(StarShipType.Scout);
      } else if (p.builtImprovements[PlanetImprovementType.Factory] > 0 && buildDestroyers) {
        //NOTE: this actually never gets hit because right now we're always building scouts, then spaceplatforms, then above applies
        player.planetBuildGoals[p.id] = PlanetProductionItem.constructStarShipInProduction(StarShipType.Destroyer);
      } else if (clientModel.currentCycle % 4 == 0 && buildDefenders) {
        //else create defender (but only sometimes so we save energy)
        player.planetBuildGoals[p.id] = PlanetProductionItem.constructStarShipInProduction(StarShipType.SystemDefense);
      }
      if (player.planetBuildGoals[p.id]) {
        this.debugLog(player.name, 'Planet:', p.name, 'StarShip Build Goal:', player.planetBuildGoals[p.id]);
        this.logDecision(player, clientModel.currentCycle, 'building', 'Set ship build goal', {
          planetName: p.name,
          shipType: player.planetBuildGoals[p.id].starshipData?.type,
          hasSpacePlatform: Planet.getSpacePlatformCount(p, false) > 0,
          needsExploration: planetCountNeedingExploration > 0,
          buildDefenders,
          buildDestroyers,
          balancedComposition: aiSettings.useBalancedFleetComposition,
        });
      }
    }
  }

  public static computerSubmitTrades(
    _clientModel: ClientModelData,
    _grid: Grid,
    player: PlayerData,
    ownedPlanets: PlanetById,
    ownedPlanetsSorted: PlanetData[],
  ): GameCommand[] {
    const commands: GameCommand[] = [];

    //first decide if we want to trade based on resource prices and needed resources (based on planet build goals)
    const totalPopulation = Player.getTotalPopulation(player, ownedPlanets);
    const totalResources = Player.getTotalResourceAmount(player, ownedPlanets);

    // Early return if player has no owned planets
    if (ownedPlanetsSorted.length === 0) {
      return commands;
    }

    let energyDesired = 0;
    let oreDesired = 0;
    let iridiumDesired = 0;
    for (const ppi of Object.values(player.planetBuildGoals)) {
      energyDesired += ppi.energyCost;
      oreDesired += ppi.oreCost;
      iridiumDesired += ppi.iridiumCost;
    }
    const purchaseMultiplier = 0.25;
    const tradesToExecute: {
      resourceType: TradingCenterResourceType;
      amount: number;
      tradeType: TradeType;
    }[] = [];
    let amount = 0;
    if (totalResources.energy < energyDesired) {
      //try to sell resources
      //only sell resources when you have far more than you need
      if (totalResources.food >= totalPopulation * 4) {
        //sell some food
        amount = Math.floor(totalResources.food * purchaseMultiplier);
        tradesToExecute.push({
          resourceType: TradingCenterResourceType.FOOD,
          amount,
          tradeType: TradeType.SELL,
        });
      }
      if (totalResources.ore >= oreDesired * 2) {
        amount = Math.floor(totalResources.ore * purchaseMultiplier);
        tradesToExecute.push({
          resourceType: TradingCenterResourceType.ORE,
          amount,
          tradeType: TradeType.SELL,
        });
      }

      if (totalResources.iridium >= iridiumDesired * 2) {
        amount = Math.floor(totalResources.iridium * purchaseMultiplier);
        tradesToExecute.push({
          resourceType: TradingCenterResourceType.IRIDIUM,
          amount,
          tradeType: TradeType.SELL,
        });
      }
    } else if (totalResources.energy > energyDesired * 1.2) {
      //try to buy resources
      if (totalResources.food <= totalPopulation * 1.2) {
        //buy some food
        const amount = Math.floor(totalPopulation * purchaseMultiplier);
        tradesToExecute.push({
          resourceType: TradingCenterResourceType.FOOD,
          amount,
          tradeType: TradeType.BUY,
        });
      }

      if (totalResources.ore <= oreDesired * 1.2) {
        const amount = Math.floor(oreDesired * purchaseMultiplier);
        tradesToExecute.push({
          resourceType: TradingCenterResourceType.ORE,
          amount,
          tradeType: TradeType.BUY,
        });
      }
      if (totalResources.iridium <= iridiumDesired * 1.2) {
        const amount = Math.floor(iridiumDesired * purchaseMultiplier);
        tradesToExecute.push({
          resourceType: TradingCenterResourceType.IRIDIUM,
          amount,
          tradeType: TradeType.BUY,
        });
      }
    }

    const resourceTypeToString: Record<number, string> = {
      [TradingCenterResourceType.FOOD]: 'food',
      [TradingCenterResourceType.ORE]: 'ore',
      [TradingCenterResourceType.IRIDIUM]: 'iridium',
    };

    for (const trade of tradesToExecute) {
      if (trade.amount > 0) {
        this.debugLog(player.name, 'Submitted a Trade: ', trade);

        const tradeCmd = this.createAICommand<SubmitTradeCommand>(player, {
          type: GameCommandType.SUBMIT_TRADE,
          tradeId: Utils.generateUniqueId(),
          tradeData: {
            resourceType: resourceTypeToString[trade.resourceType] || 'food',
            amount: trade.amount,
            action: trade.tradeType === TradeType.BUY ? 'buy' : 'sell',
          },
        });
        commands.push(tradeCmd);
      } else {
        this.debugLog(player.name, 'Trade found with zero amount.', trade);
      }
    }

    return commands;
  }

  public static computerBuildImprovementsAndShips(
    clientModel: ClientModelData,
    _grid: Grid,
    player: PlayerData,
    ownedPlanets: PlanetById,
    ownedPlanetsSorted: PlanetData[],
  ): GameCommand[] {
    const commands: GameCommand[] = [];
    const totalResources = Player.getTotalResourceAmount(player, ownedPlanets);
    //determine energy surplus needed to ship food
    const aiSettings = this.getAISettings(player);

    // Calculate energy surplus based on difficulty strategy:
    // Easy/Normal: Randomize to sometimes starve (less aggressive)
    // Hard/Expert: Scale with empire size (more consistent)
    let energySurplus = player.lastTurnFoodNeededToBeShipped;
    if (aiSettings.useRandomizedEnergySurplus) {
      // Easy/Normal: random from 0 to (base + 1) / divisor
      // energySurplusMultiplier IS the divisor (4 for Easy, 2 for Normal)
      const maxEnergy = (energySurplus + 1) / aiSettings.energySurplusMultiplier;
      energySurplus = Utils.nextRandom(0, maxEnergy);
    } else {
      // Hard/Expert: base + (planets - 1) * adder
      energySurplus += (ownedPlanetsSorted.length - 1) * aiSettings.energySurplusAdder;
    }

    //build improvements and ships based on build goals
    for (const p of ownedPlanetsSorted) {
      if (p.buildQueue.length == 0) {
        if (p.id in player.planetBuildGoals) {
          const ppi = player.planetBuildGoals[p.id];
          //check resources
          if (
            totalResources.energy - ppi.energyCost > energySurplus &&
            totalResources.ore - ppi.oreCost >= 0 &&
            totalResources.iridium - ppi.iridiumCost >= 0
          ) {
            // Emit command based on production item type (build vs demolish)
            if (ppi.itemType === PlanetProductionItemType.PlanetImprovementToDestroy) {
              const demolishCmd = this.createAICommand<DemolishImprovementCommand>(player, {
                type: GameCommandType.DEMOLISH_IMPROVEMENT,
                planetId: p.id,
                productionItem: ppi,
              });
              commands.push(demolishCmd);
            } else {
              const buildCmd = this.createAICommand<QueueProductionItemCommand>(player, {
                type: GameCommandType.QUEUE_PRODUCTION_ITEM,
                planetId: p.id,
                productionItem: ppi,
              });
              commands.push(buildCmd);
            }

            this.logDecision(player, clientModel.currentCycle, 'building', 'Enqueued production item', {
              planetName: p.name,
              itemType: ppi.itemType,
              shipType: ppi.starshipData?.type,
              energyCost: ppi.energyCost,
              oreCost: ppi.oreCost,
              iridiumCost: ppi.iridiumCost,
              energyRemaining: totalResources.energy - ppi.energyCost,
              energySurplusRequired: energySurplus,
            });
            delete player.planetBuildGoals[p.id];
          } else {
            // Can't afford this goal yet - reserve resources by subtracting from total
            // This prevents lower-priority planets from spending resources needed by higher-priority planets
            totalResources.energy -= ppi.energyCost;
            totalResources.ore -= ppi.oreCost;
            totalResources.iridium -= ppi.iridiumCost;
          }
        } //could this be a problem?
        else {
          continue;
        }
      }
    }

    return commands;
  }

  public static computerSendShips(
    clientModel: ClientModelData,
    grid: Grid,
    player: PlayerData,
    ownedPlanets: PlanetById,
    ownedPlanetsSorted: PlanetData[],
    initialCommittedShipIds?: Set<string>,
  ): GameCommand[] {
    const commands: GameCommand[] = [];
    // Track ships committed to commands this turn (since mutations happen later via CommandProcessor)
    const committedShipIds = new Set<string>(initialCommittedShipIds);
    //easy computer sends ships to closest planet at random
    //normal computers keep detachments of ships as defence as deemed necessary based on scouted enemy forces and planet value
    //hard computers also prefer planets based on class, location, and fleet defence
    //expert computers also amass fleets at strategic planets,
    //when two planets have ship building capabilities (i.e. have at least one factory),
    //and a 3rd desired planet is unowned, the further of the two owned planets sends it's ships to the closer as reinforcements

    //all but easy computers will also re-scout enemy planets after a time to re-establish intelligence

    const aiSettings = ComputerPlayer.getAISettings(player);
    const planetCandidatesForSendingShips = [];
    for (const p of ownedPlanetsSorted) {
      if (Fleet.countMobileStarships(p.planetaryFleet) > 0) {
        if (aiSettings.defenseCalculationStrategy === 'simple') {
          //easy computers can send ships as long as there is somthing to send
          planetCandidatesForSendingShips.push(p);
          this.logDecision(player, clientModel.currentCycle, 'combat', 'Planet can send ships', {
            planetName: p.name,
            mobileShips: Fleet.countMobileStarships(p.planetaryFleet),
            totalStrength: Fleet.determineFleetStrength(p.planetaryFleet),
          });
        } else {
          let strengthToDefend = 0;

          if (this.countPlanetsNeedingExploration(clientModel, grid, player, ownedPlanets) != 0) {
            //this is done because of how the goals are set right now,
            //we don't want the computer defending with all of it's ships when there is exploring to be done
            strengthToDefend = 0;
          } else if (p.builtImprovements[PlanetImprovementType.Factory] > 0) {
            //if we can build ships it is probably later in the game and we should start defending this planet
            strengthToDefend = Math.floor(Math.pow(p.type, 2) * 4); //defense based on planet type
          }

          // Strategic defense: retain a garrison on planets without space platforms
          if (aiSettings.strategicDefense && Planet.getSpacePlatformCount(p, false) === 0) {
            // Minimum defense based on planet type value (higher-value planets get more)
            const minDefense = Math.floor(Math.pow(p.type, 2) * 2);
            strengthToDefend = Math.max(strengthToDefend, minDefense);
          }

          if (aiSettings.defenseCalculationStrategy === 'advanced') {
            //base defense upon enemy fleet strength within a certain range of last known planets
            // as well as if there are ships in queue and estimated time till production

            //TODO: we should get all enemy planets within a certain range instead of just the closest one
            const closestUnownedPlanetResults = this.getClosestUnownedPlanet(clientModel, grid, ownedPlanets, p);
            if (closestUnownedPlanetResults.planet) {
              if (closestUnownedPlanetResults.planet.id in player.lastKnownPlanetFleetStrength) {
                strengthToDefend += Fleet.determineFleetStrength(
                  player.lastKnownPlanetFleetStrength[closestUnownedPlanetResults.planet.id].fleetData,
                  true,
                );
              } else if (closestUnownedPlanetResults.planet.id in player.knownPlanetIds) {
                const closestType = (closestUnownedPlanetResults.planet as { type?: PlanetType | null }).type ?? 0;
                strengthToDefend += Math.floor(Math.pow(closestType, 2) * 4);
              }
            }

            const turnsToCompleteStarship = Planet.buildQueueContainsMobileStarship(p);
            if (turnsToCompleteStarship) {
              if (turnsToCompleteStarship.turnsToComplete <= closestUnownedPlanetResults.minDistance + 1) {
                //if we can build this before an enemy can get here
                strengthToDefend -= turnsToCompleteStarship.starshipStrength;
              }
            }
          }

          if (Fleet.determineFleetStrength(p.planetaryFleet) > strengthToDefend) {
            planetCandidatesForSendingShips.push(p); //TODO: for some computer levels below we should also leave a defending detachment based on strength to defend, etc...
          }
        }
      }
    }

    const planetCandidatesForInboundScouts = [];
    const planetCandidatesForInboundAttackingFleets = [];
    if (planetCandidatesForSendingShips.length > 0) {
      for (const p of clientModel.clientPlanets) {
        if (!(p.id in ownedPlanets) && !Player.planetContainsFriendlyInboundFleet(player, p)) {
          //exploring/attacking inbound fleets to unowned planets should be excluded
          if (this.planetNeedsExploration(p, clientModel, grid, player, ownedPlanets)) {
            planetCandidatesForInboundScouts.push(p);
          } else {
            //TODO: we might still want to gather fleets strategically
            planetCandidatesForInboundAttackingFleets.push(p);
          }
        }
      }
      this.logDecision(player, clientModel.currentCycle, 'combat', 'Target analysis', {
        planetsToScout: planetCandidatesForInboundScouts.length,
        planetsToAttack: planetCandidatesForInboundAttackingFleets.length,
        totalUnownedPlanets: clientModel.clientPlanets.filter((p) => !(p.id in ownedPlanets)).length,
      });
    }

    //computer should send one available ship to unexplored planets (TODO: later build scouts/destroyers as appropriate for this)
    //computer should gather fleets strategically at fronts close to unowned planets (TODO: later base this on last known force strength)
    //
    //new send ship logic:
    // for each planet that can send ships
    //  get list of the closest unowned planets
    //   if it is unexplored (and we don't already have an inbound fleet), send a one ship detachment
    //   if it is explored and if we have more strength than the last known strength on planet (and we don't already have an inbound fleet), send a detachment

    //first sort planet candidates for inbound fleets by closest to home planet
    if (player.homePlanetId && player.homePlanetId in ownedPlanets) {
      //just to make sure
      const homePlanet = ownedPlanets[player.homePlanetId];
      if (!aiSettings.usePrioritizedTargetSorting) {
        const planetDistanceComparer = new PlanetDistanceComparer(grid, homePlanet);
        planetCandidatesForInboundAttackingFleets.sort((a, b) => planetDistanceComparer.sortFunction(a, b));
        planetCandidatesForInboundScouts.sort((a, b) => planetDistanceComparer.sortFunction(a, b));
      } else {
        //hard and expert computer will sort with a bit of complexly (based on value and last known strength as well as distance)
        const planetValueDistanceStrengthComparer = new PlanetDistanceComparer(
          grid,
          homePlanet,
          player.lastKnownPlanetFleetStrength,
        );
        planetCandidatesForInboundAttackingFleets.sort((a, b) =>
          planetValueDistanceStrengthComparer.sortFunction(a, b),
        );
        planetCandidatesForInboundScouts.sort((a, b) => planetValueDistanceStrengthComparer.sortFunction(a, b));
      }
    }

    const planetCandidatesForInboundReinforcements = [];
    if (aiSettings.enableStrategicReinforcements) {
      for (const p of ownedPlanetsSorted) {
        if (p.builtImprovements[PlanetImprovementType.Factory] > 0) {
          planetCandidatesForInboundReinforcements.push(p);
        }
      }
    }

    this.debugLog(
      player.name,
      'planetCandidatesForSendingShips:',
      planetCandidatesForSendingShips.length,
      'planetCandidatesForInboundScouts:',
      planetCandidatesForInboundScouts.length,
      'planetCandidatesForInboundAttackingFleets:',
      planetCandidatesForInboundAttackingFleets.length,
      'planetCandidatesForInboundReinforcements:',
      planetCandidatesForInboundReinforcements.length,
    );

    if (planetCandidatesForSendingShips.length > 0) {
      for (let i = planetCandidatesForInboundScouts.length - 1; i >= 0; i--) {
        const pEnemyInbound = planetCandidatesForInboundScouts[i];

        // For exploration missions, prioritize planets with scouts/destroyers over expensive ships
        // Sort by: 1) ship type suitability (scouts > destroyers > cruisers > battleships)
        //          2) distance to target (closer is better)
        planetCandidatesForSendingShips.sort((a, b) => {
          const aShipCounts = Fleet.countStarshipsByType(a.planetaryFleet);
          const bShipCounts = Fleet.countStarshipsByType(b.planetaryFleet);

          // Calculate "exploration suitability score" (lower is better for cheaper ships)
          // Scouts = 1, Destroyers = 2, Cruisers = 3, Battleships = 4
          const aScore = aShipCounts.scouts > 0 ? 1 : aShipCounts.destroyers > 0 ? 2 : aShipCounts.cruisers > 0 ? 3 : 4;
          const bScore = bShipCounts.scouts > 0 ? 1 : bShipCounts.destroyers > 0 ? 2 : bShipCounts.cruisers > 0 ? 3 : 4;

          // Primary sort: prefer cheaper ships for exploration
          if (aScore !== bScore) {
            return aScore - bScore;
          }

          // Secondary sort: prefer closer planets
          const distanceComparer = new PlanetDistanceComparer(grid, pEnemyInbound);
          return distanceComparer.sortFunction(a, b);
        });

        // Iterate from start of list (best candidates first) to send scouts preferentially
        let fleetSent = false;
        for (let j = 0; j < planetCandidatesForSendingShips.length; j++) {
          const pFriendly = planetCandidatesForSendingShips[j];

          // Check what type of ship would be sent from this planet (excluding already-committed ships)
          const uncommittedShips = pFriendly.planetaryFleet.starships.filter(s => !committedShipIds.has(s.id));
          const hasScoutsOrDestroyers = uncommittedShips.some(
            s => s.type === StarShipType.Scout || s.type === StarShipType.Destroyer,
          );

          // For exploration, only send scouts or destroyers
          // Skip planets that would send cruisers/battleships
          if (!hasScoutsOrDestroyers) {
            continue;
          }

          //send smallest detachment possible
          const inboundPlanet = planetCandidatesForInboundScouts[i];

          // Check if there's already a fleet heading to this planet
          // This prevents sending multiple scouts to the same unexplored planet
          if (Player.planetContainsFriendlyInboundFleet(player, inboundPlanet)) {
            continue; // Skip this planet, already has a fleet en route
          }

          // Pick the smallest available uncommitted ship (scout preferred, then destroyer)
          // without mutating the fleet — CommandProcessor will handle the actual split
          let selectedShipId: string | undefined;
          let selectedShipType: StarShipType | undefined;

          const uncommittedScouts = uncommittedShips.filter(s => s.type === StarShipType.Scout);
          const uncommittedDestroyers = uncommittedShips.filter(s => s.type === StarShipType.Destroyer);

          if (uncommittedScouts.length > 0) {
            selectedShipId = uncommittedScouts[0].id;
            selectedShipType = StarShipType.Scout;
          } else if (uncommittedDestroyers.length > 0) {
            selectedShipId = uncommittedDestroyers[0].id;
            selectedShipType = StarShipType.Destroyer;
          }

          if (selectedShipId && selectedShipType !== undefined) {
            const shipIds = {
              scouts: selectedShipType === StarShipType.Scout ? [selectedShipId] : [],
              destroyers: selectedShipType === StarShipType.Destroyer ? [selectedShipId] : [],
              cruisers: [] as string[],
              battleships: [] as string[],
            };
            const fleetId = player.nextFleetId++;

            const sendCmd = this.createAICommand<SendShipsCommand>(player, {
              type: GameCommandType.SEND_SHIPS,
              fromPlanetId: pFriendly.id,
              toPlanetId: inboundPlanet.id,
              fleetId,
              shipIds,
            });
            commands.push(sendCmd);
            committedShipIds.add(selectedShipId);
            this.logDecision(player, clientModel.currentCycle, 'exploration', 'Sent exploration fleet', {
              fromPlanet: pFriendly.name,
              toPlanet: inboundPlanet.name,
              shipType: selectedShipType,
              distance: Grid.getHexDistanceForMidPoints(
                grid,
                pFriendly.boundingHexMidPoint,
                inboundPlanet.boundingHexMidPoint,
              ),
              planetsNeedingExploration: planetCandidatesForInboundScouts.length,
            });

            // Remove planet from candidates if all mobile ships are committed
            const remainingMobile = pFriendly.planetaryFleet.starships.filter(
              s => !committedShipIds.has(s.id) && s.type !== StarShipType.SpacePlatform,
            );
            if (remainingMobile.length === 0) {
              planetCandidatesForSendingShips.splice(j, 1);
            }

            fleetSent = true;
            // Successfully sent a scout - move to next exploration target
            break;
          } else {
            console.error('No scout or destroyer found for exploration!');
          }
        }

        // If no planet could send scouts/destroyers, we're done with exploration
        if (!fleetSent) {
          break;
        }

        if (planetCandidatesForSendingShips.length == 0) break;
      }
    }

    //next for each candidate for inbound attacking fleets, sort the candidates for sending ships by closest first

    this.logDecision(player, clientModel.currentCycle, 'combat', 'Starting attack phase', {
      planetsCanSendShips: planetCandidatesForSendingShips.length,
      planetsToAttack: planetCandidatesForInboundAttackingFleets.length,
    });

    // Expert AI: Use strategic target value to prioritize attacks
    if (aiSettings.useStrategicTargetPriority) {
      // Calculate strategic value for each target
      const targetValues = planetCandidatesForInboundAttackingFleets.map((target) => ({
        planet: target,
        value: this.calculatePlanetTargetValue(target, player, ownedPlanets, clientModel, grid),
      }));

      // Log target values for debugging
      this.logDecision(player, clientModel.currentCycle, 'combat', 'Strategic target evaluation', {
        totalTargets: targetValues.length,
        targetDetails: targetValues.map((tv) => ({
          planetName: tv.planet.name,
          planetType: tv.planet.type,
          value: tv.value,
          hasIntelligence: !!player.lastKnownPlanetFleetStrength[tv.planet.id],
          lastKnownOwner: player.lastKnownPlanetFleetStrength[tv.planet.id]?.lastKnownOwnerId,
        })),
      });

      // Sort by strategic value (highest first) - modify array in place
      targetValues.sort((a, b) => b.value - a.value);

      // Clear and repopulate based on strategic value
      const highValueTargets = targetValues.filter((tv) => tv.value > 0).map((tv) => tv.planet);

      this.logDecision(player, clientModel.currentCycle, 'combat', 'Strategic target filtering', {
        beforeFiltering: targetValues.length,
        afterFiltering: highValueTargets.length,
        filteredOut: targetValues.length - highValueTargets.length,
        highValueTargetNames: highValueTargets.map((p) => p.name),
      });

      planetCandidatesForInboundAttackingFleets.length = 0;
      planetCandidatesForInboundAttackingFleets.push(...highValueTargets);
    }

    //look for closest planet to attack first
    for (let i = planetCandidatesForInboundAttackingFleets.length - 1; i >= 0; i--) {
      const pEnemyInbound = planetCandidatesForInboundAttackingFleets[i];

      if (!aiSettings.usePrioritizedTargetSorting) {
        const planetDistanceComparer = new PlanetDistanceComparer(grid, pEnemyInbound);
        planetCandidatesForSendingShips.sort((a, b) => planetDistanceComparer.sortFunction(a, b));
      } // harder computers should start with planets with more ships and/or reinforce closer planets from further planets with more ships
      else {
        const planetValueDistanceStrengthComparer = new PlanetDistanceComparer(
          grid,
          pEnemyInbound,
          player.lastKnownPlanetFleetStrength,
        );
        planetCandidatesForSendingShips.sort((a, b) => planetValueDistanceStrengthComparer.sortFunction(a, b));
        //because the PlanetValueDistanceStrengthComparer prefers weakest planets, we want the opposite in this case
        //so we want to prefer sending from asteroid belts with high strength value
        planetCandidatesForSendingShips.reverse();
      }

      //in order to slow the agression of the easier computers we want to only attack when we have a multiple of the enemy fleet
      const additionalStrengthMultiplierNeededToAttack =
        Utils.nextRandom(
          Math.floor(aiSettings.additionalStrengthMultiplierNeededToAttackLow * 10),
          Math.floor(aiSettings.additionalStrengthMultiplierNeededToAttackHigh * 10) + 1,
        ) / 10.0;

      let fleetSent = false;

      // Check if target already has friendly inbound fleet before attempting attack
      if (Player.planetContainsFriendlyInboundFleet(player, pEnemyInbound)) {
        this.logDecision(player, clientModel.currentCycle, 'combat', 'Skipped target - fleet already en route', {
          targetPlanet: pEnemyInbound.name,
        });
        continue; // Skip to next target planet
      }

      // Expert AI: Try to coordinate multi-planet attacks for high-value targets
      if (aiSettings.enableMultiPlanetAttacks && planetCandidatesForSendingShips.length >= 2) {
        // Check if we can overwhelm this target with multiple fleets
        let estimatedEnemyStrength = Math.floor(Math.pow((pEnemyInbound.type ?? 0) + 1, 2) * 4);
        let enemyHasSpacePlatform = false;

        const lkpfs = player.lastKnownPlanetFleetStrength[pEnemyInbound.id];
        if (lkpfs) {
          estimatedEnemyStrength = Fleet.determineFleetStrength(lkpfs.fleetData);
          enemyHasSpacePlatform = Fleet.getStarshipsByType(lkpfs.fleetData)[StarShipType.SpacePlatform].length > 0;
        }

        // Calculate total available strength from multiple planets
        let totalAvailableStrength = 0;
        const contributingPlanets: PlanetData[] = [];

        for (const pFriendly of planetCandidatesForSendingShips) {
          const starshipCounts = Fleet.countStarshipsByType(pFriendly.planetaryFleet);
          const testFleet = Fleet.generateFleetWithShipCount(
            0,
            starshipCounts.scouts,
            starshipCounts.destroyers,
            starshipCounts.cruisers,
            starshipCounts.battleships,
            0,
            pFriendly.boundingHexMidPoint,
          );

          const enemyFleet = lkpfs ? lkpfs.fleetData : Fleet.generateFleetWithShipCount(0, 0, 0, 0, 0, 0, null);
          const effectiveStrength = this.calculateEffectiveFleetStrength(
            testFleet,
            enemyFleet,
            enemyHasSpacePlatform,
            player,
          );

          // Only include planets that can contribute meaningfully (at least 20% of estimated enemy strength)
          if (effectiveStrength > estimatedEnemyStrength * 0.2) {
            totalAvailableStrength += effectiveStrength;
            contributingPlanets.push(pFriendly);
          }

          // Limit to 3 planets for coordination to avoid excessive complexity
          if (contributingPlanets.length >= 3) break;
        }

        // If we can overwhelm with 1.5x strength using multiple planets, coordinate attack
        if (contributingPlanets.length >= 2 && totalAvailableStrength > estimatedEnemyStrength * 1.5) {
          for (const pFriendly of contributingPlanets) {
            // Filter out already-committed ships
            const uncommitted = pFriendly.planetaryFleet.starships.filter(s => !committedShipIds.has(s.id));
            const shipsByType: Record<number, typeof uncommitted> = {
              [StarShipType.Scout]: uncommitted.filter(s => s.type === StarShipType.Scout),
              [StarShipType.Destroyer]: uncommitted.filter(s => s.type === StarShipType.Destroyer),
              [StarShipType.Cruiser]: uncommitted.filter(s => s.type === StarShipType.Cruiser),
              [StarShipType.Battleship]: uncommitted.filter(s => s.type === StarShipType.Battleship),
            };

            // Resolve ship IDs for SEND_SHIPS command
            const shipIds = {
              scouts: shipsByType[StarShipType.Scout].map(s => s.id),
              destroyers: shipsByType[StarShipType.Destroyer].map(s => s.id),
              cruisers: shipsByType[StarShipType.Cruiser].map(s => s.id),
              battleships: shipsByType[StarShipType.Battleship].map(s => s.id),
            };
            const fleetId = player.nextFleetId++;

            const sendCmd = this.createAICommand<SendShipsCommand>(player, {
              type: GameCommandType.SEND_SHIPS,
              fromPlanetId: pFriendly.id,
              toPlanetId: pEnemyInbound.id,
              fleetId,
              shipIds,
            });
            commands.push(sendCmd);
            for (const ids of Object.values(shipIds)) ids.forEach(id => committedShipIds.add(id));

            this.logDecision(player, clientModel.currentCycle, 'combat', 'Sent coordinated attack fleet', {
              fromPlanet: pFriendly.name,
              toPlanet: pEnemyInbound.name,
              contributingPlanets: contributingPlanets.length,
              totalStrength: totalAvailableStrength,
              enemyStrength: estimatedEnemyStrength,
              isCoordinated: true,
              shipTypes: {
                scouts: shipIds.scouts.length,
                destroyers: shipIds.destroyers.length,
                cruisers: shipIds.cruisers.length,
                battleships: shipIds.battleships.length,
              },
            });

            // Remove from candidates
            const idx = planetCandidatesForSendingShips.indexOf(pFriendly);
            if (idx >= 0) {
              planetCandidatesForSendingShips.splice(idx, 1);
            }
          }

          fleetSent = true;
        }
      }

      // Standard single-planet attack logic (if multi-planet coordination didn't happen)
      if (!fleetSent) {
        for (let j = planetCandidatesForSendingShips.length - 1; j >= 0; j--) {
          const pFriendly = planetCandidatesForSendingShips[j]; //Planet

          //send attacking fleet

          //rely only on our last known-information
          let estimatedEnemyStrength = Math.floor(Math.pow((pEnemyInbound.type ?? 0) + 1, 2) * 4); //estimate required strength based on planet type
          let enemyHasSpacePlatform = false;

          const lkpfs = player.lastKnownPlanetFleetStrength[pEnemyInbound.id];
          if (lkpfs) {
            estimatedEnemyStrength = Fleet.determineFleetStrength(lkpfs.fleetData);
            enemyHasSpacePlatform = Fleet.getStarshipsByType(lkpfs.fleetData)[StarShipType.SpacePlatform].length > 0;
          }

          const starshipCounts = Fleet.countStarshipsByType(pFriendly.planetaryFleet);

          // Adjust counts for already-committed ships
          const committedFromPlanet = pFriendly.planetaryFleet.starships.filter(s => committedShipIds.has(s.id));
          for (const s of committedFromPlanet) {
            if (s.type === StarShipType.Scout) starshipCounts.scouts--;
            else if (s.type === StarShipType.Destroyer) starshipCounts.destroyers--;
            else if (s.type === StarShipType.Cruiser) starshipCounts.cruisers--;
            else if (s.type === StarShipType.Battleship) starshipCounts.battleships--;
          }

          // Skip if no uncommitted ships
          if (starshipCounts.scouts + starshipCounts.destroyers + starshipCounts.cruisers + starshipCounts.battleships <= 0) {
            continue;
          }

          //generate this fleet just to check effective strength
          const testFleet = Fleet.generateFleetWithShipCount(
            0,
            starshipCounts.scouts,
            starshipCounts.destroyers,
            starshipCounts.cruisers,
            starshipCounts.battleships,
            0,
            pFriendly.boundingHexMidPoint,
          );

          // Use effective strength calculation for Hard/Expert
          let ourEffectiveStrength = Fleet.determineFleetStrength(testFleet);
          if (aiSettings.useEffectiveStrengthCalculation) {
            const enemyFleet = lkpfs ? lkpfs.fleetData : Fleet.generateFleetWithShipCount(0, 0, 0, 0, 0, 0, null);
            ourEffectiveStrength = this.calculateEffectiveFleetStrength(
              testFleet,
              enemyFleet,
              enemyHasSpacePlatform,
              player,
            );
          }

          // Log attack evaluation to debug why Expert doesn't attack
          const attackThreshold = estimatedEnemyStrength * additionalStrengthMultiplierNeededToAttack;
          const willAttack = ourEffectiveStrength > attackThreshold;
          this.logDecision(player, clientModel.currentCycle, 'combat', 'Attack evaluation', {
            fromPlanet: pFriendly.name,
            toPlanet: pEnemyInbound.name,
            ourStrength: ourEffectiveStrength,
            enemyStrength: estimatedEnemyStrength,
            requiredMultiplier: additionalStrengthMultiplierNeededToAttack,
            attackThreshold: attackThreshold,
            willAttack: willAttack,
            hasIntelligence: !!lkpfs,
            enemyHasSpacePlatform: enemyHasSpacePlatform,
            shipCounts: starshipCounts,
          });

          if (ourEffectiveStrength > estimatedEnemyStrength * additionalStrengthMultiplierNeededToAttack) {
            // Resolve ship IDs for SEND_SHIPS command (excluding committed ships)
            const uncommitted = pFriendly.planetaryFleet.starships.filter(s => !committedShipIds.has(s.id));
            const shipIds = {
              scouts: uncommitted.filter(s => s.type === StarShipType.Scout).slice(0, starshipCounts.scouts).map(s => s.id),
              destroyers: uncommitted.filter(s => s.type === StarShipType.Destroyer).slice(0, starshipCounts.destroyers).map(s => s.id),
              cruisers: uncommitted.filter(s => s.type === StarShipType.Cruiser).slice(0, starshipCounts.cruisers).map(s => s.id),
              battleships: uncommitted.filter(s => s.type === StarShipType.Battleship).slice(0, starshipCounts.battleships).map(s => s.id),
            };
            const fleetId = player.nextFleetId++;

            const sendCmd = this.createAICommand<SendShipsCommand>(player, {
              type: GameCommandType.SEND_SHIPS,
              fromPlanetId: pFriendly.id,
              toPlanetId: pEnemyInbound.id,
              fleetId,
              shipIds,
            });
            commands.push(sendCmd);
            for (const ids of Object.values(shipIds)) ids.forEach(id => committedShipIds.add(id));

            this.logDecision(player, clientModel.currentCycle, 'combat', 'Sent attack fleet', {
              fromPlanet: pFriendly.name,
              toPlanet: pEnemyInbound.name,
              ourStrength: ourEffectiveStrength,
              enemyStrength: estimatedEnemyStrength,
              strengthAdvantage:
                estimatedEnemyStrength > 0 ? (ourEffectiveStrength / estimatedEnemyStrength).toFixed(2) : 'Undefended',
              requiredAdvantage: additionalStrengthMultiplierNeededToAttack.toFixed(2),
              shipTypes: starshipCounts,
              enemyHasSpacePlatform,
              multiPlanetAttack: false,
            });

            // Remove from candidates since all mobile ships are now committed
            planetCandidatesForSendingShips.splice(j, 1);

            fleetSent = true;
            break;
          }
        }
      }

      if (!fleetSent && planetCandidatesForInboundReinforcements.length > 0) {
        //here is where we reinforce close planets for expert computers

        //logic:
        //  find closest planet capable of building better ships (has at least one factory) to enemy planet
        //  send a detachment from each planetCandidatesForSendingShips other than closest ship builder to reinforce and amass for later
        const planetDistanceComparer = new PlanetDistanceComparer(grid, pEnemyInbound);
        planetCandidatesForInboundReinforcements.sort((a, b) => planetDistanceComparer.sortFunction(a, b));
        const planetToReinforce =
          planetCandidatesForInboundReinforcements[planetCandidatesForInboundReinforcements.length - 1];
        const distanceFromPlanetToReinforceToEnemy = Grid.getHexDistanceForMidPoints(
          grid,
          pEnemyInbound.boundingHexMidPoint,
          planetToReinforce.boundingHexMidPoint,
        );

        for (let r = planetCandidatesForSendingShips.length - 1; r >= 0; r--) {
          const pFriendly = planetCandidatesForSendingShips[r];

          if (pFriendly.id == planetToReinforce.id)
            //don't reinforce ourselves
            break;

          //also make sure the friendly planet is further from our target than the planet to reinforce
          if (
            Grid.getHexDistanceForMidPoints(
              grid,
              pEnemyInbound.boundingHexMidPoint,
              pFriendly.boundingHexMidPoint,
            ) < distanceFromPlanetToReinforceToEnemy
          )
            break;

          const starshipCounts = Fleet.countStarshipsByType(pFriendly.planetaryFleet);

          // Adjust counts for already-committed ships
          const committedReinf = pFriendly.planetaryFleet.starships.filter(s => committedShipIds.has(s.id));
          for (const s of committedReinf) {
            if (s.type === StarShipType.Scout) starshipCounts.scouts--;
            else if (s.type === StarShipType.Destroyer) starshipCounts.destroyers--;
            else if (s.type === StarShipType.Cruiser) starshipCounts.cruisers--;
            else if (s.type === StarShipType.Battleship) starshipCounts.battleships--;
          }
          if (starshipCounts.scouts + starshipCounts.destroyers + starshipCounts.cruisers + starshipCounts.battleships <= 0) {
            continue;
          }

          //TODO: for some computer levels below we should also leave a defending detachment based on strength to defend, etc...

          // Resolve ship IDs for SEND_SHIPS command (excluding committed ships)
          const uncommitted = pFriendly.planetaryFleet.starships.filter(s => !committedShipIds.has(s.id));
          const shipIds = {
            scouts: uncommitted.filter(s => s.type === StarShipType.Scout).slice(0, starshipCounts.scouts).map(s => s.id),
            destroyers: uncommitted.filter(s => s.type === StarShipType.Destroyer).slice(0, starshipCounts.destroyers).map(s => s.id),
            cruisers: uncommitted.filter(s => s.type === StarShipType.Cruiser).slice(0, starshipCounts.cruisers).map(s => s.id),
            battleships: uncommitted.filter(s => s.type === StarShipType.Battleship).slice(0, starshipCounts.battleships).map(s => s.id),
          };
          const fleetId = player.nextFleetId++;

          const sendCmd = this.createAICommand<SendShipsCommand>(player, {
            type: GameCommandType.SEND_SHIPS,
            fromPlanetId: pFriendly.id,
            toPlanetId: planetToReinforce.id,
            fleetId,
            shipIds,
          });
          commands.push(sendCmd);
          for (const ids of Object.values(shipIds)) ids.forEach(id => committedShipIds.add(id));

          // Remove from candidates since all mobile ships are now committed
          planetCandidatesForSendingShips.splice(r, 1);

          fleetSent = true;
          break;
        }
      }

      if (planetCandidatesForSendingShips.length == 0) break;
    } //end planetCandidatesForInboundAttackingFleets loop

    return commands;
  }

  public static countPlanetsNeedingExploration(clientModel: ClientModelData, grid: Grid, player: PlayerData, ownedPlanets: PlanetById) {
    let planetsNeedingExploration = 0;
    for (const p of clientModel.clientPlanets) {
      if (!(p.id in ownedPlanets) && !Player.planetContainsFriendlyInboundFleet(player, p)) {
        //exploring/attacking inbound fleets to unowned planets should be excluded
        if (this.planetNeedsExploration(p, clientModel, grid, player, ownedPlanets)) {
          planetsNeedingExploration++;
        }
      }
    }

    return planetsNeedingExploration;
  }

  /**
   * returns true if it has been enough turns since this planet was explored
   * Uses percentile-based prioritization: always explore top N closest/most valuable planets
   * This ensures AI continues exploring even when all options are distant
   */
  public static planetNeedsExploration(
    planet: PlanetLocation,
    clientModel: ClientModelData,
    grid: Grid,
    player: PlayerData,
    ownedPlanets: PlanetById,
  ) {
    const aiSettings = this.getAISettings(player);

    // Check if AI re-scouts known planets
    if (!aiSettings.enableReScouting && player.knownPlanetIds.includes(planet.id)) {
      return false;
    }

    // For unknown planets, use top-N prioritization instead of threshold
    if (!player.knownPlanetIds.includes(planet.id)) {
      // Calculate priority for all unexplored planets
      const explorationCandidates: { planet: PlanetLocation; priority: number }[] = [];

      for (const p of clientModel.clientPlanets) {
        if (p.id in ownedPlanets) continue; // Skip owned planets
        if (player.knownPlanetIds.includes(p.id)) continue; // Skip known planets
        if (Player.planetContainsFriendlyInboundFleet(player, p)) continue; // Skip if already exploring

        const priority = this.calculateExplorationPriority(p, player, ownedPlanets, clientModel, grid);
        explorationCandidates.push({ planet: p, priority });
      }

      // If no candidates, nothing to explore
      if (explorationCandidates.length === 0) {
        return false;
      }

      // Sort by priority (highest first)
      explorationCandidates.sort((a, b) => b.priority - a.priority);

      // Determine how many planets to explore based on difficulty
      // Easy: top 20%, Normal: top 30%, Hard: top 50%, Expert: top 60%
      const topPercentage = aiSettings.scoutPriorityTopPercentage;
      const topCount = Math.max(1, Math.ceil(explorationCandidates.length * topPercentage));

      // Return true if this planet is in the top N candidates
      const topCandidates = explorationCandidates.slice(0, topCount);
      return topCandidates.some((c) => c.planet.id === planet.id);
    }

    // For known planets, use absolute threshold instead of percentile
    // This prevents feedback loop where staleness constantly pushes planets into "top N%"
    const scoutPriority = this.calculateScoutPriority(planet, clientModel, grid, player, ownedPlanets);

    // Re-scout if priority exceeds threshold
    // This ensures only truly important planets (nearby enemies, urgent intel) get re-scouted
    return scoutPriority >= aiSettings.reScoutPriorityThreshold;
  }

  /**
   * Calculate how important it is to scout this known planet
   * Higher score = more important to scout
   */
  private static calculateScoutPriority(
    planet: PlanetLocation,
    clientModel: ClientModelData,
    grid: Grid,
    player: PlayerData,
    ownedPlanets: PlanetById,
  ): number {
    let priority = 0;

    const lastKnownInfo = player.lastKnownPlanetFleetStrength[planet.id];
    if (!lastKnownInfo) return 0; // No intel, can't prioritize

    const turnsSinceLastExplored = clientModel.currentCycle - lastKnownInfo.cycleLastExplored;
    const isEnemyOwned = lastKnownInfo.lastKnownOwnerId && lastKnownInfo.lastKnownOwnerId !== player.id;

    // Distance is the most important factor
    let minDistance = Infinity;
    for (const ownedPlanet of Object.values(ownedPlanets)) {
      const distance = Grid.getHexDistanceForMidPoints(
        grid,
        planet.boundingHexMidPoint,
        ownedPlanet.boundingHexMidPoint,
      );
      if (distance < minDistance) minDistance = distance;
    }

    // Proximity scoring (0-50 points) - continuous function that scales with map size
    // Estimate typical max distance as ~1/4 of grid diagonal for strategic relevance
    const gridSize = Math.sqrt(grid.hexes.length);
    const strategicRange = gridSize * 0.75; // Most planets beyond this are too far to care about

    // Use inverse relationship: closer = exponentially higher priority
    // Formula: maxPoints * (1 - (distance / strategicRange)^2)
    // This gives smooth decay: distance 0 = 50pts, strategicRange/2 = 37.5pts, strategicRange = 0pts
    if (minDistance < strategicRange) {
      const normalizedDistance = minDistance / strategicRange;
      priority += Math.round(50 * (1 - normalizedDistance * normalizedDistance));
    }
    // Distant planets beyond strategic range get 0 proximity points

    // Enemy-owned planets are HIGH priority (+30 points)
    if (isEnemyOwned) {
      priority += 30;
    }

    // Planet type/value (0-15 points)
    const planetType = (planet as { type?: PlanetType | null }).type;
    if (planetType === PlanetType.PlanetClass2) priority += 15;
    else if (planetType === PlanetType.PlanetClass1) priority += 10;
    else if (planetType === PlanetType.DeadPlanet) priority += 5;
    else if (planetType === PlanetType.AsteroidBelt) priority += 3;

    // Staleness - dynamic threshold based on exploration workload
    // Count UNKNOWN planets needing exploration (avoids circular dependency with re-scouting logic)
    let unknownPlanetsNeedingExploration = 0;
    for (const p of clientModel.clientPlanets) {
      if (
        !(p.id in ownedPlanets) &&
        !player.knownPlanetIds.includes(p.id) &&
        !Player.planetContainsFriendlyInboundFleet(player, p)
      ) {
        unknownPlanetsNeedingExploration++;
      }
    }

    // Calculate staleness threshold: more unknown planets = higher threshold (re-scout less)
    // Enemy planets get lower thresholds (more urgent to track their movements)
    const baseStalenessThreshold = isEnemyOwned ? 10 : 15;
    const maxStalenessThreshold = isEnemyOwned ? 25 : 40;
    const thresholdScaling = isEnemyOwned ? 1 : 2; // Enemies scale slower with workload

    const stalenessThreshold = Math.min(
      maxStalenessThreshold,
      baseStalenessThreshold + unknownPlanetsNeedingExploration * thresholdScaling,
    );

    // Add significant bonus if intel is stale (0 or 25 points)
    if (turnsSinceLastExplored > stalenessThreshold) {
      priority += 25;
    }

    return priority;
  }

  /**
   * Calculate bonus priority for a planet when quadrant intelligence is active.
   * When the AI owns fewer than 4 planets (including home), nearby system planets
   * with mineral/resource value get a large priority boost to drive early expansion.
   * Returns 0 when the feature is inactive or the planet type doesn't qualify.
   */
  private static getQuadrantIntelligenceBonus(
    planet: PlanetLocation,
    player: PlayerData,
    ownedPlanets: PlanetById,
  ): number {
    const aiSettings = this.getAISettings(player);
    const ownedPlanetCount = Object.keys(ownedPlanets).length;
    const hasHomePlanet = Boolean(player.homePlanetId && player.homePlanetId in ownedPlanets);

    if (!aiSettings.quadrantIntelligence || !hasHomePlanet || ownedPlanetCount <= 0 || ownedPlanetCount >= 4) {
      return 0;
    }

    // Mineral-rich / resource planets get large bonuses to ensure early system capture:
    //   AsteroidBelt: highest ore+iridium per worker, no defenders → immediate scout target
    //   DeadPlanet: good ore+iridium, moderate defenders → 2-3 scouts needed
    //   PlanetClass1: balanced resources, more defenders → 3+ scouts needed
    //   PlanetClass2: food-rich but low minerals → no bonus (AI already starts on one)
    const planetType = (planet as { type?: PlanetType | null }).type;
    if (planetType === PlanetType.AsteroidBelt) return 40;
    if (planetType === PlanetType.DeadPlanet) return 30;
    if (planetType === PlanetType.PlanetClass1) return 20;
    return 0;
  }

  /**
   * Calculate exploration priority for a planet based on strategic value
   * Higher score = more important to explore/scout
   */
  private static calculateExplorationPriority(
    planet: PlanetLocation,
    player: PlayerData,
    ownedPlanets: PlanetById,
    _clientModel: ClientModelData,
    grid: Grid,
  ): number {
    let priority = 0;

    // Find distance to nearest owned planet
    let minDistance = Infinity;
    for (const ownedPlanet of Object.values(ownedPlanets)) {
      const distance = Grid.getHexDistanceForMidPoints(
        grid,
        planet.boundingHexMidPoint,
        ownedPlanet.boundingHexMidPoint,
      );
      if (distance < minDistance) minDistance = distance;
    }

    // Proximity is KEY - nearby planets are much more important (0-40 points)
    // Scale based on map size for flexibility
    const gridSize = Math.sqrt(grid.hexes.length);
    const explorationRange = gridSize * 0.7; // Explore planets within strategic range

    // Use inverse square decay for smooth prioritization
    // Formula: maxPoints * (1 - (distance / explorationRange)^2)
    if (minDistance < explorationRange) {
      const normalizedDistance = minDistance / explorationRange;
      priority += Math.round(40 * (1 - normalizedDistance * normalizedDistance));
    }
    // Distant planets beyond exploration range get 0 priority - don't waste scouts!

    // Planet type indicates likely resource value
    // But this is secondary to distance
    const planetType = (planet as { type?: PlanetType | null }).type;
    if (planetType === PlanetType.PlanetClass2) priority += 15;
    else if (planetType === PlanetType.PlanetClass1) priority += 10;
    else if (planetType === PlanetType.DeadPlanet) priority += 5;
    else if (planetType === PlanetType.AsteroidBelt) priority += 3;

    // Quadrant intelligence: prioritize early system expansion when under 4 planets
    priority += this.getQuadrantIntelligenceBonus(planet, player, ownedPlanets);

    return priority;
  }

  public static getClosestUnownedPlanet(
    clientModel: ClientModelData,
    grid: Grid,
    ownedPlanets: PlanetById,
    ownedPlanet: PlanetData,
  ): { minDistance: number; planet: PlanetLocation | null } {
    const returnVal: { minDistance: number; planet: PlanetLocation | null } = { minDistance: 999, planet: null };

    for (const p of clientModel.clientPlanets) {
      if (!(p.id in ownedPlanets)) {
        const distance = Grid.getHexDistanceForMidPoints(
          grid,
          p.boundingHexMidPoint,
          ownedPlanet.boundingHexMidPoint,
        );
        if (distance < returnVal.minDistance) {
          returnVal.minDistance = distance;
          returnVal.planet = p;
        }
      }
    }

    return returnVal;
  }

  /**
   * Calculate strategic value of a target planet for Expert AI
   * Considers: resources, defenses, distance, strategic location
   */
  private static calculatePlanetTargetValue(
    targetPlanet: PlanetLocation,
    player: PlayerData,
    ownedPlanets: PlanetById,
    _clientModel: ClientModelData,
    grid: Grid,
  ): number {
    let value = 0;

    // Skip if we already own this planet
    const isPlayerOwned = player.ownedPlanetIds.includes(targetPlanet.id);
    if (isPlayerOwned) return 0;

    // Check if we have intelligence on this planet
    const lastKnownInfo = player.lastKnownPlanetFleetStrength[targetPlanet.id];
    if (!lastKnownInfo) return 0;

    // Resource value (planet type is a proxy for resources)
    const targetType = (targetPlanet as { type?: PlanetType | null }).type;
    if (targetType === PlanetType.PlanetClass2) value += 30;
    else if (targetType === PlanetType.PlanetClass1) value += 20;
    else if (targetType === PlanetType.DeadPlanet) value += 10;
    else if (targetType === PlanetType.AsteroidBelt) value += 5;

    // Weak defenses make it more valuable
    const defenseStrength = Fleet.determineFleetStrength(lastKnownInfo.fleetData);
    if (defenseStrength < 10) value += 25;
    else if (defenseStrength < 30) value += 15;
    else if (defenseStrength < 50) value += 5;

    // Proximity to our territory increases value (easier to attack and hold)
    let minDistanceToOwned = Infinity;
    for (const ownedPlanet of Object.values(ownedPlanets)) {
      const distance = Grid.getHexDistanceForMidPoints(
        grid,
        targetPlanet.boundingHexMidPoint,
        ownedPlanet.boundingHexMidPoint,
      );
      if (distance < minDistanceToOwned) minDistanceToOwned = distance;
    }
    // Closer planets are more valuable (inverse relationship)
    if (minDistanceToOwned < 5) value += 20;
    else if (minDistanceToOwned < 10) value += 10;
    else if (minDistanceToOwned < 15) value += 5;

    // Strategic location: planets near center of map are more valuable
    const gridCenter = {
      x: grid.hexes[Math.floor(grid.hexes.length / 2)].midPoint.x,
      y: grid.hexes[Math.floor(grid.hexes.length / 2)].midPoint.y,
    };
    const distanceFromCenter = Math.sqrt(
      Math.pow(targetPlanet.boundingHexMidPoint.x - gridCenter.x, 2) +
        Math.pow(targetPlanet.boundingHexMidPoint.y - gridCenter.y, 2),
    );
    if (distanceFromCenter < 100) value += 10;
    else if (distanceFromCenter < 200) value += 5;

    // Quadrant intelligence: boost nearby mineral/resource planets during early expansion
    value += this.getQuadrantIntelligenceBonus(targetPlanet, player, ownedPlanets);

    return value;
  }

  /**
   * Manages research allocation and priorities based on game state and difficulty
   */
  public static computerManageResearch(
    clientModel: ClientModelData,
    _grid: Grid,
    player: PlayerData,
    ownedPlanets: PlanetById,
    ownedPlanetsSorted: PlanetData[],
  ): GameCommand[] {
    const commands: GameCommand[] = [];

    // Set research percentage based on difficulty
    const aiSettings = this.getAISettings(player);
    const targetResearchPercent =
      Utils.nextRandom(
        Math.floor(aiSettings.researchPercentMin * 100),
        Math.floor(aiSettings.researchPercentMax * 100) + 1,
      ) / 100;

    // Calculate total energy needed for pending build goals
    let totalEnergyNeededForBuilds = 0;
    for (const ppi of Object.values(player.planetBuildGoals)) {
      totalEnergyNeededForBuilds += ppi.energyCost;
    }

    // Get current total resources
    const totalResources = Player.getTotalResourceAmount(player, ownedPlanets);

    // If we don't have enough energy for builds, reduce research temporarily
    // Keep at least 20% of target or 10% absolute minimum
    let adjustedResearchPercent = targetResearchPercent;
    if (totalResources.energy < totalEnergyNeededForBuilds * 1.5) {
      // We're low on energy - scale back research to prioritize building
      const energyShortfall = totalEnergyNeededForBuilds * 1.5 - totalResources.energy;
      const reductionFactor = Math.max(0.2, 1 - energyShortfall / (totalEnergyNeededForBuilds * 2));
      adjustedResearchPercent = Math.max(0.1, targetResearchPercent * reductionFactor);

      this.debugLog(
        player.name,
        'Reducing research from',
        targetResearchPercent,
        'to',
        adjustedResearchPercent,
        'due to energy needs:',
        totalEnergyNeededForBuilds,
        'current:',
        totalResources.energy,
      );
    }

    // Emit ADJUST_RESEARCH_PERCENT command
    const adjustResearchCmd = this.createAICommand<AdjustResearchPercentCommand>(player, {
      type: GameCommandType.ADJUST_RESEARCH_PERCENT,
      researchPercent: adjustedResearchPercent,
    });
    commands.push(adjustResearchCmd);

    this.logDecision(player, clientModel.currentCycle, 'research', 'Set research percentage', {
      targetPercent: targetResearchPercent,
      adjustedPercent: adjustedResearchPercent,
      wasAdjusted: adjustedResearchPercent !== targetResearchPercent,
      energyNeeded: totalEnergyNeededForBuilds,
      currentEnergy: totalResources.energy,
      buildGoalsCount: Object.keys(player.planetBuildGoals).length,
    });

    // If no research queued, determine priority based on game state
    if (!player.research.researchTypeInQueue) {
      const researchPriorities: ResearchType[] = [];

      // Early game: building efficiency
      if (ownedPlanetsSorted.length <= 2) {
        if (!aiSettings.prioritizeCombatResearch) {
          researchPriorities.push(ResearchType.BUILDING_EFFICIENCY_IMPROVEMENT_MINES);
          researchPriorities.push(ResearchType.BUILDING_EFFICIENCY_IMPROVEMENT_FACTORIES);
        } else {
          researchPriorities.push(ResearchType.BUILDING_EFFICIENCY_IMPROVEMENT_FACTORIES);
          researchPriorities.push(ResearchType.BUILDING_EFFICIENCY_IMPROVEMENT_MINES);
          if (aiSettings.prioritizeFarmsEarly) {
            researchPriorities.push(ResearchType.BUILDING_EFFICIENCY_IMPROVEMENT_FARMS);
          }
        }
      }
      // Mid game: space platforms and combat
      else if (ownedPlanetsSorted.length <= 4) {
        if (aiSettings.prioritizeCombatResearch) {
          researchPriorities.push(ResearchType.COMBAT_IMPROVEMENT_ATTACK);
          researchPriorities.push(ResearchType.SPACE_PLATFORM_IMPROVEMENT);
          researchPriorities.push(ResearchType.PROPULSION_IMPROVEMENT);
        } else {
          researchPriorities.push(ResearchType.SPACE_PLATFORM_IMPROVEMENT);
          researchPriorities.push(ResearchType.BUILDING_EFFICIENCY_IMPROVEMENT_FACTORIES);
        }
      }
      // Late game: combat and propulsion
      else {
        if (aiSettings.prioritizeCombatResearch) {
          researchPriorities.push(ResearchType.COMBAT_IMPROVEMENT_ATTACK);
          researchPriorities.push(ResearchType.COMBAT_IMPROVEMENT_DEFENSE);
          researchPriorities.push(ResearchType.PROPULSION_IMPROVEMENT);
        } else {
          researchPriorities.push(ResearchType.PROPULSION_IMPROVEMENT);
          researchPriorities.push(ResearchType.COMBAT_IMPROVEMENT_ATTACK);
        }
      }

      // Find first research that can still be researched
      for (const researchType of researchPriorities) {
        const researchProgress = player.research.researchProgressByType[researchType];
        if (Research.canResearch(researchProgress)) {
          // Emit SUBMIT_RESEARCH_ITEM command
          const submitResearchCmd = this.createAICommand<SubmitResearchItemCommand>(player, {
            type: GameCommandType.SUBMIT_RESEARCH_ITEM,
            researchType,
          });
          commands.push(submitResearchCmd);

          this.debugLog(player.name, 'Queuing research:', researchType);
          this.logDecision(player, clientModel.currentCycle, 'research', 'Queued research type', {
            researchType,
            gamePhase: ownedPlanetsSorted.length <= 2 ? 'early' : ownedPlanetsSorted.length <= 4 ? 'mid' : 'late',
            planetCount: ownedPlanetsSorted.length,
          });
          break;
        }
      }
    }

    return commands;
  }

  /**
   * Calculates effective fleet strength considering ship type advantages/disadvantages and space platforms
   */
  public static calculateEffectiveFleetStrength(
    ourFleet: FleetData,
    enemyFleet: FleetData,
    enemyHasSpacePlatform: boolean,
    ourPlayer: PlayerData,
  ): number {
    let effectiveStrength = 0;
    const ourShipsByType = Fleet.getStarshipsByType(ourFleet);
    const enemyShipsByType = Fleet.getStarshipsByType(enemyFleet);

    // Space platforms have 2x effective strength since they have advantage over all ships
    if (enemyHasSpacePlatform) {
      const spacePlatformStrength = Fleet.determineFleetStrength({
        starships: enemyShipsByType[StarShipType.SpacePlatform],
      } as FleetData);
      // Need 2x strength to overcome space platform advantage
      effectiveStrength -= spacePlatformStrength * 2;
    }

    // Calculate effective strength for each of our ship types against enemy composition
    for (const ourShipType of [
      StarShipType.Scout,
      StarShipType.Destroyer,
      StarShipType.Cruiser,
      StarShipType.Battleship,
      StarShipType.SystemDefense,
    ]) {
      const ourShips = ourShipsByType[ourShipType];
      if (ourShips.length === 0) continue;

      const baseStrength = Fleet.determineFleetStrength({ starships: ourShips } as FleetData);
      let strengthMultiplier = 1.0;

      // Check advantages/disadvantages against enemy composition
      for (const enemyShipType of [
        StarShipType.Scout,
        StarShipType.Destroyer,
        StarShipType.Cruiser,
        StarShipType.Battleship,
        StarShipType.SystemDefense,
      ]) {
        const enemyShips = enemyShipsByType[enemyShipType];
        if (enemyShips.length === 0) continue;

        const sampleOurShip = ourShips[0];
        const sampleEnemyShip = enemyShips[0];

        // Use existing advantage checking from BattleSimulator
        if (BattleSimulator.starshipHasAdvantage(sampleOurShip, sampleEnemyShip)) {
          strengthMultiplier += 0.25; // Advantage gives ~50% more damage, so +25% effective strength
        } else if (BattleSimulator.starshipHasDisadvantage(sampleOurShip, sampleEnemyShip)) {
          strengthMultiplier -= 0.25; // Disadvantage
        }
      }

      effectiveStrength += baseStrength * strengthMultiplier;
    }

    // Factor in research bonuses (small adjustment)
    const attackBonus =
      ourPlayer.research.researchProgressByType[ResearchType.COMBAT_IMPROVEMENT_ATTACK].data.chance || 0;
    const defenseBonus =
      ourPlayer.research.researchProgressByType[ResearchType.COMBAT_IMPROVEMENT_DEFENSE].data.chance || 0;
    const researchMultiplier = 1.0 + (attackBonus + defenseBonus) / 2;

    effectiveStrength *= researchMultiplier;

    return Math.max(0, effectiveStrength);
  }

  /**
   * Retreat damaged ships on planets that lack the improvements needed to repair them.
   * Only applies to planetary fleets (not fleets in transit).
   *
   * Repair requirements (from Fleet.repairPlanetaryFleet & Player.repairPlanetaryFleets):
   *  - All repairs require a Colony and Normal happiness
   *  - Scouts / SystemDefense: no additional improvements needed
   *  - Destroyers / SpacePlatforms: planet needs a Factory
   *  - Cruisers / Battleships: planet needs a Factory AND a SpacePlatform
   *
   * Returns the generated commands and the set of ship IDs committed to retreat
   * so that computerSendShips can exclude them from attack / exploration decisions.
   */
  public static computerManageFleetRepairs(
    _clientModel: ClientModelData,
    grid: Grid,
    player: PlayerData,
    _ownedPlanets: PlanetById,
    ownedPlanetsSorted: PlanetData[],
  ): { commands: GameCommand[]; repairShipIds: Set<string> } {
    const commands: GameCommand[] = [];
    const repairShipIds = new Set<string>();
    const aiSettings = this.getAISettings(player);

    if (!aiSettings.enableFleetRepairs) {
      return { commands, repairShipIds };
    }

    // Filter to planets eligible for any repairs (requires colony + normal happiness),
    // matching the guard in Player.repairPlanetaryFleets
    const eligiblePlanets = ownedPlanetsSorted.filter(
      (p) =>
        p.planetHappiness === PlanetHappinessType.Normal &&
        (p.builtImprovements[PlanetImprovementType.Colony] ?? 0) > 0,
    );

    // Build a lookup of planets that can repair each class of ship
    // Scouts: any eligible planet (no Factory needed)
    // Destroyers: eligible planet with a Factory
    // Cruisers/Battleships: eligible planet with a Factory AND a SpacePlatform
    const repairPlanetsForScout: PlanetData[] = [...eligiblePlanets];
    const repairPlanetsForDestroyer: PlanetData[] = [];
    const repairPlanetsForCapitalShip: PlanetData[] = []; // cruiser / battleship
    for (const planet of eligiblePlanets) {
      const hasFactory = (planet.builtImprovements[PlanetImprovementType.Factory] ?? 0) > 0;
      if (hasFactory) {
        repairPlanetsForDestroyer.push(planet);
        const hasSpacePlatform = Planet.getSpacePlatformCount(planet, false) > 0;
        if (hasSpacePlatform) {
          repairPlanetsForCapitalShip.push(planet);
        }
      }
    }

    for (const planet of ownedPlanetsSorted) {
      const isEligible = eligiblePlanets.includes(planet);
      const hasFactory = isEligible && (planet.builtImprovements[PlanetImprovementType.Factory] ?? 0) > 0;
      const hasSpacePlatform = hasFactory && Planet.getSpacePlatformCount(planet, false) > 0;

      // Determine which ship types this planet CANNOT repair
      const canRepairScout = isEligible;
      const canRepairDestroyer = hasFactory;
      const canRepairCapitalShip = hasSpacePlatform;

      // Collect damaged ships that need to retreat for repairs
      const shipsToRetreat: { id: string; type: StarShipType; repairCandidates: PlanetData[] }[] = [];

      for (const ship of planet.planetaryFleet.starships) {
        // Only consider damaged ships
        const maxHealth = Fleet.maxStrength(ship);
        if (ship.health >= maxHealth) continue;

        // Skip immobile ship types
        if (ship.type === StarShipType.SystemDefense || ship.type === StarShipType.SpacePlatform) {
          continue;
        }

        if (ship.type === StarShipType.Scout) {
          if (!canRepairScout) {
            shipsToRetreat.push({ id: ship.id, type: ship.type, repairCandidates: repairPlanetsForScout });
          }
        } else if (ship.type === StarShipType.Destroyer) {
          if (!canRepairDestroyer) {
            shipsToRetreat.push({ id: ship.id, type: ship.type, repairCandidates: repairPlanetsForDestroyer });
          }
        } else if (ship.type === StarShipType.Cruiser || ship.type === StarShipType.Battleship) {
          if (!canRepairCapitalShip) {
            shipsToRetreat.push({ id: ship.id, type: ship.type, repairCandidates: repairPlanetsForCapitalShip });
          }
        }
      }

      if (shipsToRetreat.length === 0) continue;

      // Group retreating ships by their nearest repair planet
      const shipsByDestination = new Map<number, { planet: PlanetData; shipIds: typeof shipsToRetreat }>();
      for (const ship of shipsToRetreat) {
        // Find the nearest planet from this ship's valid repair candidates (excluding current planet)
        let nearest: PlanetData | null = null;
        let minDist = Infinity;
        for (const rp of ship.repairCandidates) {
          if (rp.id === planet.id) continue;
          const dist = Grid.getHexDistanceForMidPoints(grid, planet.boundingHexMidPoint, rp.boundingHexMidPoint);
          if (dist < minDist) {
            minDist = dist;
            nearest = rp;
          }
        }
        if (!nearest) continue;

        let group = shipsByDestination.get(nearest.id);
        if (!group) {
          group = { planet: nearest, shipIds: [] };
          shipsByDestination.set(nearest.id, group);
        }
        group.shipIds.push(ship);
      }

      // Emit a SEND_SHIPS command per destination planet
      for (const [, { planet: destPlanet, shipIds: ships }] of shipsByDestination) {
        const shipIds = {
          scouts: ships.filter(s => s.type === StarShipType.Scout).map(s => s.id),
          destroyers: ships.filter(s => s.type === StarShipType.Destroyer).map(s => s.id),
          cruisers: ships.filter(s => s.type === StarShipType.Cruiser).map(s => s.id),
          battleships: ships.filter(s => s.type === StarShipType.Battleship).map(s => s.id),
        };
        const fleetId = player.nextFleetId++;

        const sendCmd = this.createAICommand<SendShipsCommand>(player, {
          type: GameCommandType.SEND_SHIPS,
          fromPlanetId: planet.id,
          toPlanetId: destPlanet.id,
          fleetId,
          shipIds,
        });
        commands.push(sendCmd);
        for (const s of ships) repairShipIds.add(s.id);

        this.logDecision(player, _clientModel.currentCycle, 'combat', 'Retreating damaged ships for repair', {
          fromPlanet: planet.name,
          toPlanet: destPlanet.name,
          shipCount: ships.length,
          shipTypes: {
            destroyers: shipIds.destroyers.length,
            cruisers: shipIds.cruisers.length,
            battleships: shipIds.battleships.length,
          },
        });
      }
    }

    return { commands, repairShipIds };
  }

}
