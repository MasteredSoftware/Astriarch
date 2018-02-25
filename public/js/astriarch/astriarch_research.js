var Astriarch = Astriarch || require('./astriarch_base');

Astriarch.Research = function() {
    this.researchProgressByType = {};
    this.researchProgressByType[Astriarch.Research.ResearchType.NEW_SHIP_TYPE_DEFENDER] = new Astriarch.Research.ResearchTypeProgress(Astriarch.Research.ResearchType.NEW_SHIP_TYPE_DEFENDER, 0);
    this.researchProgressByType[Astriarch.Research.ResearchType.NEW_SHIP_TYPE_SCOUT] = new Astriarch.Research.ResearchTypeProgress(Astriarch.Research.ResearchType.NEW_SHIP_TYPE_SCOUT, 0);
    this.researchProgressByType[Astriarch.Research.ResearchType.NEW_SHIP_TYPE_DESTROYER] = new Astriarch.Research.ResearchTypeProgress(Astriarch.Research.ResearchType.NEW_SHIP_TYPE_DESTROYER, 0);
    this.researchProgressByType[Astriarch.Research.ResearchType.NEW_SHIP_TYPE_CRUISER] = new Astriarch.Research.ResearchTypeProgress(Astriarch.Research.ResearchType.NEW_SHIP_TYPE_CRUISER, 0);
    this.researchProgressByType[Astriarch.Research.ResearchType.NEW_SHIP_TYPE_BATTLESHIP] = new Astriarch.Research.ResearchTypeProgress(Astriarch.Research.ResearchType.NEW_SHIP_TYPE_BATTLESHIP, 0);
    this.researchProgressByType[Astriarch.Research.ResearchType.COMBAT_IMPROVEMENT_ATTACK] = new Astriarch.Research.ResearchTypeProgress(Astriarch.Research.ResearchType.COMBAT_IMPROVEMENT_ATTACK, 0, {chance:0});
    this.researchProgressByType[Astriarch.Research.ResearchType.COMBAT_IMPROVEMENT_DEFENSE] = new Astriarch.Research.ResearchTypeProgress(Astriarch.Research.ResearchType.COMBAT_IMPROVEMENT_DEFENSE, 0, {chance:0});
    this.researchProgressByType[Astriarch.Research.ResearchType.PROPULSION_IMPROVEMENT] = new Astriarch.Research.ResearchTypeProgress(Astriarch.Research.ResearchType.PROPULSION_IMPROVEMENT, 0, {percent:1.0});
    this.researchProgressByType[Astriarch.Research.ResearchType.BUILDING_EFFICIENCY_IMPROVEMENT_FARMS] = new Astriarch.Research.ResearchTypeProgress(Astriarch.Research.ResearchType.BUILDING_EFFICIENCY_IMPROVEMENT_FARMS, 0, {percent:1.0});
    this.researchProgressByType[Astriarch.Research.ResearchType.BUILDING_EFFICIENCY_IMPROVEMENT_MINES] = new Astriarch.Research.ResearchTypeProgress(Astriarch.Research.ResearchType.BUILDING_EFFICIENCY_IMPROVEMENT_MINES, 0, {percent:1.0});
    this.researchProgressByType[Astriarch.Research.ResearchType.BUILDING_EFFICIENCY_IMPROVEMENT_COLONIES] = new Astriarch.Research.ResearchTypeProgress(Astriarch.Research.ResearchType.BUILDING_EFFICIENCY_IMPROVEMENT_COLONIES, 0, {percent:1.0});
    this.researchProgressByType[Astriarch.Research.ResearchType.BUILDING_EFFICIENCY_IMPROVEMENT_FACTORIES] = new Astriarch.Research.ResearchTypeProgress(Astriarch.Research.ResearchType.BUILDING_EFFICIENCY_IMPROVEMENT_FACTORIES, 0, {percent:1.0});
    this.researchProgressByType[Astriarch.Research.ResearchType.SPACE_PLATFORM_IMPROVEMENT] = new Astriarch.Research.ResearchTypeProgress(Astriarch.Research.ResearchType.SPACE_PLATFORM_IMPROVEMENT, 0, {max:1});

    this.researchTypeInQueue = null;//for now a player can only research one new item at a time
    this.researchPercent = 0; // 0 - 1, the rest goes to gold/taxes
};

