var pm = new (require('./PlexManager.js'))("/media/tvshows");

pm.syncTvShows(function(){
	console.log("Sync complete");
	pm.downloadTvShows(function(){console.log("Download complete");});
});
