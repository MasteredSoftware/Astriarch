Astriarch.ExitConfirmControl = {
	dialog:null,//instance of Astriarch.Dialog

	init: function() {

		$("#ButtonExitMainMenu").button().click(function() {
			Astriarch.View.ShowMainMenu();
			Astriarch.ExitConfirmControl.CancelClose();
		});

		$("#ButtonExitResign").button().click(function() {
			//Resign
			Astriarch.server_comm.sendMessage({type:Astriarch.Shared.MESSAGE_TYPE.EXIT_RESIGN, payload:{}});

			Astriarch.ExitConfirmControl.CancelClose();
		});

		Astriarch.ExitConfirmControl.dialog = new Astriarch.Dialog('#exitConfirmDialog', 'Exit or Resign?', 200, 165, null, Astriarch.ExitConfirmControl.CancelClose);
	},

	show: function() {
		Astriarch.ExitConfirmControl.dialog.open();
	},

	CancelClose: function() {
		Astriarch.ExitConfirmControl.dialog.dlg.dialog('close');
	}
};