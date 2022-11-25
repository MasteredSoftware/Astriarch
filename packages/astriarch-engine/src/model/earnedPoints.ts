export enum EarnedPointsType {
    POPULATION_GROWTH=0,
    PRODUCTION_UNIT_BUILT=1,
    REPAIRED_STARSHIP_STRENGTH=2,
    DAMAGED_STARSHIP_STRENGTH=3,
    CITIZEN_ON_CAPTURED_PLANET=4
  };

export interface EarnedPointsTypeData {
    pointsPer: number;
    maxPoints: number;
}

export const earnedPointTypes = {} as {[T in EarnedPointsType]: EarnedPointsTypeData};
earnedPointTypes[EarnedPointsType.POPULATION_GROWTH] = { pointsPer: 4, maxPoints: 100000 };
earnedPointTypes[EarnedPointsType.PRODUCTION_UNIT_BUILT] = { pointsPer: 0.25, maxPoints: 500 };
earnedPointTypes[EarnedPointsType.REPAIRED_STARSHIP_STRENGTH] = { pointsPer: 2, maxPoints: 4000 };
earnedPointTypes[EarnedPointsType.DAMAGED_STARSHIP_STRENGTH] = { pointsPer: 0.5, maxPoints: 1000 };
earnedPointTypes[EarnedPointsType.CITIZEN_ON_CAPTURED_PLANET] = { pointsPer: 10, maxPoints: 10000 };
