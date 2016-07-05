Astriarch.PlanetView = {
	dialog:null,//instance of Astriarch.Dialog
	
	planetMain:null,//planet of the currently popped-up dialog
	
	population:0,
    farmers:0,
    miners:0,
    workers:0,
	
	farmCount:0,
    mineCount:0,
    factoryCount:0,
    colonyCount:0,
	
	//build queue items
    workingBuildQueue: [],//List<PlanetProductionItem>
    workingResources: null,//WorkingPlayerResources
    workingProductionRemainderOriginal:0,
	
	lastClicked: null,
    lastChanged: null,
	
	updatingGUI: false,
	ItemsAvailableCardList: null,
	BuildQueueListBox: null,
	//items available list box items
	//AvailableImprovementCardListItems
	lbiFarm: null,
	lbiMine: null,
	lbiColony: null,
	lbiFactory: null,
	lbiSpacePlatform: null,
	//AvailableStarShipCardListItems
	lbiDefender: null,
	lbiScout: null,
	lbiDestroyer: null,
	lbiCruiser: null,
	lbiBattleship: null,
	
	itemsAvailable: [],
	
	init: function() {
		$( "#ButtonDemolishFarm, #ButtonDemolishMine, #ButtonDemolishFactory, #ButtonDemolishColony").button({ icons: {primary:'icon-16x16-demolish'}, text: false });
 
		$('#SliderFarmers').slider({value:0, step:1, min:0, max:10, slide: Astriarch.PlanetView.SliderFarmersValueChanged});
		$('#SliderMiners').slider({value:0, step:1, min:0, max:10, slide: Astriarch.PlanetView.SliderMinersValueChanged});
		$('#SliderWorkers').slider({value:0, step:1, min:0, max:10, slide: Astriarch.PlanetView.SliderWorkersValueChanged});

		$('#BuildLastShipCheckBox').change(Astriarch.PlanetView.BuildLastShipCheckBoxValueChanged);

		$("#ButtonBuildQueueRemoveSelectedItem").button({ icons: {primary:'icon-16x16-build-queue-remove'}, text: false });
		$("#ButtonBuildQueueMoveSelectedItemDown").button({ icons: {primary:'icon-16x16-build-queue-down'}, text: false });
		$("#ButtonBuildQueueMoveSelectedItemUp").button({ icons: {primary:'icon-16x16-build-queue-up'}, text: false });
		
		$( "#ButtonBuildQueueRemoveSelectedItem" ).click(
			function() {
				Astriarch.PlanetView.removeSelectedItemFromQueue();
			}
		);
		
		$( "#ButtonBuildQueueMoveSelectedItemDown" ).click(
			function() {
				Astriarch.PlanetView.moveSelectedItemInQueue(false);
			}
		);
		
		$( "#ButtonBuildQueueMoveSelectedItemUp" ).click(
			function() {
				Astriarch.PlanetView.moveSelectedItemInQueue(true);
			}
		);
		
		$( "#ButtonDemolishFarm" ).click(
			function() {
				Astriarch.PlanetView.addImprovementToDestroy(Astriarch.Planet.PlanetImprovementType.Farm);
			}
		);
		
		$( "#ButtonDemolishMine" ).click(
			function() {
				Astriarch.PlanetView.addImprovementToDestroy(Astriarch.Planet.PlanetImprovementType.Mine);
			}
		);
		
		$( "#ButtonDemolishFactory" ).click(
			function() {
				Astriarch.PlanetView.addImprovementToDestroy(Astriarch.Planet.PlanetImprovementType.Factory);
			}
		);
		
		$( "#ButtonDemolishColony" ).click(
			function() {
				Astriarch.PlanetView.addImprovementToDestroy(Astriarch.Planet.PlanetImprovementType.Colony);
			}
		);

		$("#PlanetViewButtonFarmers, #PlanetViewButtonMiners, #PlanetViewButtonWorkers").button();

		$("#PlanetViewButtonFarmers").click(
			function() {
				var sliderElm = $('#SliderFarmers');
				var newSliderValue = sliderElm.slider("value") + 1;
				Astriarch.PlanetView.updateSliderValues(Astriarch.PlanetView.SliderValueClicked.Farmers, newSliderValue);
				sliderElm.slider("value", newSliderValue);//we still have to set it in the ui because we didn't click it
			}
		);

		$("#PlanetViewButtonMiners").click(
			function() {
				var sliderElm = $('#SliderMiners');
				var newSliderValue = sliderElm.slider("value") + 1;
				Astriarch.PlanetView.updateSliderValues(Astriarch.PlanetView.SliderValueClicked.Miners, newSliderValue);
				sliderElm.slider("value", newSliderValue);//we still have to set it in the ui because we didn't click it
			}
		);

		$("#PlanetViewButtonWorkers").click(
			function() {
				var sliderElm = $('#SliderWorkers');
				var newSliderValue = sliderElm.slider("value") + 1;
				Astriarch.PlanetView.updateSliderValues(Astriarch.PlanetView.SliderValueClicked.Workers, newSliderValue);
				sliderElm.slider("value", newSliderValue);//we still have to set it in the ui because we didn't click it
			}
		);

		$( "#ButtonClearWaypoint" ).button();
		$( "#ButtonClearWaypoint" ).click(
			function() {
				$('#ButtonClearWaypoint').button('disable');
				Astriarch.server_comm.sendMessage({type:Astriarch.Shared.MESSAGE_TYPE.CLEAR_WAYPOINT, payload:{"planetIdSource":Astriarch.PlanetView.planetMain.Id} });
				Astriarch.PlanetView.planetMain.WayPointPlanetId = null;
			}
		);
		
		var checkBoxTooltip = "If this option is checked and the build queue is empty at the end of the turn,\r\nthe ship last built on this planet will be added to the queue.\r\nIn order to build the ship, sufficient resources must exist\r\nas well as a surplus of gold to cover the amount of food shipped last turn.";
		//$('#BuildLastShipCheckBox').attr('title', checkBoxTooltip);
		$('#BuildLastShipCheckBoxLabel').attr('title', checkBoxTooltip);
		
		$('#BuildLastShipCheckBox').prop('checked', true);
		
		Astriarch.PlanetView.ItemsAvailableCardList = new JSCardList({'containerSelector':'ItemsAvailableCardList', 'multiselect':false});
		Astriarch.PlanetView.BuildQueueListBox = new JSListBox({'containerSelector':'BuildQueueListBox'});
	 
		Astriarch.PlanetView.lbiFarm = new Astriarch.PlanetView.AvailableImprovementCardListItem(Astriarch.Planet.PlanetImprovementType.Farm, 'r');
        Astriarch.PlanetView.lbiMine = new Astriarch.PlanetView.AvailableImprovementCardListItem(Astriarch.Planet.PlanetImprovementType.Mine, 'i');
        Astriarch.PlanetView.lbiColony = new Astriarch.PlanetView.AvailableImprovementCardListItem(Astriarch.Planet.PlanetImprovementType.Colony, 'o');
        Astriarch.PlanetView.lbiFactory = new Astriarch.PlanetView.AvailableImprovementCardListItem(Astriarch.Planet.PlanetImprovementType.Factory, 'a');
        Astriarch.PlanetView.lbiSpacePlatform = new Astriarch.PlanetView.AvailableImprovementCardListItem(Astriarch.Planet.PlanetImprovementType.SpacePlatform, 'P');

        Astriarch.PlanetView.lbiDefender = new Astriarch.PlanetView.AvailableStarShipCardListItem(Astriarch.Fleet.StarShipType.SystemDefense, 'e');
        Astriarch.PlanetView.lbiScout = new Astriarch.PlanetView.AvailableStarShipCardListItem(Astriarch.Fleet.StarShipType.Scout, 'S');
        Astriarch.PlanetView.lbiDestroyer = new Astriarch.PlanetView.AvailableStarShipCardListItem(Astriarch.Fleet.StarShipType.Destroyer, 'D');
        Astriarch.PlanetView.lbiCruiser = new Astriarch.PlanetView.AvailableStarShipCardListItem(Astriarch.Fleet.StarShipType.Cruiser, 'C');
        Astriarch.PlanetView.lbiBattleship = new Astriarch.PlanetView.AvailableStarShipCardListItem(Astriarch.Fleet.StarShipType.Battleship, 'B');

		Astriarch.PlanetView.itemsAvailable.push(Astriarch.PlanetView.lbiFarm);
		Astriarch.PlanetView.itemsAvailable.push(Astriarch.PlanetView.lbiMine);
		Astriarch.PlanetView.itemsAvailable.push(Astriarch.PlanetView.lbiColony);
		Astriarch.PlanetView.itemsAvailable.push(Astriarch.PlanetView.lbiFactory);
		Astriarch.PlanetView.itemsAvailable.push(Astriarch.PlanetView.lbiSpacePlatform);
		//Astriarch.PlanetView.ItemsAvailableCardList.addItem(new Separator());
		Astriarch.PlanetView.itemsAvailable.push(Astriarch.PlanetView.lbiDefender);
		Astriarch.PlanetView.itemsAvailable.push(Astriarch.PlanetView.lbiScout);
		Astriarch.PlanetView.itemsAvailable.push(Astriarch.PlanetView.lbiDestroyer);
		Astriarch.PlanetView.itemsAvailable.push(Astriarch.PlanetView.lbiCruiser);
		Astriarch.PlanetView.itemsAvailable.push(Astriarch.PlanetView.lbiBattleship);
	 
		Astriarch.PlanetView.dialog = new Astriarch.Dialog('#planetViewDialog', 'Planet View', 568, 485, Astriarch.PlanetView.OKClose);
		
		Astriarch.PlanetView.lastClicked = Astriarch.PlanetView.SliderValueClicked.None;
		Astriarch.PlanetView.lastChanged = Astriarch.PlanetView.SliderValueClicked.None;
		
	},
	
	show: function(/*Planet*/ p) {

		Astriarch.server_comm.sendMessage({type:Astriarch.Shared.MESSAGE_TYPE.UPDATE_PLANET_START, payload:{"planetId":p.Id}});

		Astriarch.PlanetView.planetMain = p;
		
		var planetImageClass = Astriarch.GameTools.PlanetTypeToClassName(p.Type);

		$('#PlanetImage').attr("class",planetImageClass);
		
		$('#TextBlockPlanetType').text(Astriarch.GameTools.PlanetTypeToFriendlyName(p.Type));
		
		Astriarch.PlanetView.farmCount = p.BuiltImprovements[Astriarch.Planet.PlanetImprovementType.Farm].length;
        Astriarch.PlanetView.mineCount = p.BuiltImprovements[Astriarch.Planet.PlanetImprovementType.Mine].length;
        Astriarch.PlanetView.factoryCount = p.BuiltImprovements[Astriarch.Planet.PlanetImprovementType.Factory].length;
        Astriarch.PlanetView.colonyCount = p.BuiltImprovements[Astriarch.Planet.PlanetImprovementType.Colony].length;
		
		$('#PlanetViewFarmCount').text(Astriarch.PlanetView.farmCount);
        $('#PlanetViewMineCount').text(Astriarch.PlanetView.mineCount);
        $('#PlanetViewFactoryCount').text(Astriarch.PlanetView.factoryCount);
        $('#PlanetViewColonyCount').text(Astriarch.PlanetView.colonyCount);
        $('#PlanetViewSpacePlatformCount').text(p.BuiltImprovements[Astriarch.Planet.PlanetImprovementType.SpacePlatform].length);

		Astriarch.PlanetView.refreshResourcesPerTurnTextBoxes();

		Astriarch.PlanetView.updatePlanetStatsToolTip();

		var citizens = p.GetPopulationByContentment();
		Astriarch.PlanetView.population = citizens.content.length;
		$('#SliderFarmers').slider("option", "max", Astriarch.PlanetView.population);
		$('#SliderMiners').slider("option", "max", Astriarch.PlanetView.population);
		$('#SliderWorkers').slider("option", "max", Astriarch.PlanetView.population);
		
		var pop = new Astriarch.Planet.PopulationAssignments();
		p.CountPopulationWorkerTypes(pop);
		Astriarch.PlanetView.farmers = pop.Farmers;
		Astriarch.PlanetView.miners = pop.Miners;
		Astriarch.PlanetView.workers = pop.Workers;

		$('#SliderFarmers').slider("value", Astriarch.PlanetView.farmers);
		$('#TextBoxFarmers').text(Astriarch.PlanetView.farmers + "");

		$('#SliderMiners').slider("value", Astriarch.PlanetView.miners);
		$('#TextBoxMiners').text(Astriarch.PlanetView.miners + "");

		$('#SliderWorkers').slider("value", Astriarch.PlanetView.workers);
		$('#TextBoxWorkers').text(Astriarch.PlanetView.workers + "");
		
		//copy the planet's buildQueue into our working build queue
		Astriarch.PlanetView.workingBuildQueue = [];
		for(var i in p.BuildQueue)
			Astriarch.PlanetView.workingBuildQueue.push(p.BuildQueue[i]);
		
		Astriarch.PlanetView.workingResources = new Astriarch.Model.WorkingPlayerResources(p.Owner);
		Astriarch.PlanetView.workingProductionRemainderOriginal = p.RemainderProduction;

		Astriarch.PlanetView.ItemsAvailableCardList.setSelectedItem(null);
		Astriarch.PlanetView.refreshItemsAvailableCardList();
		
		Astriarch.PlanetView.refreshBuildQueueListBox();
		Astriarch.PlanetView.showOrHideDemolishImprovementButtons();

		$('#ButtonBuildQueueRemoveSelectedItem').button('disable');
		$('#ButtonBuildQueueMoveSelectedItemDown').button('disable');
		$('#ButtonBuildQueueMoveSelectedItemUp').button('disable');

		if(Astriarch.PlanetView.planetMain.WayPointPlanetId) {
			$('#ButtonClearWaypoint').button('enable');
		} else {
			$('#ButtonClearWaypoint').button('disable');
		}
		
		Astriarch.PlanetView.refreshCurrentWorkingResourcesTextBoxes();
		
		if(Astriarch.PlanetView.planetMain.BuildLastStarShip) {
			$("#BuildLastShipCheckBox").prop('checked', true);
		} else {
			$("#BuildLastShipCheckBox").prop('checked', false);
		}
		

		$("#LastShipBuiltTextBlock").text("");
		if (Astriarch.PlanetView.planetMain.StarShipTypeLastBuilt != null) {
			$("#LastShipBuiltTextBlock").text("Last Built: " + Astriarch.GameTools.StarShipTypeToFriendlyName(Astriarch.PlanetView.planetMain.StarShipTypeLastBuilt));
		}
	
		Astriarch.PlanetView.dialog.setTitle("Planet " + p.Name + " View");
		Astriarch.PlanetView.dialog.open();

		if(window.tour.enabled && (window.tour.step == 27 || window.tour.step == 32 || window.tour.step == 43)){
			window.tour.jqElm.joyride('resume');
		}
	},
	
	BuildQueueSelectionChanged: function() {
		$('#ButtonBuildQueueRemoveSelectedItem').button('disable');
		$('#ButtonBuildQueueMoveSelectedItemDown').button('disable');
		$('#ButtonBuildQueueMoveSelectedItemUp').button('disable');
		if (Astriarch.PlanetView.BuildQueueListBox.SelectedItem != null)
		{
			$('#ButtonBuildQueueRemoveSelectedItem').button('enable');
			if (Astriarch.PlanetView.BuildQueueListBox.SelectedIndex != Astriarch.PlanetView.BuildQueueListBox.items.length - 1)
				$('#ButtonBuildQueueMoveSelectedItemDown').button('enable');
			if (Astriarch.PlanetView.BuildQueueListBox.SelectedIndex != 0)
				$('#ButtonBuildQueueMoveSelectedItemUp').button('enable');
		}
	},
	
	ItemsAvailableClicked: function() {
		Astriarch.PlanetView.addSelectedItemToQueue();
		//TODO: this is kinda a hack to make the cardlist behave like a card button list, maybe this should be suppoted in the card list?
		setTimeout(function() { Astriarch.PlanetView.ItemsAvailableCardList.selectNone(); }, 70);
	},
	
	recalculateBuildQueueListItemsTurnsToCompleteEstimates: function() {
		var self = Astriarch.PlanetView;
		//TODO: will this be too slow?
		self.planetMain.UpdatePopulationWorkerTypes(self.farmers, self.miners, self.workers);
		self.planetMain.ResourcesPerTurn.UpdateResourcesPerTurnBasedOnPlanetStats();

		var workingProdRemainder = self.workingProductionRemainderOriginal;
		for ( var i in self.BuildQueueListBox.items)
		{
			var queueItem = self.BuildQueueListBox.items[i];//BuildQueueListBoxItem
			queueItem.ProductionItem.EstimateTurnsToComplete(self.planetMain.ResourcesPerTurn.GetProductionAmountPerTurn() + workingProdRemainder);
			workingProdRemainder = 0;
		}
		self.BuildQueueListBox.refresh();
	},
	
	refreshResourcesPerTurnTextBoxes: function() {
		$('#TextBlockFoodPerTurn').text(Astriarch.PlanetView.planetMain.ResourcesPerTurn.FoodAmountPerTurn);
        $('#TextBlockOrePerTurn').text(Astriarch.PlanetView.planetMain.ResourcesPerTurn.OreAmountPerTurn);
        $('#TextBlockIridiumPerTurn').text(Astriarch.PlanetView.planetMain.ResourcesPerTurn.IridiumAmountPerTurn);
        $('#TextBlockProductionPerTurn').text(Astriarch.PlanetView.planetMain.ResourcesPerTurn.GetProductionAmountPerTurn());
	},
	
	updatePlanetStatsToolTip: function() {
		var ttText = "";
		ttText += "Base Worker Resource Generation Per Turn:\r\n";
		ttText += "Food: " + Astriarch.PlanetView.planetMain.ResourcesPerTurn.BaseFoodAmountPerWorkerPerTurn + "\r\n";
		ttText += "Ore: " + Astriarch.PlanetView.planetMain.ResourcesPerTurn.BaseOreAmountPerWorkerPerTurn + "\r\n";
		ttText += "Iridium: " + Astriarch.PlanetView.planetMain.ResourcesPerTurn.BaseIridiumAmountPerWorkerPerTurn + "\r\n";
		ttText += "Production: " + Astriarch.PlanetView.planetMain.ResourcesPerTurn.BaseProductionPerWorkerPerTurn + "\r\n\r\n";

		ttText += "Worker Resource Generation with Improvements:\r\n";
		ttText += "Food: " + Astriarch.PlanetView.planetMain.ResourcesPerTurn.GetExactFoodAmountPerWorkerPerTurn() + "\r\n";
		ttText += "Ore: " + Astriarch.PlanetView.planetMain.ResourcesPerTurn.GetExactOreAmountPerWorkerPerTurn() + "\r\n";
		ttText += "Iridium: " + Astriarch.PlanetView.planetMain.ResourcesPerTurn.GetExactIridiumAmountPerWorkerPerTurn() + "\r\n";
		ttText += "Production: " + Astriarch.PlanetView.planetMain.ResourcesPerTurn.GetExactProductionAmountPerWorkerPerTurn() + "\r\n\r\n";

		ttText += "Food amount on planet: " + Astriarch.PlanetView.planetMain.Resources.FoodAmount + "\r\n";
		$('#PlanetImage').attr('title', "Planet Stats:\r\n" + ttText);
	},
	
	workingQueueContainsSpacePlatform: function() {
		for (var i in Astriarch.PlanetView.workingBuildQueue)
		{
			var ppi = Astriarch.PlanetView.workingBuildQueue[i];//PlanetProductionItem
			if (ppi instanceof Astriarch.Planet.PlanetImprovement && ppi.Type == Astriarch.Planet.PlanetImprovementType.SpacePlatform)
				return true;
		}
		return false;
	},
	
	disableOrEnableImprovementsBasedOnSlotsAvailable: function() {
		var improvementCount = Astriarch.PlanetView.planetMain.BuiltImprovementCount();
		//count items that take up slots in working queue
		for (var i in Astriarch.PlanetView.workingBuildQueue)
		{
			var ppi = Astriarch.PlanetView.workingBuildQueue[i];//PlanetProductionItem
			if (ppi instanceof Astriarch.Planet.PlanetImprovement && ppi.Type != Astriarch.Planet.PlanetImprovementType.SpacePlatform)
				improvementCount++;
		}

		var slotsAvailable = Astriarch.PlanetView.planetMain.MaxImprovements - improvementCount;

		if (slotsAvailable <= 0) {
			//less than zero is a problem, but we'll just make sure they can't build more here
			Astriarch.PlanetView.lbiFarm.CanBuild = false;
			Astriarch.PlanetView.lbiMine.CanBuild = false;
			Astriarch.PlanetView.lbiColony.CanBuild = false;
			Astriarch.PlanetView.lbiFactory.CanBuild = false;
		} else {
			Astriarch.PlanetView.lbiFarm.CanBuild = true;
			Astriarch.PlanetView.lbiMine.CanBuild = true;
			Astriarch.PlanetView.lbiColony.CanBuild = true;
			Astriarch.PlanetView.lbiFactory.CanBuild = true;
		}

		if (Astriarch.PlanetView.planetMain.BuiltImprovements[Astriarch.Planet.PlanetImprovementType.Factory].length == 0)
			Astriarch.PlanetView.lbiSpacePlatform.CanBuild = false;
		else
			Astriarch.PlanetView.lbiSpacePlatform.CanBuild = true;

		//we can only have one space platform
		if (Astriarch.PlanetView.planetMain.BuiltImprovements[Astriarch.Planet.PlanetImprovementType.SpacePlatform].length > 0 ||
			Astriarch.PlanetView.workingQueueContainsSpacePlatform()) {
			Astriarch.PlanetView.lbiSpacePlatform.CanBuild = false;
		}
	},
	
	disableImprovementsBasedOnResourcesAvailable: function() {
		for(var i in Astriarch.PlanetView.itemsAvailable) {
			var lbi = Astriarch.PlanetView.itemsAvailable[i];//ListBoxItem
			if (lbi instanceof Astriarch.PlanetView.AvailableImprovementCardListItem) {
				if (lbi.CanBuild) {
					if (Astriarch.PlanetView.workingResources.GoldAmount < lbi.AvailablePlanetImprovement.GoldCost ||
						Astriarch.PlanetView.workingResources.IridiumAmount < lbi.AvailablePlanetImprovement.IridiumCost ||
						Astriarch.PlanetView.workingResources.OreAmount < lbi.AvailablePlanetImprovement.OreCost) {
						lbi.CanBuildBasedOnResources = false;
					} else {
						lbi.CanBuildBasedOnResources = true;
					}
				}

			} else if (lbi instanceof Astriarch.PlanetView.AvailableStarShipCardListItem) {
				if (lbi.CanBuild) {
					if (Astriarch.PlanetView.workingResources.GoldAmount < lbi.AvailableStarShip.GoldCost ||
							Astriarch.PlanetView.workingResources.IridiumAmount < lbi.AvailableStarShip.IridiumCost ||
							Astriarch.PlanetView.workingResources.OreAmount < lbi.AvailableStarShip.OreCost) {
						lbi.CanBuildBasedOnResources = false;
					} else {
						lbi.CanBuildBasedOnResources = true;
					}
				}
			}
		}

		//check to ensure the selected item is not enabled
		if (Astriarch.PlanetView.ItemsAvailableCardList.SelectedItem != null &&
		    !(Astriarch.PlanetView.ItemsAvailableCardList.SelectedItem.CanBuild && Astriarch.PlanetView.ItemsAvailableCardList.SelectedItem.CanBuildBasedOnResources) ) {
			Astriarch.PlanetView.ItemsAvailableCardList.setSelectedItem(null);
			Astriarch.PlanetView.ItemsAvailableCardList.refresh();
		}
	},
	
	refreshItemsAvailableCardList: function() {

		Astriarch.PlanetView.disableOrEnableImprovementsBasedOnSlotsAvailable();

		if (Astriarch.PlanetView.planetMain.BuiltImprovements[Astriarch.Planet.PlanetImprovementType.Factory].length == 0)
			Astriarch.PlanetView.lbiDestroyer.CanBuild = false;
		else
			Astriarch.PlanetView.lbiDestroyer.CanBuild = true;
		if (Astriarch.PlanetView.planetMain.BuiltImprovements[Astriarch.Planet.PlanetImprovementType.SpacePlatform].length == 0)
		{
			Astriarch.PlanetView.lbiCruiser.CanBuild = false;
			Astriarch.PlanetView.lbiBattleship.CanBuild = false;
		}
		else
		{
			Astriarch.PlanetView.lbiCruiser.CanBuild = true;
			Astriarch.PlanetView.lbiBattleship.CanBuild = true;
		}
		
		Astriarch.PlanetView.disableImprovementsBasedOnResourcesAvailable();
		
		Astriarch.PlanetView.ItemsAvailableCardList.clear();
		Astriarch.PlanetView.ItemsAvailableCardList.addItems(Astriarch.PlanetView.itemsAvailable);
	},
	
	refreshBuildQueueListBox: function() {
		Astriarch.PlanetView.BuildQueueListBox.clear();

		var workingProdRemainder = Astriarch.PlanetView.workingProductionRemainderOriginal;
		for (var i in Astriarch.PlanetView.workingBuildQueue)
		{
			var ppi = Astriarch.PlanetView.workingBuildQueue[i];//PlanetProductionItem
			ppi.EstimateTurnsToComplete(Astriarch.PlanetView.planetMain.ResourcesPerTurn.GetProductionAmountPerTurn() + workingProdRemainder);
			workingProdRemainder = 0;
			var queueItem = new Astriarch.PlanetView.BuildQueueListBoxItem(ppi);
			Astriarch.PlanetView.BuildQueueListBox.addItem(queueItem);
		}
	},
	
	showOrHideDemolishImprovementButtons: function() {
		if (Astriarch.PlanetView.farmCount - Astriarch.PlanetView.countDemolishImprovementsInQueueByType(Astriarch.Planet.PlanetImprovementType.Farm) > 0) {
			$('#ButtonDemolishFarm').css({"visibility":"visible"});
		}
		else
			$('#ButtonDemolishFarm').css({"visibility":"hidden"});

		if (Astriarch.PlanetView.mineCount - Astriarch.PlanetView.countDemolishImprovementsInQueueByType(Astriarch.Planet.PlanetImprovementType.Mine) > 0) {
			$('#ButtonDemolishMine').css({"visibility":"visible"});
		}
		else
			$('#ButtonDemolishMine').css({"visibility":"hidden"});

		if (Astriarch.PlanetView.factoryCount - Astriarch.PlanetView.countDemolishImprovementsInQueueByType(Astriarch.Planet.PlanetImprovementType.Factory) > 0) {
			$('#ButtonDemolishFactory').css({"visibility":"visible"});
		}
		else
			$('#ButtonDemolishFactory').css({"visibility":"hidden"});

		if (Astriarch.PlanetView.colonyCount - Astriarch.PlanetView.countDemolishImprovementsInQueueByType(Astriarch.Planet.PlanetImprovementType.Colony) > 0) {
			$('#ButtonDemolishColony').css({"visibility":"visible"});
		}
		else
			$('#ButtonDemolishColony').css({"visibility":"hidden"});
	},
	
	refreshCurrentWorkingResourcesTextBoxes: function() {
		$('#TextBlockCurrentGoldAmount').text(Math.floor(Astriarch.PlanetView.workingResources.GoldAmount));
        $('#TextBlockCurrentOreAmount').text(Math.floor(Astriarch.PlanetView.workingResources.OreAmount));
        $('#TextBlockCurrentIridiumAmount').text(Math.floor(Astriarch.PlanetView.workingResources.IridiumAmount));
	},
	
	countDemolishImprovementsInQueueByType: function(/*PlanetImprovementType*/ pit) {
		var count = 0;

		for (var i in Astriarch.PlanetView.workingBuildQueue) {
			var ppi = Astriarch.PlanetView.workingBuildQueue[i];
			if (ppi instanceof Astriarch.Planet.PlanetImprovementToDestroy && ppi.TypeToDestroy == pit) {
				count++;
			}
		}

		return count;
	},
	
	addImprovementToDestroy: function(/*PlanetImprovementType*/ pit) {
		var pi = new Astriarch.Planet.PlanetImprovementToDestroy(pit);
		Astriarch.PlanetView.workingBuildQueue.push(pi);

		Astriarch.server_comm.sendMessage({type:Astriarch.Shared.MESSAGE_TYPE.UPDATE_PLANET_BUILD_QUEUE, payload:{actionType:Astriarch.Shared.PLANET_BUILD_QUEUE_ACTION_TYPE.DEMOLISH_IMPROVEMENT, planetId:Astriarch.PlanetView.planetMain.Id, data:pit}});

		Astriarch.PlanetView.showOrHideDemolishImprovementButtons();
		Astriarch.PlanetView.refreshBuildQueueListBox();
	},
	
	updateSliderValues: function(/*SliderValueClicked*/ clicked, clickedValue) {//apparently for the one changing you have to get it from the args
		var self = Astriarch.PlanetView;
		if(clickedValue < 0 || clickedValue > self.population) {
			return;
		}
		//TODO: is dependent sliders the way to go? for now hopefully it's easy
		//determine if we're adding or removing...
		//if clicked farmers switch off between giving to/taking from miners and workers
		//if clicked miners switch off between giving to/taking from farmers and workers
		//if clicked workers switch off between giving to/taking from farmers and miners
		var diff = 0;
		self.updatingGUI = true;

		if(self.lastClicked != clicked)
			self.lastChanged = Astriarch.PlanetView.SliderValueClicked.None;

		var roundedFarmerSliderValue = $('#SliderFarmers').slider("value");
		var roundedMinerSliderValue = $('#SliderMiners').slider("value");
		var roundedWorkerSliderValue = $('#SliderWorkers').slider("value");

		//figure out who we can give to or take from
		//if either others are candidates, choose the one we didn't last change (alternate)

		//first figure differences
		switch (clicked) {
			case Astriarch.PlanetView.SliderValueClicked.Farmers:
				roundedFarmerSliderValue = clickedValue;
				diff = roundedFarmerSliderValue - self.farmers;
				break;
			case Astriarch.PlanetView.SliderValueClicked.Miners:
				roundedMinerSliderValue = clickedValue;
				diff = roundedMinerSliderValue - self.miners;
				break;
			case Astriarch.PlanetView.SliderValueClicked.Workers:
				roundedWorkerSliderValue = clickedValue;
				diff = roundedWorkerSliderValue - self.workers;
				break;
		}

		var canChangeFarmers = false;
		var canChangeMiners = false;
		var canChangeWorkers = false;
		//next figure can change candidates
		if (diff > 0) {
			//we're looking for a slider to take from
			canChangeFarmers = (self.farmers != 0);
			canChangeMiners = (self.miners != 0);
			canChangeWorkers = (self.workers != 0);
		} else if (diff < 0) {
			//we're looking for a slider to give to
			canChangeFarmers = (self.farmers != self.population);
			canChangeMiners = (self.miners != self.population);
			canChangeWorkers = (self.workers != self.population);
		} else {
			//we're not changing anything
			self.updatingGUI = false;
			//console.log("NOT Changing the sliders");
			return;
		}

		while(diff != 0) {
			var diffToChange = 1;
			if(diff < 0)
				diffToChange = -1;
				
			var sliderToChange = Astriarch.PlanetView.SliderValueClicked.None;
			//next pick a slider to change
			switch (clicked) {
				case Astriarch.PlanetView.SliderValueClicked.Farmers:
					if(canChangeMiners && !canChangeWorkers) {
						sliderToChange = Astriarch.PlanetView.SliderValueClicked.Miners;
					} else if(!canChangeMiners && canChangeWorkers) {
						sliderToChange = Astriarch.PlanetView.SliderValueClicked.Workers;
					} else {
						//if both values are the same, check last change to alternate candidates
						//otherwize first check diff to see if we want the larger or the smaller
						if (roundedMinerSliderValue == roundedWorkerSliderValue) {
							if (self.lastChanged != Astriarch.PlanetView.SliderValueClicked.Miners)
								sliderToChange = Astriarch.PlanetView.SliderValueClicked.Miners;
							else
								sliderToChange = Astriarch.PlanetView.SliderValueClicked.Workers;
						} else if (diff > 0) {
							//we're removing so choose the slider with a larger value
							if (roundedMinerSliderValue > roundedWorkerSliderValue)
								sliderToChange = Astriarch.PlanetView.SliderValueClicked.Miners;
							else
								sliderToChange = Astriarch.PlanetView.SliderValueClicked.Workers;
						} else {
							//choose the slider with a smaller value
							if (roundedMinerSliderValue < roundedWorkerSliderValue)
								sliderToChange = Astriarch.PlanetView.SliderValueClicked.Miners;
							else
								sliderToChange = Astriarch.PlanetView.SliderValueClicked.Workers;
						}
					}

					break;
				case Astriarch.PlanetView.SliderValueClicked.Miners:
					if (canChangeFarmers && !canChangeWorkers) {
						sliderToChange = Astriarch.PlanetView.SliderValueClicked.Farmers;
					} else if (!canChangeFarmers && canChangeWorkers) {
						sliderToChange = Astriarch.PlanetView.SliderValueClicked.Workers;
					}
					else {
						//if both values are the same, check last change to alternate candidates
						//otherwize first check diff to see if we want the larger or the smaller
						if (roundedFarmerSliderValue == roundedWorkerSliderValue) {
							if (self.lastChanged != Astriarch.PlanetView.SliderValueClicked.Farmers)
								sliderToChange = Astriarch.PlanetView.SliderValueClicked.Farmers;
							else
								sliderToChange = Astriarch.PlanetView.SliderValueClicked.Workers;
						}
						else if (diff > 0) {
							//we're removing so choose the slider with a larger value
							if (roundedFarmerSliderValue > roundedWorkerSliderValue)
								sliderToChange = Astriarch.PlanetView.SliderValueClicked.Farmers;
							else
								sliderToChange = Astriarch.PlanetView.SliderValueClicked.Workers;
						} else {
							//choose the slider with a smaller value
							if (roundedFarmerSliderValue < roundedWorkerSliderValue)
								sliderToChange = Astriarch.PlanetView.SliderValueClicked.Farmers;
							else
								sliderToChange = Astriarch.PlanetView.SliderValueClicked.Workers;
						}
					}
					break;
				case Astriarch.PlanetView.SliderValueClicked.Workers:
					if (canChangeFarmers && !canChangeMiners) {
						sliderToChange = Astriarch.PlanetView.SliderValueClicked.Farmers;
					} else if (!canChangeFarmers && canChangeMiners) {
						sliderToChange = Astriarch.PlanetView.SliderValueClicked.Miners;
					} else {
						//if both values are the same, check last change to alternate candidates
						//otherwize first check diff to see if we want the larger or the smaller
						if (roundedFarmerSliderValue == roundedMinerSliderValue) {
							if (self.lastChanged != Astriarch.PlanetView.SliderValueClicked.Farmers)
								sliderToChange = Astriarch.PlanetView.SliderValueClicked.Farmers;
							else
								sliderToChange = Astriarch.PlanetView.SliderValueClicked.Miners;
						} else if (diff > 0) {
							//we're removing so choose the slider with a larger value
							if (roundedFarmerSliderValue > roundedMinerSliderValue)
								sliderToChange = Astriarch.PlanetView.SliderValueClicked.Farmers;
							else
								sliderToChange = Astriarch.PlanetView.SliderValueClicked.Miners;
						} else {
							//choose the slider with a smaller value
							if (roundedFarmerSliderValue < roundedMinerSliderValue)
								sliderToChange = Astriarch.PlanetView.SliderValueClicked.Farmers;
							else
								sliderToChange = Astriarch.PlanetView.SliderValueClicked.Miners;
						}
					}
					break;
			}
			
			//finally, change the picked slider
			switch (sliderToChange) {
				case Astriarch.PlanetView.SliderValueClicked.Farmers:
					roundedFarmerSliderValue -= diffToChange;
					$('#SliderFarmers').slider("value", roundedFarmerSliderValue);
					self.lastChanged = Astriarch.PlanetView.SliderValueClicked.Farmers;
					break;
				case Astriarch.PlanetView.SliderValueClicked.Miners:
					roundedMinerSliderValue -= diffToChange;
					$('#SliderMiners').slider("value", roundedMinerSliderValue);
					self.lastChanged = Astriarch.PlanetView.SliderValueClicked.Miners;
					break;
				case Astriarch.PlanetView.SliderValueClicked.Workers:
					roundedWorkerSliderValue -= diffToChange;
					$('#SliderWorkers').slider("value", roundedWorkerSliderValue);
					self.lastChanged = Astriarch.PlanetView.SliderValueClicked.Workers;
					break;
				default:
					console.error("Unable to determine slider to change in PlanetViewControl!");
					break;
			}
			
			self.farmers = roundedFarmerSliderValue;
			self.miners = roundedMinerSliderValue;
			self.workers = roundedWorkerSliderValue;
			
			if(diff > 0)
				diff--;
			else if(diff < 0)
				diff++;
		}
		
		self.updatingGUI = false;

		self.lastClicked = clicked;

		$('#TextBoxFarmers').text(self.farmers);
		$('#TextBoxMiners').text(self.miners);
		$('#TextBoxWorkers').text(self.workers);

		if(window.tour.enabled && window.tour.step == 20 && self.workers == 3){
			window.tour.jqElm.joyride('nextTip');
		} else if(window.tour.enabled && window.tour.step == 29 && self.miners == 2){
			window.tour.jqElm.joyride('nextTip');
		} else if(window.tour.enabled && window.tour.step == 33 && self.miners == 3){
			window.tour.jqElm.joyride('nextTip');
		} else if(window.tour.enabled && window.tour.step == 45 && self.workers == 3){
			window.tour.jqElm.joyride('nextTip');
		}

		self.SendUpdatePlanetOptionsMessage();

		self.recalculateBuildQueueListItemsTurnsToCompleteEstimates();
		self.refreshResourcesPerTurnTextBoxes();
	},

	SendUpdatePlanetOptionsMessage: function() {
		Astriarch.PlanetView.planetMain.BuildLastStarShip = true;
		if(!$('#BuildLastShipCheckBox').prop('checked')) {
			Astriarch.PlanetView.planetMain.BuildLastStarShip = false;
		}

		var payload = {
			"planetId": Astriarch.PlanetView.planetMain.Id,
			"farmers":Astriarch.PlanetView.farmers,
			"miners":Astriarch.PlanetView.miners,
			"workers":Astriarch.PlanetView.workers,
			"BuildLastStarShip":Astriarch.PlanetView.planetMain.BuildLastStarShip
		};
		Astriarch.server_comm.sendMessage({type:Astriarch.Shared.MESSAGE_TYPE.UPDATE_PLANET_OPTIONS, payload:payload});
	},
	
	SliderFarmersValueChanged: function(event, ui) {
		if(!Astriarch.PlanetView.updatingGUI)
			Astriarch.PlanetView.updateSliderValues(Astriarch.PlanetView.SliderValueClicked.Farmers, ui.value);
	},

	SliderMinersValueChanged: function(event, ui) {
		if (!Astriarch.PlanetView.updatingGUI)
			Astriarch.PlanetView.updateSliderValues(Astriarch.PlanetView.SliderValueClicked.Miners, ui.value);
	},

	SliderWorkersValueChanged: function(event, ui) {
		if (!Astriarch.PlanetView.updatingGUI)
			Astriarch.PlanetView.updateSliderValues(Astriarch.PlanetView.SliderValueClicked.Workers, ui.value);
	},

	BuildLastShipCheckBoxValueChanged: function(event, ui) {
		if (!Astriarch.PlanetView.updatingGUI)
			Astriarch.PlanetView.SendUpdatePlanetOptionsMessage();
	},
	
	moveSelectedItemInQueue: function(/*bool*/ moveUp){
		var index = Astriarch.PlanetView.BuildQueueListBox.SelectedIndex;

		if (index == 0 && moveUp)
			return;
		else if (index == Astriarch.PlanetView.BuildQueueListBox.items.length - 1 && !moveUp)
			return;

		var bqlbi = Astriarch.PlanetView.BuildQueueListBox.items[index];//BuildQueueListBoxItem
		Astriarch.PlanetView.BuildQueueListBox.items.splice(index, 1);
		Astriarch.PlanetView.workingBuildQueue.splice(index, 1);
		if(moveUp)
		{
			Astriarch.PlanetView.BuildQueueListBox.items.splice(index-1, 0, bqlbi);
			Astriarch.PlanetView.workingBuildQueue.splice(index-1, 0, bqlbi.ProductionItem);
			Astriarch.PlanetView.BuildQueueListBox.setSelectedIndex(index - 1);

			Astriarch.server_comm.sendMessage({type:Astriarch.Shared.MESSAGE_TYPE.UPDATE_PLANET_BUILD_QUEUE, payload:{actionType:Astriarch.Shared.PLANET_BUILD_QUEUE_ACTION_TYPE.MOVEUP, planetId:Astriarch.PlanetView.planetMain.Id, data:index}});
		}
		else
		{
			Astriarch.PlanetView.BuildQueueListBox.items.splice(index+1, 0, bqlbi);
			Astriarch.PlanetView.workingBuildQueue.splice(index+1, 0, bqlbi.ProductionItem);
			Astriarch.PlanetView.BuildQueueListBox.setSelectedIndex(index + 1);

			Astriarch.server_comm.sendMessage({type:Astriarch.Shared.MESSAGE_TYPE.UPDATE_PLANET_BUILD_QUEUE, payload:{actionType:Astriarch.Shared.PLANET_BUILD_QUEUE_ACTION_TYPE.MOVEDOWN, planetId:Astriarch.PlanetView.planetMain.Id, data:index}});
		}

		Astriarch.PlanetView.BuildQueueSelectionChanged();//manually trigger because we changed selected item
		Astriarch.PlanetView.BuildQueueListBox.refresh();
	},

	removeSelectedItemFromQueue: function()	{
		var o = Astriarch.PlanetView.BuildQueueListBox.SelectedItem;
		var index = Astriarch.PlanetView.BuildQueueListBox.SelectedIndex;
		if (o != null && index != null)
		{
			//o is BuildQueueListBoxItem
			var bqlbi = o;

			var refundObject = bqlbi.ProductionItem.GetRefundAmount();

			Astriarch.PlanetView.workingResources.GoldAmount += refundObject.Gold;
			Astriarch.PlanetView.workingResources.OreAmount += refundObject.Ore;
			Astriarch.PlanetView.workingResources.IridiumAmount += refundObject.Iridium;

			//Astriarch.PlanetView.workingBuildQueue.Remove(bqlbi.ProductionItem);
			Astriarch.PlanetView.workingBuildQueue.splice(index, 1);
			Astriarch.PlanetView.BuildQueueListBox.removeAt(index);

			Astriarch.PlanetView.refreshItemsAvailableCardList();
			
			Astriarch.PlanetView.refreshCurrentWorkingResourcesTextBoxes();
			Astriarch.PlanetView.showOrHideDemolishImprovementButtons();
			
			Astriarch.PlanetView.BuildQueueSelectionChanged();//manually trigger because we changed selected item

			Astriarch.server_comm.sendMessage({type:Astriarch.Shared.MESSAGE_TYPE.UPDATE_PLANET_BUILD_QUEUE, payload:{actionType:Astriarch.Shared.PLANET_BUILD_QUEUE_ACTION_TYPE.REMOVE, planetId:Astriarch.PlanetView.planetMain.Id, data:index}});
		}
	},

	addSelectedItemToQueue: function() {
		var selectedItems = Astriarch.PlanetView.ItemsAvailableCardList.getSelectedItems();
		if (selectedItems && selectedItems.length)
		{
			var o = selectedItems[0];
			if (o instanceof Astriarch.PlanetView.AvailableImprovementCardListItem)
			{
				var lbiImprovement = o;//AvailableImprovementCardListItem
				if (lbiImprovement.CanBuild)
				{
					//check to see if we have enough resouces 
					if (Astriarch.PlanetView.workingResources.GoldAmount >= lbiImprovement.AvailablePlanetImprovement.GoldCost &&
						Astriarch.PlanetView.workingResources.IridiumAmount >= lbiImprovement.AvailablePlanetImprovement.IridiumCost &&
						Astriarch.PlanetView.workingResources.OreAmount >= lbiImprovement.AvailablePlanetImprovement.OreCost)
					{
						Astriarch.PlanetView.workingResources.GoldAmount -= lbiImprovement.AvailablePlanetImprovement.GoldCost;
						Astriarch.PlanetView.workingResources.IridiumAmount -= lbiImprovement.AvailablePlanetImprovement.IridiumCost;
						Astriarch.PlanetView.workingResources.OreAmount -= lbiImprovement.AvailablePlanetImprovement.OreCost;
						var pi = new Astriarch.Planet.PlanetImprovement(lbiImprovement.AvailablePlanetImprovement.Type);
						Astriarch.PlanetView.workingBuildQueue.push(pi);

						if(window.tour.enabled) {
							if (window.tour.step == 19 && Astriarch.PlanetView.workingBuildQueue.length == 3 &&
								Astriarch.PlanetView.workingBuildQueue[0].Type == Astriarch.Planet.PlanetImprovementType.Farm &&
								Astriarch.PlanetView.workingBuildQueue[1].Type == Astriarch.Planet.PlanetImprovementType.Farm &&
								Astriarch.PlanetView.workingBuildQueue[2].Type == Astriarch.Planet.PlanetImprovementType.Farm) {
								window.tour.jqElm.joyride('nextTip');
							} else if (window.tour.step == 28 && Astriarch.PlanetView.workingBuildQueue.length == 2 &&
								Astriarch.PlanetView.workingBuildQueue[0].Type == Astriarch.Planet.PlanetImprovementType.Mine &&
								Astriarch.PlanetView.workingBuildQueue[1].Type == Astriarch.Planet.PlanetImprovementType.Mine) {
								window.tour.jqElm.joyride('nextTip');
							} else if (window.tour.step == 44 &&
								(Astriarch.PlanetView.workingBuildQueue.length == 2 && Astriarch.PlanetView.workingBuildQueue[1].Type == Astriarch.Planet.PlanetImprovementType.Factory) ||
								(Astriarch.PlanetView.workingBuildQueue.length == 1 && Astriarch.PlanetView.workingBuildQueue[0].Type == Astriarch.Planet.PlanetImprovementType.Factory) ) {
								window.tour.jqElm.joyride('nextTip');
							}
						}

						Astriarch.server_comm.sendMessage({type:Astriarch.Shared.MESSAGE_TYPE.UPDATE_PLANET_BUILD_QUEUE, payload:{actionType:Astriarch.Shared.PLANET_BUILD_QUEUE_ACTION_TYPE.ADD_IMPROVEMENT, planetId:Astriarch.PlanetView.planetMain.Id, data:lbiImprovement.AvailablePlanetImprovement.Type}});
					}
					else
					{
						var a = new Astriarch.Alert("Insufficient resources", "Insufficient resources: (Gold/Ore/Iridium)\r\nRequires  (" + lbiImprovement.AvailablePlanetImprovement.GoldCost + " / " + lbiImprovement.AvailablePlanetImprovement.OreCost + " / " + lbiImprovement.AvailablePlanetImprovement.IridiumCost + ")\r\n" +
										"You have (" + Astriarch.PlanetView.workingResources.GoldAmount + " / " + Astriarch.PlanetView.workingResources.OreAmount + " / " + Astriarch.PlanetView.workingResources.IridiumAmount + ")", "Insufficient resources");
					}
				}
				//else warn them?
			}
			else if (o instanceof Astriarch.PlanetView.AvailableStarShipCardListItem)
			{
				var lbiStarship = o;//AvailableStarShipCardListItem
				if (lbiStarship.CanBuild)
				{
					//check to see if we have enough resouces 
					if (Astriarch.PlanetView.workingResources.GoldAmount >= lbiStarship.AvailableStarShip.GoldCost &&
						Astriarch.PlanetView.workingResources.IridiumAmount >= lbiStarship.AvailableStarShip.IridiumCost &&
						Astriarch.PlanetView.workingResources.OreAmount >= lbiStarship.AvailableStarShip.OreCost)
					{
						Astriarch.PlanetView.workingResources.GoldAmount -= lbiStarship.AvailableStarShip.GoldCost;
						Astriarch.PlanetView.workingResources.IridiumAmount -= lbiStarship.AvailableStarShip.IridiumCost;
						Astriarch.PlanetView.workingResources.OreAmount -= lbiStarship.AvailableStarShip.OreCost;
						var ssip = new Astriarch.Planet.StarShipInProduction(lbiStarship.AvailableStarShip.Type);
						Astriarch.PlanetView.workingBuildQueue.push(ssip);

						if(window.tour.enabled) {
							if (Astriarch.PlanetView.workingBuildQueue.length == 1 &&
								Astriarch.PlanetView.workingBuildQueue[0].Type == Astriarch.Fleet.StarShipType.Scout) {
								window.tour.jqElm.joyride('resume');
							}
						}

						Astriarch.server_comm.sendMessage({type:Astriarch.Shared.MESSAGE_TYPE.UPDATE_PLANET_BUILD_QUEUE, payload:{actionType:Astriarch.Shared.PLANET_BUILD_QUEUE_ACTION_TYPE.ADD_STARSHIP, planetId:Astriarch.PlanetView.planetMain.Id, data:lbiStarship.AvailableStarShip.Type}});
					}
					else
					{
						//TODO: make themed properly by using custom Dialog Window
						var a = new Astriarch.Alert("Insufficient resources", "Insufficient resources: (Gold/Ore/Iridium)\r\nRequires  (" + lbiStarship.AvailableStarShip.GoldCost + " / " + lbiStarship.AvailableStarShip.OreCost + " / " + lbiStarship.AvailableStarShip.IridiumCost + ")\r\n" +
										"You have (" + Astriarch.PlanetView.workingResources.GoldAmount + " / " + Astriarch.PlanetView.workingResources.OreAmount + " / " + Astriarch.PlanetView.workingResources.IridiumAmount + ")", "Insufficient resources");
					}
				}
				//else warn them?
			}
			Astriarch.PlanetView.refreshItemsAvailableCardList();
			
			Astriarch.PlanetView.refreshBuildQueueListBox();
			Astriarch.PlanetView.refreshCurrentWorkingResourcesTextBoxes();
		}
	},
	
	OKClose: function()	{
		if(window.tour.enabled && (window.tour.step == 21 || window.tour.step == 30 || window.tour.step == 34 || window.tour.step == 46)){
			window.tour.jqElm.joyride('nextTip');
		}
		//TODO: throw exception if farmers miners and worker counts are greater than our planet pop
		var self = Astriarch.PlanetView;
		self.planetMain.UpdatePopulationWorkerTypes(self.farmers, self.miners, self.workers);
		self.planetMain.ResourcesPerTurn.UpdateResourcesPerTurnBasedOnPlanetStats();

		//copy our working items to our original planet pointer
		self.planetMain.BuildQueue = [];
		for (var i in self.workingBuildQueue)
		{
			self.planetMain.BuildQueue.push(self.workingBuildQueue[i]);
		}

		//now spend our resources and in case we issued a refund, set this planets resources
		var originalResources = new Astriarch.Model.WorkingPlayerResources(self.planetMain.Owner);
		var goldCost = originalResources.GoldAmount - self.workingResources.GoldAmount;
		var oreCost = originalResources.OreAmount - self.workingResources.OreAmount;
		var iridiumCost = originalResources.IridiumAmount - self.workingResources.IridiumAmount;
		self.planetMain.SpendResources(Astriarch.ClientGameModel, goldCost, 0, oreCost, iridiumCost, self.planetMain.Owner);
		//set the workingResources to the planets resources
		self.planetMain.Owner.Resources.GoldAmount = self.workingResources.GoldAmount;
		self.planetMain.Owner.Resources.OreAmount = self.workingResources.OreAmount;
		self.planetMain.Owner.Resources.IridiumAmount = self.workingResources.IridiumAmount;

		Astriarch.View.PlanetViewDialogWindowClosed();
	},

	Close: function() {
		Astriarch.PlanetView.dialog.dlg.dialog('close');
	}
};

