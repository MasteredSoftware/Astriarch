Astriarch.SendShipsControl = {
	dialog:null,//instance of Astriarch.Dialog
	
	pSource:null,//Planet
	pDest:null,//ClientPlanet
	
	distance:null,
	
	CreatedFleet:null,//Fleet

	StarShipsAvailableCardList:null,
	
	init: function() {
		Astriarch.SendShipsControl.StarShipsAvailableCardList = new JSCardList({'containerSelector':'StarShipsAvailableCardList', 'multiselect':true});
		
		$( "#ButtonSendNoShips, #ButtonSendAllShips").button();
		
		$( "#ButtonSendNoShips" ).click(
			function() {
				Astriarch.SendShipsControl.ButtonSendNoShipsClick();
			}
		);
		
		$( "#ButtonSendAllShips" ).click(
			function() {
				Astriarch.SendShipsControl.ButtonSendAllShipsClick();
			}
		);

		var checkBoxTooltip = "When a waypoint is set on a planet, newly built ships will automatically be sent to the destination planet.";
		$('#SetWaypointCheckBoxLabel').attr('title', checkBoxTooltip);
		$('#SetWaypointCheckBox').prop('checked', false);
		
		Astriarch.SendShipsControl.dialog = new Astriarch.Dialog('#sendShipsDialog', 'Send Ships', 380, 330, Astriarch.SendShipsControl.OKClose, Astriarch.SendShipsControl.CancelClose);
	},
	
	show: function(/*Planet*/ pSource, /*ClientPlanet*/ pDest, /*int*/ distance) {

		if(window.tour.enabled && window.tour.step == 56) {
			window.tour.jqElm.joyride('resume');
		}

		Astriarch.SendShipsControl.CreatedFleet = null;
		Astriarch.SendShipsControl.pSource = pSource;
		Astriarch.SendShipsControl.pDest = pDest;
		Astriarch.SendShipsControl.distance = distance;
		
		$('#SendShipsDialogStatus').text(distance + " parsecs from " + pSource.Name + " to " + pDest.Name);

		var pf = pSource.PlanetaryFleet;//Fleet
		Astriarch.SendShipsControl.StarShipsAvailableCardList.clear();
		Astriarch.SendShipsControl.addAvailableStarShipCardListItems(pf.StarShips[Astriarch.Fleet.StarShipType.Battleship]);
		Astriarch.SendShipsControl.addAvailableStarShipCardListItems(pf.StarShips[Astriarch.Fleet.StarShipType.Cruiser]);
		Astriarch.SendShipsControl.addAvailableStarShipCardListItems(pf.StarShips[Astriarch.Fleet.StarShipType.Destroyer]);
		Astriarch.SendShipsControl.addAvailableStarShipCardListItems(pf.StarShips[Astriarch.Fleet.StarShipType.Scout]);

		var currentWaypointStatus = "Waypoint not set";
		if(pSource.WayPointPlanetId){
			var waypointClientPlanet = Astriarch.ClientGameModel.getClientPlanetById(pSource.WayPointPlanetId);
			if(waypointClientPlanet) {
				currentWaypointStatus = "Waypoint set to planet " + waypointClientPlanet.Name;
			}
		}
		$('#CurrentWaypointStatus').text(currentWaypointStatus);

		if(pSource.WayPointPlanetId == pDest.Id) {
			$('#SetWaypointCheckBox').prop('checked', true);
		} else {
			$('#SetWaypointCheckBox').prop('checked', false);
		}
		
		Astriarch.SendShipsControl.dialog.setTitle("Sending Ships from " + pSource.Name + " to " + pDest.Name);
		Astriarch.SendShipsControl.dialog.open();
	},

	addAvailableStarShipCardListItems: function(ships) {
		var items = [];
		for(var i = 0; i < ships.length; i++) {
			items.push(new Astriarch.SendShipsControl.AvailableStarShipCardListItem(ships[i]));
		}
		Astriarch.SendShipsControl.StarShipsAvailableCardList.addItems(items);
	},
	
	ButtonSendAllShipsClick: function() {
		if(window.tour.enabled && window.tour.step == 58) {
			window.tour.jqElm.joyride('nextTip');
		}

		Astriarch.SendShipsControl.StarShipsAvailableCardList.selectAll();
	},

	ButtonSendNoShipsClick: function() {
		Astriarch.SendShipsControl.StarShipsAvailableCardList.selectNone();
	},

	OKClose: function()	{
		//split the planetary fleet into a new fleet to send on it's way
		var self = Astriarch.SendShipsControl;
		
		var planetaryFleet = self.pSource.PlanetaryFleet;//Fleet

		var selectedItems = Astriarch.SendShipsControl.StarShipsAvailableCardList.getSelectedItems();

		if (selectedItems.length > 0)
		{
			var scoutIds = [], destroyerIds = [], cruiserIds = [], battleshipIds = [];

			for(var i = 0; i < selectedItems.length; i++) {
				var starShip = selectedItems[i].StarShip;
				switch(starShip.Type){
					case Astriarch.Fleet.StarShipType.Scout:
						scoutIds.push(starShip.id);
						break;
					case Astriarch.Fleet.StarShipType.Destroyer:
						destroyerIds.push(starShip.id);
						break;
					case Astriarch.Fleet.StarShipType.Cruiser:
						cruiserIds.push(starShip.id);
						break;
					case Astriarch.Fleet.StarShipType.Battleship:
						battleshipIds.push(starShip.id);
						break;
				}
			}

			self.CreatedFleet = planetaryFleet.SplitFleetWithShipIds(scoutIds, destroyerIds, cruiserIds, battleshipIds);

			self.CreatedFleet.CreateDrawnFleetAndSetDestination(Astriarch.ClientGameModel.GameGrid, self.pSource.BoundingHex, self.pDest.BoundingHex);

			self.pSource.OutgoingFleets.push(self.CreatedFleet);

			var payload = {"planetIdSource":self.pSource.Id, "planetIdDest":self.pDest.Id, "data":{"scouts":scoutIds, "destroyers":destroyerIds, "cruisers":cruiserIds, "battleships":battleshipIds}};

			//check to see if we need to set (or unset) our waypoint
			if($('#SetWaypointCheckBox').attr('checked')){
				Astriarch.SendShipsControl.pSource.WayPointPlanetId = Astriarch.SendShipsControl.pDest.Id;
				payload.data.WayPointPlanetId = Astriarch.SendShipsControl.pDest.Id;
			} else if(Astriarch.SendShipsControl.pSource.WayPointPlanetId == Astriarch.SendShipsControl.pDest.Id) {
				Astriarch.SendShipsControl.pSource.WayPointPlanetId = null;
				payload.data.WayPointPlanetId = null;
			}

			Astriarch.server_comm.sendMessage({type:Astriarch.Shared.MESSAGE_TYPE.SEND_SHIPS, payload:payload});
		}
		else
		{
			self.CreatedFleet = null;//just to be sure because we check this in MainPage.xaml.cs
		}

		Astriarch.View.SendShipsDialogWindowClosed(true);

		if(window.tour.enabled && window.tour.step == 59) {
			window.tour.jqElm.joyride('nextTip');
		}
	},

	CancelClose: function() {
		Astriarch.View.SendShipsDialogWindowClosed(false);
	},

	Close: function() {
		Astriarch.SendShipsControl.dialog.dlg.dialog('close');
	}
};