Astriarch.Research.prototype.getMaxSpacePlatformCount = function() {
    return this.researchProgressByType[Astriarch.Research.ResearchType.SPACE_PLATFORM_IMPROVEMENT].data.max;
};

Astriarch.Research.prototype.getResearchProgressListSorted = function() {
    var sortedList = [];
    for(var t in this.researchProgressByType) {
        sortedList.push(this.researchProgressByType[t]);
    }

    sortedList.sort(function(rptA, rptB) {
        return rptA.currentResearchLevel - rptB.currentResearchLevel;
    });
    return sortedList;
};

Astriarch.Research.prototype.getResearchData = function(type) {
    return this.researchProgressByType[type].data;
};

Astriarch.Research.prototype.getResearchDataByStarShipHullType = function(hullType) {
    var researchData = null;
    switch(hullType) {
        case Astriarch.Fleet.StarShipType.SystemDefense:
            researchData = this.getResearchData(Astriarch.Research.ResearchType.NEW_SHIP_TYPE_DEFENDER);
            break;
        case Astriarch.Fleet.StarShipType.Scout:
            researchData = this.getResearchData(Astriarch.Research.ResearchType.NEW_SHIP_TYPE_SCOUT);
            break;
        case Astriarch.Fleet.StarShipType.Destroyer:
            researchData = this.getResearchData(Astriarch.Research.ResearchType.NEW_SHIP_TYPE_DESTROYER);
            break;
        case Astriarch.Fleet.StarShipType.Cruiser:
            researchData = this.getResearchData(Astriarch.Research.ResearchType.NEW_SHIP_TYPE_CRUISER);
            break;
        case Astriarch.Fleet.StarShipType.Battleship:
            researchData = this.getResearchData(Astriarch.Research.ResearchType.NEW_SHIP_TYPE_BATTLESHIP);
            break;
    }
    return researchData;
};

Astriarch.Research.prototype.setResearchTypeProgressInQueue = function(type, data) {
    this.researchTypeInQueue = type;
    if(data) {
        this.researchProgressByType[type].setData(data);
    }
};

Astriarch.Research.prototype.estimateTurnsRemainingInQueue = function(goldAmountAtMaxPercent) {
    var researchAmountEarned = this.getGoldAndResearchAmountEarned(goldAmountAtMaxPercent).researchAmountEarned;
    return this.researchTypeInQueue ? Math.ceil(this.researchProgressByType[this.researchTypeInQueue].GetResearchLevelData().researchCostToNextLevel / researchAmountEarned) : 999;
};

Astriarch.Research.prototype.getGoldAndResearchAmountEarned = function(goldAmountAtMaxPercent) {
    var returnObj = {goldAmountEarned: 0, researchAmountEarned: goldAmountAtMaxPercent * this.researchPercent};
    returnObj.goldAmountEarned =  goldAmountAtMaxPercent - returnObj.researchAmountEarned;
    return returnObj;
};

/**
 * Returns the amount of gold produced after research and a list of endOfTurnMessages
 * @param goldAmountAtMaxPercent
 */
Astriarch.Research.prototype.nextTurn = function(goldAmountAtMaxPercent) {
    var returnObj = this.getGoldAndResearchAmountEarned(goldAmountAtMaxPercent);
    returnObj.endOfTurnMessages = [];
    if(this.researchTypeInQueue) {
        //add a bit more research completed based on a random factor
        returnObj.researchAmountEarned += Astriarch.NextRandom(0, returnObj.researchAmountEarned * .1);

        var rtpInQueue = this.researchProgressByType[this.researchTypeInQueue];
        var levelIncrease = rtpInQueue.setResearchPointsCompleted(rtpInQueue.researchPointsCompleted + returnObj.researchAmountEarned);
        if(levelIncrease) {
            //we've gained a level

            returnObj.endOfTurnMessages.push(new Astriarch.TurnEventMessage(Astriarch.TurnEventMessage.TurnEventMessageType.ResearchComplete, null, "Our Scientists and Engineers have finished researching and developing: " + rtpInQueue.ToString()));

            if(!rtpInQueue.canResearch()) {
                this.researchTypeInQueue = null;
            }
        }
    } else {
        returnObj.goldAmountEarned = goldAmountAtMaxPercent;
        returnObj.researchAmountEarned = 0;
        if(this.researchPercent) {
            returnObj.endOfTurnMessages.push(new Astriarch.TurnEventMessage(Astriarch.TurnEventMessage.TurnEventMessageType.ResearchQueueEmpty, null, "Our Scientists and Engineers are idle, R&D points were used for tax collection instead."));
        }
    }
    return returnObj;
};

