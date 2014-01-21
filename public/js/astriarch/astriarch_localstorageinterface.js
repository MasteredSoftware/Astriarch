var Astriarch = Astriarch || require('./astriarch_base');


/**
 * Local Storage Interface uses the model and HTML5 localStorage to load and save user preferences
 */
Astriarch.LocalStorageInterface = {

	Prefs: {"gameName":"New Game", "playerName":"Player"},
	Key:"astriarch_prefs"
};

/**
 * Saves prefs to the localStorage
 */
Astriarch.LocalStorageInterface.savePrefs = function(){

	if(localStorage)
	{
		var savedPrefsJSON = JSON.stringify(Astriarch.LocalStorageInterface.Prefs);
		if(savedPrefsJSON != null)
		{
			localStorage.setItem(Astriarch.LocalStorageInterface.Key, savedPrefsJSON);
		}
	}
};

/**
 * Loads prefs from the localStorage
 */
Astriarch.LocalStorageInterface.loadPrefs = function(){
	var returnVal = Astriarch.LocalStorageInterface.Prefs;
	if(localStorage)
	{
		var savedPrefsJSON = localStorage.getItem(Astriarch.LocalStorageInterface.Key);
		if(savedPrefsJSON != null)
		{
			try {
				var prefs = JSON.parse(savedPrefsJSON);
				if(prefs) {
					Astriarch.LocalStorageInterface.Prefs = prefs;
				}
			} catch(e)
			{

			}
		}
	}
	return returnVal;
};

Astriarch.LocalStorageInterface.loadPrefs();
