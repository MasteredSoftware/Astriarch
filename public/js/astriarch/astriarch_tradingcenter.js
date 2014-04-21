var Astriarch = Astriarch || require('./astriarch_base');

Astriarch.TradingCenter = new function(){
	this.goldAmount = 1000;
	this.foodResource = new Astriarch.TradingCenter.Resource(Astriarch.TradingCenter.ResourceType.FOOD, 300, 1200, 0.1, 1.5);
	this.oreResource = new Astriarch.TradingCenter.Resource(Astriarch.TradingCenter.ResourceType.ORE, 150, 600, 0.2, 3.0);
	this.iridiumResource = new Astriarch.TradingCenter.Resource(Astriarch.TradingCenter.ResourceType.IRIDIUM, 75, 300, 0.4, 6.0);

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
		this.currentPrice = this.priceMin + (priceChangePerUnit * this.amount);
	}
};