Astriarch.Research.GetTotalResearchLevelCosts = function(baseValue) {
    var totalResearchLevelCosts = [];
    var researchLevelCosts = Astriarch.Research.GetResearchLevelCosts(baseValue);
    var accum = 0;
    for(var i = 0; i < 10; i++) {
        accum += researchLevelCosts[i];
        totalResearchLevelCosts.push(accum);
    }
    return totalResearchLevelCosts;
};

Astriarch.Research.GetResearchLevelCosts = function(baseValue) {
    baseValue = baseValue || 1;
    var curr = baseValue;
    var prev = 0;
    var levelCosts = [];
    for(var i = 0; i < 10; i++) {
        var temp = curr;
        curr += prev;
        levelCosts.push(curr);
        prev = temp;
    }
    return levelCosts;
};

Astriarch.Research.ResearchTypeProgress = function(type, researchPointsCompleted, data) {
    this.type = type;

    this.currentResearchLevel = -1;//
    this.researchPointsBase = 0;//based on the type and data, some types are intrinsically more expensive
    this.isCustomShip = false;
    this.maxResearchLevel = 9;
    switch(this.type) {
        case Astriarch.Research.ResearchType.NEW_SHIP_TYPE_DEFENDER:
            this.isCustomShip = true;
            this.researchPointsBase = 10;
            break;
        case Astriarch.Research.ResearchType.NEW_SHIP_TYPE_SCOUT:
            this.isCustomShip = true;
            this.researchPointsBase = 20;
            break;
        case Astriarch.Research.ResearchType.NEW_SHIP_TYPE_DESTROYER:
            this.isCustomShip = true;
            this.researchPointsBase = 30;
            break;
        case Astriarch.Research.ResearchType.NEW_SHIP_TYPE_CRUISER:
            this.isCustomShip = true;
            this.researchPointsBase = 50;
            break;
        case Astriarch.Research.ResearchType.NEW_SHIP_TYPE_BATTLESHIP:
            this.isCustomShip = true;
            this.researchPointsBase = 80;
            break;
        case Astriarch.Research.ResearchType.COMBAT_IMPROVEMENT_ATTACK:
            this.researchPointsBase = 4;
            break;
        case Astriarch.Research.ResearchType.COMBAT_IMPROVEMENT_DEFENSE:
            this.researchPointsBase = 3;
            break;
        case Astriarch.Research.ResearchType.PROPULSION_IMPROVEMENT:
            this.researchPointsBase = 8;
            break;
        case Astriarch.Research.ResearchType.BUILDING_EFFICIENCY_IMPROVEMENT_FARMS:
            this.researchPointsBase = 2;
            break;
        case Astriarch.Research.ResearchType.BUILDING_EFFICIENCY_IMPROVEMENT_MINES:
            this.researchPointsBase = 1;
            break;
        case Astriarch.Research.ResearchType.BUILDING_EFFICIENCY_IMPROVEMENT_COLONIES:
            this.researchPointsBase = 2;
            break;
        case Astriarch.Research.ResearchType.BUILDING_EFFICIENCY_IMPROVEMENT_FACTORIES:
            this.researchPointsBase = 5;
            break;
        case Astriarch.Research.ResearchType.SPACE_PLATFORM_IMPROVEMENT:
            this.researchPointsBase = 10;
            break;
    }

    this.setData(data);
    this.researchPointsCompleted = 0;
    this.setResearchPointsCompleted(researchPointsCompleted);
};

