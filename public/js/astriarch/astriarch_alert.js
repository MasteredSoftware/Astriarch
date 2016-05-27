/**
 * A Generic Dialog window constructor
 * @constructor
 */
Astriarch.Alert = function(title, message) {
	
	var self = this;
	$("#AstriarchAlertBox").html(message);
	this.dlg = $("#AstriarchAlertBox").dialog({'autoOpen':true, 'title':title, 'width':200, 'height':120, 'modal':true});
	
};