/**
 * BuildQueueListBoxItem is a list box item for the build queue list
 * @constructor
 */
Astriarch.PlanetView.BuildQueueListBoxItem = JSListBox.Item.extend({

	ProductionItem: null,//PlanetProductionItem
	
	/**
	 * initializes this BuildQueueListBoxItem
	 * @this {Astriarch.PlanetView.BuildQueueListBoxItem}
	 */
	init: function(/*PlanetProductionItem*/ productionItem) {
		this.ProductionItem = productionItem;
		//ToolTipService.SetToolTip(this, GameTools.PlanetImprovementTypeToHelpText(type));
	},

	/**
	 * renders this BuildQueueListBoxItem
	 * @this {Astriarch.PlanetView.BuildQueueListBoxItem}
	 * @return {string}
	 */
	render: function() {
		var name = this.ProductionItem.ToString();

		var turnsToCompleteString = "";
		//only show turns to complete if we've started building
		//if (this.ProductionItem.ProductionCostComplete > 0)
			turnsToCompleteString = " (" + (this.ProductionItem.TurnsToComplete) + ")";
		name += " " + this.ProductionItem.ProductionCostComplete + "/" + this.ProductionItem.BaseProductionCost + turnsToCompleteString;
		return '<a href="#">' + name + '</a>';
	},
	
	/**
	 * fires the selection changed event
	 * @this {Astriarch.PlanetView.BuildQueueListBoxItem}
	 */
	onClick: function() {
		Astriarch.PlanetView.BuildQueueSelectionChanged();
	}
	
});