Astriarch.Research.ResearchTypeProgress.prototype.setData = function(data) {
    this.data = data || {};//structure depends on type

    if(this.isCustomShip) {
        this.maxResearchLevel = 0;
        var extraResearchAdvantage = 0;
        var extraResearchDisadvantage = 0;
        switch(this.data.advantageAgainst){
            case Astriarch.Fleet.StarShipType.SystemDefense:
                extraResearchAdvantage = this.researchPointsBase * 0.1;
                break;
            case Astriarch.Fleet.StarShipType.Scout:
                extraResearchAdvantage = this.researchPointsBase * 0.2;
                break;
            case Astriarch.Fleet.StarShipType.Destroyer:
                extraResearchAdvantage = this.researchPointsBase * 0.3;
                break;
            case Astriarch.Fleet.StarShipType.Cruiser:
                extraResearchAdvantage = this.researchPointsBase * 0.5;
                break;
            case Astriarch.Fleet.StarShipType.Battleship:
                extraResearchAdvantage = this.researchPointsBase * 0.8;
                break;
        }
        switch(this.data.disadvantageAgainst){
            case Astriarch.Fleet.StarShipType.SystemDefense:
                extraResearchDisadvantage = this.researchPointsBase * 0.8;
                break;
            case Astriarch.Fleet.StarShipType.Scout:
                extraResearchDisadvantage = this.researchPointsBase * 0.5;
                break;
            case Astriarch.Fleet.StarShipType.Destroyer:
                extraResearchDisadvantage = this.researchPointsBase * 0.3;
                break;
            case Astriarch.Fleet.StarShipType.Cruiser:
                extraResearchDisadvantage = this.researchPointsBase * 0.2;
                break;
            case Astriarch.Fleet.StarShipType.Battleship:
                extraResearchDisadvantage = this.researchPointsBase * 0.1;
                break;
        }
        this.researchPointsBase += extraResearchAdvantage + extraResearchDisadvantage;
    }

    this.researchLevelCosts = Astriarch.Research.GetTotalResearchLevelCosts(this.researchPointsBase);
};

Astriarch.Research.ResearchTypeProgress.prototype.canResearch = function() {
    return this.currentResearchLevel < this.maxResearchLevel;
};

Astriarch.Research.ResearchTypeProgress.prototype.setResearchPointsCompleted = function(researchPointsCompleted) {
    var originalLevel = this.currentResearchLevel;
    this.researchPointsCompleted = researchPointsCompleted;
    //set current level based on completed points
    for(var i = 0; i < this.researchLevelCosts.length; i++) {
        var researchCost = this.researchLevelCosts[i];
        if(this.researchPointsCompleted >= researchCost) {
            this.currentResearchLevel = i;
        } else {
            break;
        }
    }
    this.setDataBasedOnLevel();
    return this.currentResearchLevel - originalLevel;//returns level increase
};

Astriarch.Research.ResearchTypeProgress.prototype.setDataBasedOnLevel = function() {
    switch(this.type) {
        case Astriarch.Research.ResearchType.COMBAT_IMPROVEMENT_ATTACK:
        case Astriarch.Research.ResearchType.COMBAT_IMPROVEMENT_DEFENSE:
            this.data.chance = (this.currentResearchLevel + 1) / 10;
            break;
        case Astriarch.Research.ResearchType.PROPULSION_IMPROVEMENT:
            this.data.percent = 1.0 + (this.currentResearchLevel + 1) * 0.5;
            break;
        case Astriarch.Research.ResearchType.BUILDING_EFFICIENCY_IMPROVEMENT_FARMS:
        case Astriarch.Research.ResearchType.BUILDING_EFFICIENCY_IMPROVEMENT_MINES:
        case Astriarch.Research.ResearchType.BUILDING_EFFICIENCY_IMPROVEMENT_COLONIES:
        case Astriarch.Research.ResearchType.BUILDING_EFFICIENCY_IMPROVEMENT_FACTORIES:
            this.data.percent = 1.0 + (this.currentResearchLevel + 1) / 10;
            break;
        case Astriarch.Research.ResearchType.SPACE_PLATFORM_IMPROVEMENT:
            this.data.max = Math.max(Math.floor((this.currentResearchLevel + 1) / 2), 1);
            break;
    }
};

