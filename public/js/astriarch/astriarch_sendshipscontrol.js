Astriarch.SendShipsControl = {
	dialog:null,//instance of Astriarch.Dialog
	
	pSource:null,//Planet
	pDest:null,//ClientPlanet
	
	distance:null,
	
	CreatedFleet:null,//Fleet
	
	init: function() {
		$('#SliderScouts').slider({value:0, step:1, min:0, max:10, change: Astriarch.SendShipsControl.SliderScoutsValueChanged});
		$('#SliderDestroyers').slider({value:0, step:1, min:0, max:10, change: Astriarch.SendShipsControl.SliderDestroyersValueChanged});
		$('#SliderCruisers').slider({value:0, step:1, min:0, max:10, change: Astriarch.SendShipsControl.SliderCruisersValueChanged});
		$('#SliderBattleships').slider({value:0, step:1, min:0, max:10, change: Astriarch.SendShipsControl.SliderBattleshipsValueChanged});
		
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

		$('#SliderScouts').slider("value", 0);
		$('#SliderScouts').slider("option", "max", pf.StarShips[Astriarch.Fleet.StarShipType.Scout].length);
		if ($('#SliderScouts').slider("option", "max") > 0) {
			$('#SliderScouts').slider("enable");
		} else {
			$('#SliderScouts').slider("disable");
		}

		$('#SliderDestroyers').slider("value", 0);
		$('#SliderDestroyers').slider("option", "max", pf.StarShips[Astriarch.Fleet.StarShipType.Destroyer].length);
		if ($('#SliderDestroyers').slider("option", "max") > 0) {
			$('#SliderDestroyers').slider("enable");
		} else {
			$('#SliderDestroyers').slider("disable");
		}

		$('#SliderCruisers').slider("value", 0);
		$('#SliderCruisers').slider("option", "max", pf.StarShips[Astriarch.Fleet.StarShipType.Cruiser].length);
		if ($('#SliderCruisers').slider("option", "max") > 0) {
			$('#SliderCruisers').slider("enable");
		} else {
			$('#SliderCruisers').slider("disable");
		}

		$('#SliderBattleships').slider("value", 0);
		$('#SliderBattleships').slider("option", "max", pf.StarShips[Astriarch.Fleet.StarShipType.Battleship].length);
		if ($('#SliderBattleships').slider("option", "max") > 0) {
			$('#SliderBattleships').slider("enable");
		} else {
			$('#SliderBattleships').slider("disable");
		}

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
	
	ButtonSendAllShipsClick: function() {
		$('#SliderScouts').slider("value", $('#SliderScouts').slider("option", "max"));
		$('#SliderDestroyers').slider("value", $('#SliderDestroyers').slider("option", "max"));
		$('#SliderCruisers').slider("value", $('#SliderCruisers').slider("option", "max"));
		$('#SliderBattleships').slider("value", $('#SliderBattleships').slider("option", "max"));
	},

	ButtonSendNoShipsClick: function() {
		$('#SliderScouts').slider("value", 0);
		$('#SliderDestroyers').slider("value", 0);
		$('#SliderCruisers').slider("value", 0);
		$('#SliderBattleships').slider("value", 0);
	},

	SliderBattleshipsValueChanged: function(event, ui) {
		$('#TextBoxBattleships').text(ui.value);
	},

	SliderCruisersValueChanged: function(event, ui) {
		$('#TextBoxCruisers').text(ui.value);		
	},

	SliderDestroyersValueChanged: function(event, ui) {
		$('#TextBoxDestroyers').text(ui.value);
	},

	SliderScoutsValueChanged: function(event, ui) {
		$('#TextBoxScouts').text(ui.value);

		if(window.tour.enabled && window.tour.step == 58 && ui.value > 0) {
			window.tour.jqElm.joyride('nextTip');
		}
	},

	OKClose: function()	{
		//split the planetary fleet into a new fleet to send on it's way
		var self = Astriarch.SendShipsControl;
		
		var planetaryFleet = self.pSource.PlanetaryFleet;//Fleet
		var scouts = parseInt($('#TextBoxScouts').text());
		var destroyers = parseInt($('#TextBoxDestroyers').text());
		var cruisers = parseInt($('#TextBoxCruisers').text());
		var battleships = parseInt($('#TextBoxBattleships').text());

		if (scouts != 0 || destroyers != 0 || cruisers != 0 || battleships != 0)
		{
			self.CreatedFleet = planetaryFleet.SplitFleet(scouts, destroyers, cruisers, battleships);

			self.CreatedFleet.CreateDrawnFleetAndSetDestination(Astriarch.ClientGameModel.GameGrid, self.pSource.BoundingHex, self.pDest.BoundingHex);

			self.pSource.OutgoingFleets.push(self.CreatedFleet);

			var payload = {"planetIdSource":self.pSource.Id, "planetIdDest":self.pDest.Id, "data":{"scouts":scouts, "destroyers":destroyers, "cruisers":cruisers, "battleships":battleships}};

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