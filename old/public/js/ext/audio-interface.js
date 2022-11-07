AudioInterface = function(enabled) {
	this.Volume = 1.0;
	
	this.muted = false;
	this.phase = 'StartMenu';//StartMenu|InGame|GameOver
	this.currentInGameTrack = 0;

	this.enabled = enabled;

	if(this.enabled){
		this.mediaStart = this.createAudioElement('audio/menu-start', true, false, true);
		this.mediaInGame1 = this.createAudioElement('audio/in-game1', false, true);
		this.mediaInGame2 = this.createAudioElement('audio/in-game2', false, true);
		this.mediaInGame3 = this.createAudioElement('audio/in-game3', false, true);
		this.mediaInGame4 = this.createAudioElement('audio/in-game4', false, true);
		this.mediaEnd = this.createAudioElement('audio/game-over', true, false);

		this.mediaTurnStart = this.createAudioElement('audio/sfx-turn-start', false, false);
		this.mediaTurnEnd = this.createAudioElement('audio/sfx-turn-end', false, false);
	}
	
	this.fadingPlayer = null;
};

AudioInterface.prototype.toggleMute = function() {
	this.muted = !this.muted;

	if(this.enabled) {
		this.mediaStart.muted = this.muted;
		this.mediaInGame1.muted = this.muted;
		this.mediaInGame2.muted = this.muted;
		this.mediaInGame3.muted = this.muted;
		this.mediaInGame4.muted = this.muted;
		this.mediaEnd.muted = this.muted;
	}
};

AudioInterface.prototype.setVolume = function(volume) {
	this.Volume = volume;

	var meCurrent = this.getMediaElementForCurrentPhase();
	if (meCurrent != null) {
		meCurrent.volume = this.Volume;
	}
};

AudioInterface.prototype.mediaEnded = function() {
	if (this.phase == 'InGame') {
		this.currentInGameTrack++;

		if (this.currentInGameTrack >= 4)
			this.currentInGameTrack = 0;
	}

	var meCurrent = this.getMediaElementForCurrentPhase();
	if (meCurrent) {
		//loop the track
		meCurrent.currentTime = 0;
		meCurrent.play();
		meCurrent.volume = this.Volume;
	}
};

AudioInterface.prototype.createAudioElement = function(fileName, loop, addEndedEvent, playImmediately) {
	var audioElement = document.createElement('audio');//new Audio();
	
	audioElement.loop = loop;
	
	var me = this;
	if(playImmediately) {
		audioElement.addEventListener( 'canplaythrough', function(ev){
			audioElement.play();
		}, false );
	}
	
	if(addEndedEvent) {
		audioElement.addEventListener( 'ended', function(ev){
			me.mediaEnded();
		}, false );
	}
	
	audioElement.controls = false;
	audioElement.autobuffer = true;
	audioElement.preload = 'auto';
	
	//audioElement.src = fileName + '.' + (audioElement.canPlayType('audio/mpeg;') ? 'mp3' : 'ogg');
	audioElement.src = fileName + '.' + (audioElement.canPlayType('audio/ogg; codecs="vorbis"') ? 'ogg' : 'mp3');
	
	// Attempt to preload (fails on Mobile Safari)
	audioElement.load();
	
	return audioElement;
};

AudioInterface.prototype.getMediaElementForCurrentPhase = function() {
	var audioElement = null;
	if(this.enabled){
		if (this.phase == 'StartMenu')
		{
			audioElement = this.mediaStart;
		}
		else if (this.phase == 'GameOver')
		{
			audioElement = this.mediaEnd;
		}
		else
		{
			switch (this.currentInGameTrack)
			{
				case 0:
					audioElement = this.mediaInGame1;
					break;
				case 1:
					audioElement = this.mediaInGame2;
					break;
				case 2:
					audioElement = this.mediaInGame3;
					break;
				case 3:
					audioElement = this.mediaInGame4;
					break;
			}
		}
	}
	return audioElement;
};

AudioInterface.prototype.fadeOutTick = function() {
	if(this.enabled && this.fadingPlayer){
		if (this.fadingPlayer.volume <= 0.1)
		{
			this.fadingPlayer.volume = 0;
			this.fadingPlayer.pause();
			this.fadingPlayer.currentTime = 0;
		}
		else
		{
			this.fadingPlayer.volume = this.fadingPlayer.volume - 0.1;
			var me = this;
			setTimeout(function() { me.fadeOutTick(); }, 100);
		}
	}
};

AudioInterface.prototype.StartFadeOut = function() {
	this.fadingPlayer = this.getMediaElementForCurrentPhase();
	var me = this;
	setTimeout(function() { me.fadeOutTick(); }, 100);
};

AudioInterface.prototype.StartMenu = function() {
	if(this.enabled){
		this.StartFadeOut();

		this.Volume = 1.0;
		this.phase = 'StartMenu';

		this.mediaStart.currentTime = 0;
		this.mediaStart.play();
		this.mediaStart.volume = this.Volume;
	}
};

AudioInterface.prototype.BeginGame = function() {
	if(this.enabled){
		this.StartFadeOut();

		this.phase = 'InGame';
		this.currentInGameTrack = 0;

		this.mediaInGame1.play();
		this.mediaInGame1.volume = this.Volume;
	}
};

AudioInterface.prototype.EndGame = function() {
	if(this.enabled){
		this.StartFadeOut();

		this.phase = 'GameOver';

		this.mediaEnd.play();
		this.mediaEnd.volume = this.Volume;
	}
};

AudioInterface.prototype.StartTurn = function() {
	if(this.enabled && !this.muted){

		this.mediaTurnStart.currentTime = 0;
		this.mediaTurnStart.play();
		this.mediaTurnStart.volume = this.Volume;
	}
};

AudioInterface.prototype.EndTurn = function() {
	if(this.enabled && !this.muted){

		this.mediaTurnEnd.currentTime = 0;
		this.mediaTurnEnd.play();
		this.mediaTurnEnd.volume = this.Volume;
	}
};