Astriarch.Research.ResearchTypeProgress.prototype.GetResearchLevelData = function() {
    var researchCostData = {currentResearchLevel: this.currentResearchLevel + 1,researchCostToNextLevel: 0, percentComplete:0};
    var totalCostAtCurrentLevel = (researchCostData.currentResearchLevel === 0 ? 0 : this.researchLevelCosts[researchCostData.currentResearchLevel - 1]);
    var totalCostToNextLevel = this.researchLevelCosts[researchCostData.currentResearchLevel];
    researchCostData.researchCostToNextLevel = totalCostToNextLevel - this.researchPointsCompleted;
    researchCostData.percentComplete = (this.researchPointsCompleted - totalCostAtCurrentLevel) / (totalCostToNextLevel - totalCostAtCurrentLevel);
    return researchCostData;
};

Astriarch.Research.ResearchTypeProgress.prototype.GetCurrentLevelDataString = function() {
    var returnString = this.ToString() + ", \n";
    switch(this.type) {
        case Astriarch.Research.ResearchType.NEW_SHIP_TYPE_DEFENDER:
        case Astriarch.Research.ResearchType.NEW_SHIP_TYPE_SCOUT:
        case Astriarch.Research.ResearchType.NEW_SHIP_TYPE_DESTROYER:
        case Astriarch.Research.ResearchType.NEW_SHIP_TYPE_CRUISER:
        case Astriarch.Research.ResearchType.NEW_SHIP_TYPE_BATTLESHIP:
            returnString += "Advantage over: " + Astriarch.GameTools.StarShipTypeToFriendlyName(this.data.advantageAgainst) + ", Disadvantage over: " + Astriarch.GameTools.StarShipTypeToFriendlyName(this.data.disadvantageAgainst);
            break;
        case Astriarch.Research.ResearchType.COMBAT_IMPROVEMENT_ATTACK:
            returnString += (this.data.chance * 100) + "% Chance to inflict 50% more damage.";
            break;
        case Astriarch.Research.ResearchType.COMBAT_IMPROVEMENT_DEFENSE:
            returnString += (this.data.chance * 100) + "% Chance to decrease damage by 50%.";
            break;
        case Astriarch.Research.ResearchType.PROPULSION_IMPROVEMENT:
        case Astriarch.Research.ResearchType.BUILDING_EFFICIENCY_IMPROVEMENT_FARMS:
        case Astriarch.Research.ResearchType.BUILDING_EFFICIENCY_IMPROVEMENT_MINES:
        case Astriarch.Research.ResearchType.BUILDING_EFFICIENCY_IMPROVEMENT_COLONIES:
        case Astriarch.Research.ResearchType.BUILDING_EFFICIENCY_IMPROVEMENT_FACTORIES:
            returnString += "Operating at " + (this.data.percent * 100) + "% efficiency.";
            break;
        case Astriarch.Research.ResearchType.SPACE_PLATFORM_IMPROVEMENT:
            returnString += "Maximum " + (this.data.max) + " per planet.";
            break;
    }
    return returnString;
};

Astriarch.Research.ResearchTypeProgress.prototype.GetFriendlyName = function() {
    var defaultName = "Unknown";
    switch(this.type) {
        case Astriarch.Research.ResearchType.NEW_SHIP_TYPE_DEFENDER:
            defaultName = "Custom " + Astriarch.GameTools.StarShipTypeToFriendlyName(Astriarch.Fleet.StarShipType.SystemDefense);
            break;
        case Astriarch.Research.ResearchType.NEW_SHIP_TYPE_SCOUT:
            defaultName = "Custom " + Astriarch.GameTools.StarShipTypeToFriendlyName(Astriarch.Fleet.StarShipType.Scout);
            break;
        case Astriarch.Research.ResearchType.NEW_SHIP_TYPE_DESTROYER:
            defaultName = "Custom " + Astriarch.GameTools.StarShipTypeToFriendlyName(Astriarch.Fleet.StarShipType.Destroyer);
            break;
        case Astriarch.Research.ResearchType.NEW_SHIP_TYPE_CRUISER:
            defaultName = "Custom " + Astriarch.GameTools.StarShipTypeToFriendlyName(Astriarch.Fleet.StarShipType.Cruiser);
            break;
        case Astriarch.Research.ResearchType.NEW_SHIP_TYPE_BATTLESHIP:
            defaultName = "Custom " + Astriarch.GameTools.StarShipTypeToFriendlyName(Astriarch.Fleet.StarShipType.Battleship);
            break;
        case Astriarch.Research.ResearchType.COMBAT_IMPROVEMENT_ATTACK:
            defaultName = "Ship Attack";
            break;
        case Astriarch.Research.ResearchType.COMBAT_IMPROVEMENT_DEFENSE:
            defaultName = "Ship Defense";
            break;
        case Astriarch.Research.ResearchType.PROPULSION_IMPROVEMENT:
            defaultName = "Ship Propulsion";
            break;
        case Astriarch.Research.ResearchType.BUILDING_EFFICIENCY_IMPROVEMENT_FARMS:
            defaultName = "Farms";
            break;
        case Astriarch.Research.ResearchType.BUILDING_EFFICIENCY_IMPROVEMENT_MINES:
            defaultName = "Mines";
            break;
        case Astriarch.Research.ResearchType.BUILDING_EFFICIENCY_IMPROVEMENT_COLONIES:
            defaultName = "Colonies";
            break;
        case Astriarch.Research.ResearchType.BUILDING_EFFICIENCY_IMPROVEMENT_FACTORIES:
            defaultName = "Factories";
            break;
        case Astriarch.Research.ResearchType.SPACE_PLATFORM_IMPROVEMENT:
            defaultName = "Space Platforms";
            break;
    }
    return defaultName;
};

