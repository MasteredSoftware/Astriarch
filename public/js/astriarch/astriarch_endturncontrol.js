Astriarch.EndTurnControl = {
	dialog:null,//instance of Astriarch.Dialog

	init: function() {
		Astriarch.EndTurnControl.dialog = new Astriarch.Dialog('#endTurnDialog', 'Waiting on Players', 424, 313, null, null);

	},

	show: function(data) {
		$('#EndTurnSummary').html('Waiting on other players to finish turns.');
		Astriarch.EndTurnControl.dialog.open();
	},

	hide: function()	{
		Astriarch.EndTurnControl.dialog.close();
	}
};