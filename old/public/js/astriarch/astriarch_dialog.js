/**
 * A Generic Dialog window constructor
 * @constructor
 */
Astriarch.Dialog = function(contentSelector, title, width, height, okCallback, cancelCallback) {
  this.contentSelector = contentSelector;
  this.DialogResult = false;

  this.okCallback = okCallback;
  this.cancelCallback = cancelCallback;

  var buttons = [];
  if (typeof this.okCallback == "function") {
    buttons.push({
      text: "Ok",
      click: function() {
        self.okClose();
      }
    });
  }
  if (typeof this.cancelCallback == "function") {
    buttons.push({
      text: "Cancel",
      click: function() {
        self.cancelClose();
      }
    });
  }

  var self = this;
  this.dlg = $(contentSelector).dialog({
    autoOpen: false,
    resizable: false,
    title: title,
    width: width,
    height: height,
    modal: true,
    buttons: buttons,
    open: function(event, ui) {
      //auto-focus the ok button
      $(this)
        .siblings(".ui-dialog-buttonpane")
        .find("button[autofocus]")
        .focus();
    },
    close: function(event, ui) {
      Astriarch.View.BindHotkeys();
    }
  });
};

/**
 * Opens this dialog window
 * @this {Astriarch.Dialog}
 */
Astriarch.Dialog.prototype.open = function() {
  Astriarch.View.BindHotkeys(this.contentSelector);
  this.dlg.dialog("open");
};

/**
 * closes this dialog window
 * @this {Astriarch.Dialog}
 */
Astriarch.Dialog.prototype.close = function() {
  this.dlg.dialog("close");
};

/**
 * Closes this dialog window with the ok callback
 * @this {Astriarch.Dialog}
 */
Astriarch.Dialog.prototype.okClose = function() {
  this.DialogResult = true;
  if (typeof this.okCallback == "function") this.okCallback();
  this.close();
};

/**
 * Closes this dialog window with the cancel callback
 * @this {Astriarch.Dialog}
 */
Astriarch.Dialog.prototype.cancelClose = function() {
  this.DialogResult = false;
  if (typeof this.cancelCallback == "function") this.cancelCallback();
  this.close();
};

/**
 * Sets the dialog window's title
 * @this {Astriarch.Dialog}
 */
Astriarch.Dialog.prototype.setTitle = function(title) {
  this.dlg.dialog("option", "title", title);
};
