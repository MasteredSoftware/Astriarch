var Astriarch = Astriarch || require('./astriarch_base');

Astriarch.TradingCenter = function(){
	this.goldAmount = 1000;
	this.foodResource = new Astriarch.TradingCenter.Resource(Astriarch.TradingCenter.ResourceType.FOOD, 300, 1200, 0.1, 1.5);
	this.oreResource = new Astriarch.TradingCenter.Resource(Astriarch.TradingCenter.ResourceType.ORE, 150, 600, 0.2, 3.0);
	this.iridiumResource = new Astriarch.TradingCenter.Resource(Astriarch.TradingCenter.ResourceType.IRIDIUM, 75, 300, 0.4, 6.0);

	this.currentTrades = [];
};

Astriarch.TradingCenter.prototype.recalculatePrices = function(){
	this.foodResource.calculateCurrentPrice();
	this.oreResource.calculateCurrentPrice();
	this.iridiumResource.calculateCurrentPrice();
};

Astriarch.TradingCenter.prototype.getResourceByType = function(resourceType){
	return resourceType == Astriarch.TradingCenter.ResourceType.FOOD ? this.foodResource : (resourceType == Astriarch.TradingCenter.ResourceType.ORE ? this.oreResource : this.iridiumResource);
};

Astriarch.TradingCenter.prototype.executeTrade = function(gameModel, player, planet, trade){
	//return false if the trade could not be executed
	var executedStatus = {executed:false, foodAmount:0, oreAmount:0, iridiumAmount:0, tradeGoldAmount:0};


	var marketResource = this.getResourceByType(trade.resourceType);
	var playerResourceAmount = 0;

	if(trade.resourceType == Astriarch.TradingCenter.ResourceType.FOOD){
		playerResourceAmount = player.TotalFoodAmount();
		executedStatus.foodAmount = trade.amount;
	} else if (trade.resourceType == Astriarch.TradingCenter.ResourceType.ORE){
		playerResourceAmount = player.TotalOreAmount();
		executedStatus.oreAmount = trade.amount;
	} else {
		playerResourceAmount = player.TotalIridiumAmount();
		executedStatus.iridiumAmount = trade.amount;
	}
	executedStatus.tradeGoldAmount = trade.amount * marketResource.currentPrice;

	if(trade.tradeType == Astriarch.TradingCenter.TradeType.SELL){
		//ensure the player has enough resources and the market has enough gold

		executedStatus.tradeGoldAmount -= executedStatus.tradeGoldAmount * 0.1;
		if(this.goldAmount >= executedStatus.tradeGoldAmount && playerResourceAmount >= trade.amount){
			//execute trade
			this.goldAmount -= executedStatus.tradeGoldAmount;
			player.Resources.GoldRemainder += executedStatus.tradeGoldAmount;

			marketResource.amount += trade.amount;
			planet.SpendResources(gameModel, 0, executedStatus.foodAmount, executedStatus.oreAmount, executedStatus.iridiumAmount, player);

			executedStatus.executed = true;
		}

	} else { //BUY
		//ensure the player has enough gold and the market has enough resources

		executedStatus.tradeGoldAmount += executedStatus.tradeGoldAmount * 0.1;
		if(player.Resources.GoldAmount >= executedStatus.tradeGoldAmount && marketResource.amount >= trade.amount){
			//execute trade
			this.goldAmount += executedStatus.tradeGoldAmount;
			player.Resources.GoldRemainder -= executedStatus.tradeGoldAmount;

			marketResource.amount -= trade.amount;
			if(trade.resourceType == Astriarch.TradingCenter.ResourceType.FOOD){
				planet.Resources.FoodAmount += trade.amount;
			} else if (trade.resourceType == Astriarch.TradingCenter.ResourceType.ORE){
				planet.Resources.OreAmount += trade.amount;
			} else {
				planet.Resources.IridiumAmount += trade.amount;
			}

			executedStatus.executed = true;
		}
	}

	return executedStatus;
};

Astriarch.TradingCenter.ResourceType = {
	"FOOD":1,
	"ORE":2,
	"IRIDIUM":3
};

Astriarch.TradingCenter.Resource = function(type, amount, desiredAmount, priceMin, priceMax){
	this.type = type;
	this.amount = amount;
	this.desiredAmount = desiredAmount;
	this.priceMin = priceMin;
	this.priceMax = priceMax;

	this.currentPrice = priceMax;
	this.calculateCurrentPrice();
};

Astriarch.TradingCenter.Resource.prototype.calculateCurrentPrice = function(){
	if(this.amount >= this.desiredAmount){
		this.currentPrice = this.priceMin;
	} else if(this.amount <= 0){
		this.currentPrice = this.priceMax;
	} else {
		var priceChangePerUnit = (this.priceMax - this.priceMin) / this.desiredAmount;
		this.currentPrice = this.priceMin + (priceChangePerUnit * (this.desiredAmount - this.amount));
	}
};

Astriarch.TradingCenter.TradeType = {
	"BUY":1,
	"SELL":2
};

//TODO: Implement later?
Astriarch.TradingCenter.OrderType = {
	"MARKET":1,
	"LIMIT":2
};

Astriarch.TradingCenter.Trade = function(playerId, planetId, tradeType, resourceType, amount, orderType, limitPrice){
	this.playerId = playerId;
	this.planetId = planetId;
	this.tradeType = tradeType;
	this.resourceType = resourceType;
	this.amount = amount;
	this.orderType = orderType;
	this.limitPrice = limitPrice;
};

Astriarch.TradingCenter.TradeToString = function(trade){
	var typeText = trade.tradeType == Astriarch.TradingCenter.TradeType.BUY ? "Buy" : "Sell";
	var resourceText = trade.resourceType == Astriarch.TradingCenter.ResourceType.FOOD ? "Food" : (trade.resourceType == Astriarch.TradingCenter.ResourceType.ORE ? "Ore" : "Iridium");
	return typeText + " " + trade.amount + " " + resourceText;
};