/**
 * AvailableImprovementCardListItem is a list box item for the available items to build list
 * @constructor
 */
Astriarch.PlanetView.AvailableImprovementCardListItem = JSCardList.Item.extend({

	Tooltip: "",
	AvailablePlanetImprovement: null,//PlanetImprovement
	CanBuild: true,
	CanBuildBasedOnResources: true,
	Foreground: "white",
	Hotkey: null,
	
	/**
	 * initializes this AvailableImprovementCardListItem
	 * @this {Astriarch.PlanetView.AvailableImprovementCardListItem}
	 */
	init: function(/*PlanetImprovementType*/ type, hotkey) {
		this.Tooltip = Astriarch.GameTools.PlanetImprovementTypeToHelpText(type);
		this.AvailablePlanetImprovement = new Astriarch.Planet.PlanetImprovement(type);
		this.Hotkey = hotkey;
	},

	/**
	 * renders this AvailableImprovementCardListItem
	 * @this {Astriarch.PlanetView.AvailableImprovementCardListItem}
	 * @return {string}
	 */
	render: function() {
		this.enabled = false;
		if(!this.CanBuild)
			this.Foreground = "darkgray";
		else if(!this.CanBuildBasedOnResources)
			this.Foreground = "yellow";
		else if(this.CanBuild)
		{
			this.Foreground = "white";
			this.enabled = true;
		}

		var imageClassName = Astriarch.GameTools.PlanetImprovementTypeToClassName(this.AvailablePlanetImprovement.Type);
		var text = Astriarch.GameTools.PlanetImprovementTypeToFriendlyName(this.AvailablePlanetImprovement.Type);

		var element = '<span class="pvcItem">' +
			'<span class="pvcItemName"' + (this.Hotkey ? ' hotkey="' + this.Hotkey + '"' : '') + '>' + text + '</span>' +
			'<div class="pvcItemImg '+imageClassName+'" />' +
			'<span class="pvcItemGoldCost colorGold">' + this.AvailablePlanetImprovement.GoldCost + '</span>' +
			'<span class="pvcItemOreCost colorOre">' + this.AvailablePlanetImprovement.OreCost + '</span>' +
			'<span class="pvcItemIridiumCost colorIridium">' + this.AvailablePlanetImprovement.IridiumCost + '</span>' +
			'</span>';

		return '<a class="pvcItemAnchor" ' + (this.enabled ? 'href="#" ' : '') + 'title="' + this.Tooltip + '" style="color:' + this.Foreground + '">' + element + '</a>';
	},
	
	/**
	 * fires the selection changed event
	 * @this {Astriarch.PlanetView.AvailableImprovementCardListItem}
	 */
	onClick: function() {
		Astriarch.PlanetView.ItemsAvailableClicked();
	},
	
	/**
	 * fires the double click event
	 * @this {Astriarch.PlanetView.AvailableImprovementCardListItem}
	 */
	onDblClick: function() {

	}
});