/**
 * AvailableStarShipCardListItem is a card list box item for the available starships on the planet
 * @constructor
 */
Astriarch.SendShipsControl.AvailableStarShipCardListItem = JSCardList.Item.extend({

	Tooltip: "",
	StarShip: null,//Astriarch.Fleet.StarShip
	Foreground: "white",

	/**
	 * initializes this AvailableStarShipListBoxItem
	 * @this {Astriarch.PlanetView.AvailableStarShipListBoxItem}
	 */
	init: function(/*Astriarch.Fleet.StarShip*/ ship) {
		this.Tooltip = Astriarch.GameTools.StarShipTypeToFriendlyName(ship.Type);
		this.StarShip = ship;
	},

	/**
	 * renders this AvailableStarShipListBoxItem
	 * @this {Astriarch.PlanetView.AvailableStarShipListBoxItem}
	 * @return {string}
	 */
	render: function() {
		var details = Astriarch.Fleet.Static.getStrengthDetailsForShips([this.StarShip]);//{strength: 0, maxStrength:0, health:0, percentHealth:0, color:null, percentHealthText: "", damageText: ""};

		this.Foreground = details.color;

		var levelObj = this.StarShip.Level();
		var percentLevel = this.StarShip.ExperienceAmount / levelObj.nextLevelExpRequirement;

		var imageClassName = Astriarch.GameTools.StarShipTypeToClassName(this.StarShip.Type);
		var element = '<span class="sscItem">' +
			'<span class="sscItemHealth">' + details.damageText + '</span>' +
			'<div class="sscItemImg '+imageClassName+'" />' +
			'<div class="sscHealthBarContainer"><div class="sscHealthBar" style="background:'+this.Foreground+';height:'+ details.percentHealthText + '" /></div>' +
			'<div class="sscExpBarContainer"><div class="sscExpBar" style="background:#369;height:'+ (percentLevel) * 100 + '%" /></div>' +
			'<span class="sscItemLevel">' + (levelObj.level + 1) + '</span>' +
			'</span>';

		return '<a class="sscItemAnchor" href="#" title="' + this.Tooltip + '" style="color:' + this.Foreground + '">' + element + '</a>';
	},

	/**
	 * fires the selection changed event
	 * @this {Astriarch.PlanetView.AvailableStarShipListBoxItem}
	 */
	onClick: function() {
		if(window.tour.enabled && window.tour.step == 58) {
			window.tour.jqElm.joyride('nextTip');
		}
	},

	/**
	 * fires the double click event
	 * @this {Astriarch.PlanetView.AvailableStarShipListBoxItem}
	 */
	onDblClick: function() {

	}
});