Astriarch.Research.ResearchTypeProgress.prototype.ToString = function(nextLevel) {
    var level = this.currentResearchLevel + (nextLevel ? 2 : 1);
    var defaultName = this.GetFriendlyName();
    switch(this.type) {
        case Astriarch.Research.ResearchType.COMBAT_IMPROVEMENT_ATTACK:
            defaultName += " Level " + level;
            break;
        case Astriarch.Research.ResearchType.COMBAT_IMPROVEMENT_DEFENSE:
            defaultName += " Level " + level;
            break;
        case Astriarch.Research.ResearchType.PROPULSION_IMPROVEMENT:
            defaultName += " Level " + level;
            break;
        case Astriarch.Research.ResearchType.BUILDING_EFFICIENCY_IMPROVEMENT_FARMS:
            defaultName = "Level " + level + " " + defaultName;
            break;
        case Astriarch.Research.ResearchType.BUILDING_EFFICIENCY_IMPROVEMENT_MINES:
            defaultName = "Level " + level + " " + defaultName;
            break;
        case Astriarch.Research.ResearchType.BUILDING_EFFICIENCY_IMPROVEMENT_COLONIES:
            defaultName = "Level " + level + " " + defaultName;
            break;
        case Astriarch.Research.ResearchType.BUILDING_EFFICIENCY_IMPROVEMENT_FACTORIES:
            defaultName = "Level " + level + " " + defaultName;
            break;
        case Astriarch.Research.ResearchType.SPACE_PLATFORM_IMPROVEMENT:
            defaultName = "Level " + level + " " + defaultName;
            break;
    }
    return defaultName;
};

Astriarch.Research.ResearchType = {
    UNKNOWN: 0,
    NEW_SHIP_TYPE_DEFENDER: 1,
    NEW_SHIP_TYPE_SCOUT: 2,
    NEW_SHIP_TYPE_DESTROYER: 3,
    NEW_SHIP_TYPE_CRUISER: 4,
    NEW_SHIP_TYPE_BATTLESHIP: 5,
    COMBAT_IMPROVEMENT_ATTACK: 6, //data key is "chance" 0 - 1 of increasing damage by 50%
    COMBAT_IMPROVEMENT_DEFENSE: 7, //data key is "chance" 0 - 1 of decreasing damage by 50%
    PROPULSION_IMPROVEMENT: 8, //data key is "percent" 1 - 10
    BUILDING_EFFICIENCY_IMPROVEMENT_FARMS: 9, //data key is "percent" 1 - 2 increased efficiency of farms
    BUILDING_EFFICIENCY_IMPROVEMENT_MINES: 10, //data key is "percent" 1 - 2 increased efficiency of mines
    BUILDING_EFFICIENCY_IMPROVEMENT_COLONIES: 11,//data key is "percent" 1 - 2 increases population growth on planet
    BUILDING_EFFICIENCY_IMPROVEMENT_FACTORIES: 12, //data key is "percent" 1 - 2 increased efficiency of factories
    SPACE_PLATFORM_IMPROVEMENT: 13 //data key is "max" 1 - 5 maximum space platforms player can build on a planet
};