/**
 * AvailableStarShipCardListItem is a list box item for the available items to build list
 * @constructor
 */
Astriarch.PlanetView.AvailableStarShipCardListItem = JSCardList.Item.extend({

	Tooltip: "",
	AvailableStarShip: null,//StarShipInProduction
	CanBuild: true,
	CanBuildBasedOnResources: true,
	Foreground: "white",
	Hotkey: null,
	
	/**
	 * initializes this AvailableStarShipCardListItem
	 * @this {Astriarch.PlanetView.AvailableStarShipCardListItem}
	 */
	init: function(/*StarShipType*/ type, hotkey) {
		this.Tooltip = Astriarch.GameTools.StarShipTypeToHelpText(type);
		this.AvailableStarShip = new Astriarch.Planet.StarShipInProduction(type);
		this.Hotkey = hotkey;
	},

	/**
	 * renders this AvailableStarShipCardListItem
	 * @this {Astriarch.PlanetView.AvailableStarShipCardListItem}
	 * @return {string}
	 */
	render: function() {
		this.enabled = false;
		if(!this.CanBuild)
			this.Foreground = "darkgray";
		else if(!this.CanBuildBasedOnResources)
			this.Foreground = "yellow";
		else if(this.CanBuild)
		{
			this.Foreground = "white";
			this.enabled = true;
		}

		var imageClassName = Astriarch.GameTools.StarShipTypeToClassName(this.AvailableStarShip.Type);
		var text = Astriarch.GameTools.StarShipTypeToFriendlyName(this.AvailableStarShip.Type);

		var element = '<span class="pvcItem">' +
			'<span class="pvcItemName"' + (this.Hotkey ? ' hotkey="' + this.Hotkey + '"' : '') + '>' + text + '</span>' +
			'<div class="pvcItemImg '+imageClassName+'" />' +
			'<span class="pvcItemGoldCost colorGold">' + this.AvailableStarShip.GoldCost + '</span>' +
			'<span class="pvcItemOreCost colorOre">' + this.AvailableStarShip.OreCost + '</span>' +
			'<span class="pvcItemIridiumCost colorIridium">' + this.AvailableStarShip.IridiumCost + '</span>' +
			'</span>';

		return '<a class="pvcItemAnchor" ' + (this.enabled ? 'href="#" ' : '') + 'title="' + this.Tooltip + '" style="color:' + this.Foreground + '">' + element + '</a>';
	},
	
	/**
	 * fires the selection changed event
	 * @this {Astriarch.PlanetView.AvailableStarShipCardListItem}
	 */
	onClick: function() {
		Astriarch.PlanetView.ItemsAvailableClicked();
	},
	
	/**
	 * fires the double click event
	 * @this {Astriarch.PlanetView.AvailableStarShipCardListItem}
	 */
	onDblClick: function() {

	}
});

Astriarch.PlanetView.SliderValueClicked = {
	None: 0,
	Farmers: 1,
	Miners: 2,
	Workers: 3
};
