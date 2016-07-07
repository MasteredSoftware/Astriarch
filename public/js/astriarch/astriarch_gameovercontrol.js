Astriarch.GameOverControl = {
	dialog:null,//instance of Astriarch.Dialog

	winningSerializablePlayer:null,//Player
	
	init: function() {
		
		Astriarch.GameOverControl.dialog = new Astriarch.Dialog('#gameOverDialog', 'Game Over', 424, 313, Astriarch.GameOverControl.OKClose);
	},
	
	show: function(/*SerializablePlayer*/ winningSerializablePlayer, /*bool*/ localPlayerWon, score) {
		Astriarch.GameOverControl.winningSerializablePlayer = winningSerializablePlayer;

		var summary = "";

		if (localPlayerWon)
			summary += "You conquered all of your enemies and reign supreme over the known universe!<br />You will be known as the first Astriarch - Ruler of the Stars.<br />";
		else
			summary += "You lost control over all your fleets and planets and have been crushed by the power of your enemies!<br />";

		summary += "In " + Astriarch.ClientGameModel.Turn.Number + " turns.<br />";
		if(winningSerializablePlayer){
			summary += winningSerializablePlayer.Name + " won the game with " + winningSerializablePlayer.OwnedPlanetIds.length + " planets.<br />";
			Astriarch.GameOverControl.dialog.setTitle("Game Over, Player: " + winningSerializablePlayer.Name + " Wins!");
		} else {
			summary += "Other Players are still battling it out to earn the title of Astriarch.<br />"
			Astriarch.GameOverControl.dialog.setTitle("Game Over, Other Players Still Fighting!");
		}
		summary += "<br />Your points: " + score;
		
		AstriarchExtern.OnGameOver({'PlayerWon':localPlayerWon, 'Turns':Astriarch.ClientGameModel.Turn.Number, 'Score':score});
		
		$('#GameOverSummary').html(summary);
		
		Astriarch.GameOverControl.dialog.open();
	},

	OKClose: function()	{
		Astriarch.GameController.GameOverControlClosed();
	}
};