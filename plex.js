var fs = require('fs');
var path = require('path');
var pm = new (require('./PlexManager.js'))("/media/drive/tvshows");

var running = false;

function update(){
	if(!running){
		console.log("Starting...")
		running = true;
		pm.syncTvShows(function(){
			console.log("Sync complete");
			pm.downloadTvShows(function(){console.log("Downloads complete");running=false;});
		});
	}else{console.log("Already running");}
}

var interval = setInterval(update,86400000);
//var interval = setInterval(update,60000);
update();
