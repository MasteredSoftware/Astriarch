Astriarch.PlanetaryConflictControl = {
  dialog: null, //instance of Astriarch.Dialog

  planetaryConflictMessage: null, //TurnEventMessage

  init: function() {
    Astriarch.PlanetaryConflictControl.dialog = new Astriarch.Dialog(
      "#planetaryConflictDialog",
      "Planetary Conflict",
      424,
      323,
      Astriarch.PlanetaryConflictControl.OKClose
    );
    $("#NeverShowPlanetaryConflictPopupsCheckbox").change(function() {
      if (window.tour.enabled && window.tour.step == 61 && this.checked) {
        window.tour.jqElm.joyride("nextTip");
      }
    });
  },

  show: function(/*TurnEventMessage*/ planetaryConflictMessage) {
    if (window.tour.enabled && window.tour.step == 59) {
      window.tour.jqElm.joyride("resume");
    }

    Astriarch.PlanetaryConflictControl.planetaryConflictMessage = planetaryConflictMessage;

    var summary = "";

    summary += planetaryConflictMessage.Message + "<br />";
    //show resources looted if a planet changed hands
    var resourcesLootedMessage = "";
    if (
      planetaryConflictMessage.Type == Astriarch.TurnEventMessage.TurnEventMessageType.PlanetCaptured ||
      planetaryConflictMessage.Type == Astriarch.TurnEventMessage.TurnEventMessageType.PlanetLost
    ) {
      resourcesLootedMessage = "No Resources Looted.";
      if (
        planetaryConflictMessage.Data.FoodAmountLooted != 0 ||
        planetaryConflictMessage.Data.GoldAmountLooted != 0 ||
        planetaryConflictMessage.Data.OreAmountLooted != 0 ||
        planetaryConflictMessage.Data.IridiumAmountLooted != 0 ||
        planetaryConflictMessage.Data.ResearchAmountLooted != 0
      ) {
        resourcesLootedMessage = "";
        resourcesLootedMessage +=
          planetaryConflictMessage.Data.FoodAmountLooted != 0
            ? Astriarch.DecimalToFixed(planetaryConflictMessage.Data.FoodAmountLooted, 2) + " Food"
            : "";
        resourcesLootedMessage +=
          planetaryConflictMessage.Data.GoldAmountLooted != 0
            ? (resourcesLootedMessage ? ", " : "") +
              Astriarch.DecimalToFixed(planetaryConflictMessage.Data.GoldAmountLooted, 2) +
              " Gold"
            : "";
        resourcesLootedMessage +=
          planetaryConflictMessage.Data.OreAmountLooted != 0
            ? (resourcesLootedMessage ? ", " : "") +
              Astriarch.DecimalToFixed(planetaryConflictMessage.Data.OreAmountLooted, 2) +
              " Ore"
            : "";
        resourcesLootedMessage +=
          planetaryConflictMessage.Data.IridiumAmountLooted != 0
            ? (resourcesLootedMessage ? ", " : "") +
              Astriarch.DecimalToFixed(planetaryConflictMessage.Data.IridiumAmountLooted, 2) +
              " Iridium"
            : "";
        resourcesLootedMessage +=
          planetaryConflictMessage.Data.ResearchAmountLooted != 0
            ? (resourcesLootedMessage ? ", " : "") +
              Astriarch.DecimalToFixed(planetaryConflictMessage.Data.ResearchAmountLooted, 2) +
              " Research"
            : "";

        resourcesLootedMessage = "Resources looted: " + resourcesLootedMessage;
      }
    }
    summary += resourcesLootedMessage + "<br />";
    var attackingFleetStrength = planetaryConflictMessage.Data.AttackingFleet.DetermineFleetStrength();
    var researchBoostSummaryAttackingFleet = planetaryConflictMessage.Data.AttackingFleetResearchBoostAttack
      ? ", +" + (planetaryConflictMessage.Data.AttackingFleetResearchBoostAttack / 2) * 100 + "% Attack"
      : "";
    researchBoostSummaryAttackingFleet += planetaryConflictMessage.Data.AttackingFleetResearchBoostDefense
      ? ", +" + (planetaryConflictMessage.Data.AttackingFleetResearchBoostDefense / 2) * 100 + "% Defense"
      : "";
    summary +=
      "Attacking Fleet (strength " +
      attackingFleetStrength +
      ", Chance to Win: " +
      planetaryConflictMessage.Data.AttackingFleetChances +
      "%" +
      researchBoostSummaryAttackingFleet +
      "): <br />";
    summary += planetaryConflictMessage.Data.AttackingFleet.ToString() + "<br /><br />";
    var defendingFleetStrength = planetaryConflictMessage.Data.DefendingFleet.DetermineFleetStrength();
    var researchBoostSummaryDefendingFleet = planetaryConflictMessage.Data.DefendingFleetResearchBoostAttack
      ? ", +" + (planetaryConflictMessage.Data.DefendingFleetResearchBoostAttack / 2) * 100 + "% Attack"
      : "";
    researchBoostSummaryDefendingFleet += planetaryConflictMessage.Data.DefendingFleetResearchBoostDefense
      ? ", +" + (planetaryConflictMessage.Data.DefendingFleetResearchBoostDefense / 2) * 100 + "% Defense"
      : "";
    summary += "Defending Fleet (strength " + defendingFleetStrength + researchBoostSummaryDefendingFleet + "): <br />";
    summary += planetaryConflictMessage.Data.DefendingFleet.ToString() + "<br /><br />";
    summary += "Ships Remaining: <br />";
    summary += planetaryConflictMessage.Data.WinningFleet.ToString() + "<br />";

    if (!Astriarch.PlayerGameOptions.ShowPlanetaryConflictPopups) {
      $("#NeverShowPlanetaryConflictPopupsCheckbox").prop("checked", true);
    } else {
      $("#NeverShowPlanetaryConflictPopupsCheckbox").prop("checked", false);
    }

    $("#PlanetaryConflictSummary").html(summary);

    var attackingPlayerName = planetaryConflictMessage.Data.AttackingPlayer.Name;
    var defendingPlayerName = Astriarch.GameTools.PlanetOwnerToFriendlyName(
      planetaryConflictMessage.Planet.Type,
      planetaryConflictMessage.Data.DefendingPlayer
    );
    Astriarch.PlanetaryConflictControl.dialog.setTitle(
      attackingPlayerName + " Attacked " + defendingPlayerName + " at Planet: " + planetaryConflictMessage.Planet.Name
    );

    Astriarch.PlanetaryConflictControl.dialog.open();
  },

  OKClose: function() {
    Astriarch.PlayerGameOptions.ShowPlanetaryConflictPopups = true;
    if ($("#NeverShowPlanetaryConflictPopupsCheckbox").attr("checked")) {
      Astriarch.PlayerGameOptions.ShowPlanetaryConflictPopups = false;
    }
    //this is probably not the best way to do this, but it can't be syncronous because it needs to pop this up again
    setTimeout(function() {
      Astriarch.GameController.processNextEndOfTurnPlanetaryConflictMessage();
    }, 100);

    if (window.tour.enabled && window.tour.step == 62) {
      window.tour.jqElm.joyride("nextTip");
    }
  },

  Close: function() {
    Astriarch.PlanetaryConflictControl.dialog.dlg.dialog("close");
  }
};
