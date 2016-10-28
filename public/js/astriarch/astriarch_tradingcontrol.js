Astriarch.TradingControl = {
	dialog: null,//instance of Astriarch.Dialog
	planet: null,
	tradesSubmittedListBox: null,
	playerResourceAmountsAfterTrades: {food:0,ore:0,iridium:0},
	jqElm: {tradeResourceAmount:null, tradeResourceEstimatedPrice:null},

	init: function() {

		Astriarch.TradingControl.jqElm.tradeResourceAmount = $('#TradeResourceAmount');
		Astriarch.TradingControl.jqElm.tradeResourceEstimatedPrice = $('#TradeResourceEstimatedPrice');
		Astriarch.TradingControl.jqElm.buttonSubmitTrade = $('#ButtonSubmitTrade');

		$('#SliderTradeResourceAmount').slider({value:0, step:1, min:0, max:10, slide: Astriarch.TradingControl.SliderTradeResourceAmountValueChanged});

		$("#ButtonTradesSubmittedRetractSelectedTrade").button({ icons: {primary:'icon-16x16-build-queue-remove'}, text: false });
		$('#ButtonTradesSubmittedRetractSelectedTrade').button('disable');
		$("#ButtonTradesSubmittedRetractSelectedTrade").click(
			function() {
				Astriarch.TradingControl.ButtonRetractSelectedTradeClick();
			}
		);

		$( "#TradeTypeRadio" ).buttonset();
		$("#TradeResourceRadioFood").button( { icons: {primary:'icon-16x16-food'} } );
		$("#TradeResourceRadioOre").button( { icons: {primary:'icon-16x16-ore'} } );
		$("#TradeResourceRadioIridium").button( { icons: {primary:'icon-16x16-iridium'} } );
		$( "#TradeResourceRadio" ).buttonset();

		Astriarch.TradingControl.jqElm.buttonSubmitTrade.button();
		Astriarch.TradingControl.jqElm.buttonSubmitTrade.button('disable');

		Astriarch.TradingControl.jqElm.buttonSubmitTrade.click(
			function() {
				if(window.tour.enabled && (window.tour.step == 38)){
					window.tour.jqElm.joyride('nextTip');
				}

				Astriarch.TradingControl.ButtonSubmitTradeClick();
			}
		);

		$("input[name=TradeTypeRadioGroup]:radio").change(function () { Astriarch.TradingControl.setSliderPropertiesBasedOnNewTradeOptions() });
		$("input[name=TradeResourceRadioGroup]:radio").change(function () { Astriarch.TradingControl.setSliderPropertiesBasedOnNewTradeOptions() });

		Astriarch.TradingControl.tradesSubmittedListBox = new JSListBox({'containerSelector':'TradesSubmittedListBox'});

		Astriarch.TradingControl.dialog = new Astriarch.Dialog('#tradingControlDialog', 'Galactic Trading Center', 470, 425, Astriarch.TradingControl.OKClose);
	},

	show: function(/*Planet*/ planet) {
		Astriarch.TradingControl.planet = planet;

		Astriarch.TradingControl.dialog.setTitle("Galactic Trading Center, Trading from: " + planet.Name);
		Astriarch.TradingControl.dialog.open();

		this.refreshTradesSubmittedListBox();
		this.setSliderPropertiesBasedOnNewTradeOptions();
	},

	refreshStatsFromClientTradingCenter: function(){
		var ctc = Astriarch.ClientGameModel.ClientTradingCenter;
		$("#tcdStockpilePriceFood").text(Astriarch.DecimalToFixed(ctc.foodResource.currentPrice, 2));
		$("#tcdTradingCenterAmtFood").text(ctc.foodResource.amount);
		$("#tcdStockpileAmtFood").text(Math.floor(this.playerResourceAmountsAfterTrades.food));

		$("#tcdStockpilePriceOre").text(Astriarch.DecimalToFixed(ctc.oreResource.currentPrice, 2));
		$("#tcdTradingCenterAmtOre").text(ctc.oreResource.amount);
		$("#tcdStockpileAmtOre").text(Math.floor(this.playerResourceAmountsAfterTrades.ore));

		$("#tcdStockpilePriceIridium").text(Astriarch.DecimalToFixed(ctc.iridiumResource.currentPrice, 2));
		$("#tcdTradingCenterAmtIridium").text(ctc.iridiumResource.amount);
		$("#tcdStockpileAmtIridium").text(Math.floor(this.playerResourceAmountsAfterTrades.iridium));

		$("#tcdTradingCenterAmtGold").text(Astriarch.DecimalToFixed(ctc.goldAmount, 2));
	},

	refreshTradesSubmittedListBox: function() {
		Astriarch.TradingControl.setPlayerResourceAmountAfterCurrentTrades();
		Astriarch.TradingControl.tradesSubmittedListBox.clear();

		for (var t in Astriarch.ClientGameModel.ClientTradingCenter.clientPlayerTrades){

			var trade = Astriarch.ClientGameModel.ClientTradingCenter.clientPlayerTrades[t];
			var tradeItem = new Astriarch.TradingControl.TradeListBoxItem(trade);
			Astriarch.TradingControl.tradesSubmittedListBox.addItem(tradeItem);
		}
	},

	setSliderPropertiesBasedOnNewTradeOptions: function(){
		//if selected type is buy, slider max is trading stockpile
		//if selected type is sell, slider max is player stockpile

		var radioOptions = this.getSubmitTradeRadioButtonOptions();
		var max = 0;
		var ctc = Astriarch.ClientGameModel.ClientTradingCenter;
		if(radioOptions.tradeType == Astriarch.TradingCenter.TradeType.BUY){
			if(radioOptions.resourceType == Astriarch.TradingCenter.ResourceType.FOOD){
				max = Math.min(ctc.foodResource.amount, ctc.foodResource.tradeAmountMax);
			} else if(radioOptions.resourceType == Astriarch.TradingCenter.ResourceType.ORE){
				max = Math.min(ctc.oreResource.amount, ctc.oreResource.tradeAmountMax);
			} else {
				max = Math.min(ctc.iridiumResource.amount, ctc.iridiumResource.tradeAmountMax);
			}
		} else {
			if(radioOptions.resourceType == Astriarch.TradingCenter.ResourceType.FOOD){
				max = Math.min(this.playerResourceAmountsAfterTrades.food, ctc.foodResource.tradeAmountMax);
			} else if(radioOptions.resourceType == Astriarch.TradingCenter.ResourceType.ORE){
				max = Math.min(this.playerResourceAmountsAfterTrades.ore, ctc.oreResource.tradeAmountMax);
			} else {
				max = Math.min(this.playerResourceAmountsAfterTrades.iridium, ctc.iridiumResource.tradeAmountMax);
			}
		}
		this.jqElm.tradeResourceAmount.text(0);
		this.jqElm.tradeResourceEstimatedPrice.text(0);
		Astriarch.TradingControl.jqElm.buttonSubmitTrade.button('disable');
		$('#SliderTradeResourceAmount').slider("value", 0);
		$('#SliderTradeResourceAmount').slider("option", "max", max);
	},

	setPlayerResourceAmountAfterCurrentTrades: function(){

		var player = Astriarch.ClientGameModel.MainPlayer;
		this.playerResourceAmountsAfterTrades = {food:player.TotalFoodAmount(), ore:player.TotalOreAmount(), iridium:player.TotalIridiumAmount()};


		for(var t in Astriarch.ClientGameModel.ClientTradingCenter.clientPlayerTrades){
			var trade = Astriarch.ClientGameModel.ClientTradingCenter.clientPlayerTrades[t];
			var amount = trade.tradeType == Astriarch.TradingCenter.TradeType.BUY ? trade.amount : -1 * trade.amount;
			if(trade.resourceType == Astriarch.TradingCenter.ResourceType.FOOD){
				this.playerResourceAmountsAfterTrades.food += amount;
			} else if (trade.resourceType == Astriarch.TradingCenter.ResourceType.ORE){
				this.playerResourceAmountsAfterTrades.ore += amount;
			} else {
				this.playerResourceAmountsAfterTrades.iridium += amount;
			}
		}

		this.refreshStatsFromClientTradingCenter();
	},

	SliderTradeResourceAmountValueChanged: function(event, ui){
		var amount = ui.value;
		Astriarch.TradingControl.jqElm.tradeResourceAmount.text(amount);

		if(amount == 0){
			Astriarch.TradingControl.jqElm.buttonSubmitTrade.button('disable');
		} else {
			Astriarch.TradingControl.jqElm.buttonSubmitTrade.button('enable');
		}

		//calculate estimated price
		var estimatedPrice = 0;
		var radioOptions = Astriarch.TradingControl.getSubmitTradeRadioButtonOptions();
		var ctc = Astriarch.ClientGameModel.ClientTradingCenter;
		if(radioOptions.resourceType == Astriarch.TradingCenter.ResourceType.FOOD){
			estimatedPrice = ctc.foodResource.currentPrice * amount;
		} else if (radioOptions.resourceType == Astriarch.TradingCenter.ResourceType.ORE){
			estimatedPrice = ctc.oreResource.currentPrice * amount;
		} else {
			estimatedPrice = ctc.iridiumResource.currentPrice * amount;
		}
		Astriarch.TradingControl.jqElm.tradeResourceEstimatedPrice.text(Astriarch.DecimalToFixed(estimatedPrice, 2));
	},

	ButtonSubmitTradeClick: function(){

		var radioOptions = this.getSubmitTradeRadioButtonOptions();
		var amount = parseInt(this.jqElm.tradeResourceAmount.text());
		var orderType = Astriarch.TradingCenter.OrderType.MARKET;
		var limitPrice = null;

		var clientTrade = new Astriarch.TradingCenter.Trade(-1, this.planet.Id, radioOptions.tradeType, radioOptions.resourceType, amount, orderType, limitPrice);

		Astriarch.server_comm.sendMessage({type:Astriarch.Shared.MESSAGE_TYPE.SUBMIT_TRADE, payload:{"trade":clientTrade}});

		Astriarch.ClientGameModel.ClientTradingCenter.clientPlayerTrades.push(clientTrade);

		this.refreshTradesSubmittedListBox();
	},

	ButtonRetractSelectedTradeClick: function(){
		var o = Astriarch.TradingControl.tradesSubmittedListBox.SelectedItem;
		var index = Astriarch.TradingControl.tradesSubmittedListBox.SelectedIndex;
		if (o != null && index != null) {
			Astriarch.server_comm.sendMessage({type:Astriarch.Shared.MESSAGE_TYPE.CANCEL_TRADE, payload:{"tradeIndex":index, "planetId":this.planet.Id}});

			Astriarch.ClientGameModel.ClientTradingCenter.clientPlayerTrades.splice(index, 1);

			this.refreshTradesSubmittedListBox();
		}
	},

	getSubmitTradeRadioButtonOptions: function(){
		var radioOptions = {tradeType:null, resourceType:null};
		radioOptions.tradeType = $('input:radio[name=TradeTypeRadioGroup]:checked').val();
		radioOptions.tradeType = (radioOptions.tradeType == "buy" ? Astriarch.TradingCenter.TradeType.BUY : Astriarch.TradingCenter.TradeType.SELL);
		radioOptions.resourceType = $('input:radio[name=TradeResourceRadioGroup]:checked').val();
		radioOptions.resourceType = (radioOptions.resourceType == "food" ? Astriarch.TradingCenter.ResourceType.FOOD : (radioOptions.resourceType == "ore" ? Astriarch.TradingCenter.ResourceType.ORE : Astriarch.TradingCenter.ResourceType.IRIDIUM));
		return radioOptions;
	},

	TradesSubmittedSelectionChanged: function(){
		$('#ButtonTradesSubmittedRetractSelectedTrade').button('disable');
		if (Astriarch.TradingControl.tradesSubmittedListBox.SelectedItem != null) {
			$('#ButtonTradesSubmittedRetractSelectedTrade').button('enable');
		}
	},

	OKClose: function()	{
		if(window.tour.enabled && (window.tour.step == 39)){
			window.tour.jqElm.joyride('nextTip');
		}
		//Astriarch.View.SendShipsDialogWindowClosed(true);
	},

	Close: function() {
		Astriarch.TradingControl.dialog.dlg.dialog('close');
	}
};


/**
 * TradeListBoxItem is a list box item for the current trades list
 * @constructor
 */
Astriarch.TradingControl.TradeListBoxItem = JSListBox.Item.extend({

	Trade: null,//Astriarch.TradingCenter.Trade

	/**
	 * initializes this TradeListBoxItem
	 * @this {Astriarch.TradingControl.TradeListBoxItem}
	 */
	init: function(trade) {
		this.Trade = trade;
	},

	/**
	 * renders this TradeListBoxItem
	 * @this {Astriarch.TradingControl.TradeListBoxItem}
	 * @return {string}
	 */
	render: function() {
		var name = Astriarch.TradingCenter.TradeToString(this.Trade);

		return '<a href="#">' + name + '</a>';
	},

	/**
	 * fires the selection changed event
	 * @this {Astriarch.TradingControl.TradeListBoxItem}
	 */
	onClick: function() {
		Astriarch.TradingControl.TradesSubmittedSelectionChanged();
	}

});