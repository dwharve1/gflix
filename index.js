var log = new (require('./logger.js'))(true);

// Parers
var sm = require('./search-manager.js');

var tm = require('./stream-manager.js');

var ffmpeg = require('fluent-ffmpeg');

// Web server
var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);

// Start webserver
http.listen(process.argv[2],'127.0.0.1');
app.use('/js',express.static(__dirname+'/js'));
app.get('/watch/:tid',function(req,res){
	res.sendFile(__dirname+'/html/watch.html')
});
app.get('/video/:infoHash',tm.stream);

app.get('/*',function(req,res){
	res.sendFile(__dirname+'/html/search.html');
});

var search = io.of('/search').on('connection',function(socket){
	log.debug('/search connected');
	
	socket.on('tmdb:search',function(query){
		sm.search(query,{},function(res){
			if(res.progress < 100){
				socket.emit("progress",res);
			}else{
				socket.emit('tmdb:search',res);
			}
		});
	});
	socket.on('tmdb:listSeasons',function(tmdbId){
		sm.listSeasons(tmdbId,function(res){
			if(res.progress < 100){
				socket.emit("progress",res);
			}else{
				socket.emit('tmdb:results',res);
			}
		});
	});
	socket.on('tmdb:listEpisodes',function(tmdbId,seasonId){
		sm.listEpisodes(tmdbId,seasonId,{},function(res){
			if(res.progress < 100){
				socket.emit("progress",res);
			}else{
				socket.emit('tmdb:results',res);
			}
		});
	});
	socket.on('tmdb:getMovie',function(tmdbId){
		sm.getMovie(tmdbId,{},function(res){
			if(res.progress < 100){
				socket.emit("progress",res);
			}else{
				socket.emit('tmdb:results',res);
			}
		});
	});
	socket.on('tmdb:getEpisode',function(tmdbId,seasonId,episodeId){
		sm.getEpisode(tmdbId,seasonId,episodeId,{},function(res){
			if(res.progress < 100){
				socket.emit("progress",res);
			}else{
				socket.emit('tmdb:results',res);
			}
		});
	});
});

var stream = io.of('/stream').on('connection',function(socket){
	log.debug('/stream connected');

	socket.on('start',function(magUri){
		if(magUri){
			leaveAllRooms(socket,function(){
				var infoHash = tm.parseInfoHash(magUri);
				if(infoHash){
					socket.join(infoHash,function(){
						cleanUpTorrents();
						if(tm.exists(infoHash)){
							socket.emit('play', '/video/'+infoHash);
						}else{
							tm.start(magUri,{verify:false,uploads:0},function(err){
								if(!err){
									socket.emit('play', '/video/'+infoHash);
								}
							});
						}
					});
				}
			});
		}
	});
	socket.on('torrentsById',function(tmdbId){
		sm.getTorrent(tmdbId,function(err,res){
			if(err){log.error(err);return;}
			if(!res){log.debug('invalid video requested');return;}
			socket.emit('torrents',res);
		});
	});
	socket.on('disconnect',function(){
		cleanUpTorrents();
	});
});

function leaveAllRooms(socket,cb){
	if(socket.rooms.length > 0){
		socket.leave(socket.rooms[socket.rooms.length-1],function(err){
			if(err){log.error(err);}
			if(socket.rooms.length > 0){leaveAllRooms(soket,cb);}
			else{cb();}
		});
	}else{cb();}
}

function cleanUpTorrents(){
	var hashes = tm.getInfoHashes();
	for(var i=0;i<hashes.length;i++){
		if(io.nsps['/stream'].adapter.rooms[hashes[i]]){
			if(io.nsps['/stream'].adapter.rooms[hashes[i]].length == 0){
				tm.remove(hashes[i]);
			}
		}else{
			tm.remove(hashes[i]);
		}
	}
}

