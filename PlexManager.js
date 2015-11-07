var tm = require('./TorrentManager.js');
var sm = require('./SearchManager.js');
var path = require('path');
var tvdb = new (require('node-tvdb'))("6BBEDAE780DC7C68");
var fs = require('fs');
var mv = require('mv');

module.exports = PlexManager;

function PlexManager(tvdir,moviedir){
	var that = this;
	var dbPath = 'db';
	var dbReady = false;
	var db;
	var tvdir = tvdir;
	var moviedir = moviedir;
	
	this.downloadTvShows = function(cb){
		console.log("Retrieving missing episodes");
		var dbKeys = Object.keys(db.tv);
		var que = [];
		for(var i=0;i<dbKeys.length;i++){
			if(db.tv[dbKeys[i]].hasOwnProperty('episodes')){
				if(db.tv[dbKeys[i]].episodes == null){db.tv[dbKeys[i]].episodes = {};}
				var epKeys = Object.keys(db.tv[dbKeys[i]].episodes);
				for(var a=0;a<epKeys.length;a++){
					if(db.tv[dbKeys[i]].episodes[epKeys[a]].hasOwnProperty('present')){
						if(!db.tv[dbKeys[i]].episodes[epKeys[a]].present){
							que.push({title:dbKeys[i],episode:epKeys[a]});
						}
					}
				}
			}
		}
		(new AsyncResults(_downloadTvShow,que,function(results){
			cb();
		})).next();
	}
	
	this.syncTvShows = function(cb){
		console.log("Synchronizing database");
		var dbKeys = Object.keys(db.tv);
		(new AsyncResults(_getTvDbId,dbKeys,function(results){
			var ids = [];
			for(var i=0;i<results.length;i++){
				db.tv[results[i].title] = {tvdb:results[i].id,episodes:null};
				ids.push(results[i].id);
			}
			(new AsyncResults(_updateTvDb,ids,function(results){
				for(var i=0;i<results.length;i++){
					db.tv[results[i].title] = results[i][results[i].title];
				}
				_getSavedTvEpisodes(function(savedEpisodes){
					var notInDB = {};
					var dbKeys = Object.keys(db.tv);
					for(var i=0;i<dbKeys.length;i++){
						if(savedEpisodes.hasOwnProperty(dbKeys[i])){
							var epKeys = Object.keys(savedEpisodes[dbKeys[i]].episodes);
							for(var a=0;a<epKeys.length;a++){
								db.tv[dbKeys[i]].episodes[epKeys[a]] = savedEpisodes[dbKeys[i]].episodes[epKeys[a]];
							}
							delete savedEpisodes[dbKeys[i]];
						}
					}
					dbKeys = Object.keys(savedEpisodes);
					if(dbKeys.length > 0){
						for(var i=0;i<dbKeys.length;i++){
							db.tv[dbKeys[i]] = savedEpisodes[dbKeys[i]];
						}
						(new AsyncResults(_getTvDbId,dbKeys,function(results){
							var ids = [];
							for(var i=0;i<results.length;i++){
								if(!db.tv.hasOwnProperty(results[i].title)){db.tv[results[i].title] = {tvdb:results[i].id,episodes:null}; continue;}
								if(db.tv[results[i].title].hasOwnProperty('episodes')){
									db.tv[results[i].title].tvdb = results[i].id;
								}else{
									db.tv[results[i].title] = {tvdb:results[i].id,episodes:null};
								}
								ids.push(results[i].id);
							}
							(new AsyncResults(_updateTvDb,ids,function(results){
								for(var i=0;i<results.length;i++){
									if(db.tv.hasOwnProperty(results[i].title)){
										if(db.tv[results[i].title].hasOwnProperty('episodes') && results[i][results[i].title].hasOwnProperty('episodes')){
											var epKeys = Object.keys(results[i][results[i].title].episodes);
											for(var a=0;a<epKeys.length;a++){
												if(!db.tv[results[i].title].episodes.hasOwnProperty(epKeys[a])){
													db.tv[results[i].title].episodes[epKeys[a]] = results[i][results[i].title].episodes[epKeys[a]];
												}
											}
										}
									}else{
										db.tv[results[i].title] = results[i][results[i].title];
									}
								}
								_saveDb(cb);
							})).next();
						})).next();
					}else{
						_saveDb(cb);
					}
				});
			})).next();
		})).next();
	}
	
	var _downloadTvShow = function(ar,show,cb){
		console.log("Searching for "+show.title+" "+show.episode);
		sm.search(show.title+" "+show.episode,{},function(searchRes){
			if(searchRes == null){
				console.log("No results found");
				ar.next();
				return;
			}
			if(searchRes.length > 0){
				console.log("Found: "+searchRes[0].title);
				tm.download(searchRes[0].link,function(torrentRes){
					if(torrentRes == null){
						console.log("Failed: unable to download "+searchRes[0].title);
						ar.next();
						return;
					}
					if(torrentRes.files.length > 0){
						torrentRes.files.sort(function(a,b){
							return b.length - a.length;
						});
						console.log("Download complete: "+torrentRes.name);
						mv(torrentRes.files[0].path,
							path.resolve(path.join(tvdir,show.title,"Season "+show.episode.match(/\d\d(?=e\d\d)/i)[0],
								show.title+" "+show.episode+torrentRes.files[0].path.match(/.\w\w\w$/)[0])),{mkdirp: true},function(err){
									if(err){console.log(err);}
									ar.next();
								})
					}else{
						mv(torrentRes.name,
							path.resolve(path.join(tvdir,show.title,"Season "+show.episode.match(/\d\d(?=e\d\d)/i)[0],
								show.title+" "+show.episode+torrentRes.name.match(/.\w\w\w$/)[0])),{mkdirp: true},function(err){
									if(err){console.log(err);}
									ar.next();
								})
					}
				});
			}else{ar.next();}
		});
	}
// {tv:{"The 100":{tvdb:01010101,episodes:{s01e01:{present:true,downloading:false,path:'/arf/arf/arf'}}}}}	
	var _updateTvDb = function(ar,showid,cb){
		tvdb.getSeriesAllById(showid,function(err,resp){
			if(err){ar.next();return;}
			var tdb = {title:resp.SeriesName}
			tdb[resp.SeriesName] = {tvdb:showid,episodes:{}};
			for(var i=0;i<resp.Episodes.length;i++){
				var s = (resp.Episodes[i].SeasonNumber.length < 2)?"0"+resp.Episodes[i].SeasonNumber:resp.Episodes[i].SeasonNumber;
				var e = (resp.Episodes[i].EpisodeNumber.length < 2)?"0"+resp.Episodes[i].EpisodeNumber:resp.Episodes[i].EpisodeNumber;
				tdb[resp.SeriesName].episodes["s"+s+"e"+e] = {present:false,downloading:false,path:null};
			}
			ar.addResult(tdb);
			ar.next();
		});
	}
	
	var _getTvDbId = function(ar,title,cb){
		tvdb.getSeries(title,function(err,resp){
			if(err){ar.next();return;}
			if(resp == null){ar.next();return;}
			if(resp.length < 1){ar.next();return;}
			ar.addResult({title:resp[0].SeriesName,id:resp[0].seriesid});
			ar.next();
		});
	}
	
	var _getSavedTvEpisodes = function(cb){
		fs.readdir(path.resolve(tvdir),function(err,shows){
			if(err){cb(err);return;}
			for(var i=0;i<shows.length;i++){
				shows[i] = path.resolve(path.join(tvdir,shows[i]));
			}
			var arseasons = new AsyncResults(_getFiles,shows,function(results){
				var arshows = new AsyncResults(_getFiles,results,function(results){
					var res = {};
					for(var i=0;i<results.length;i++){
						var file = path.parse(results[i]).base;
						var title = file.match(/[\W\w]+(?=\ss\d\de\d\d)/i);
						var episode = file.match(/s\d\de\d\d/i);
						if(title != null){title = title[0]}else{continue;}
						if(episode != null){episode = episode[0].toLowerCase();}else{continue;}
						if(!res.hasOwnProperty(title)){res[title] = {};}
						if(!res[title].hasOwnProperty('episodes')){res[title].episodes = {}};
						res[title].episodes[episode] = {present:true,downloading:false,path:results[i]};
					}
					cb(res);
				});
				arshows.next();
			});
			arseasons.next();
		});
	}
	
	var _getFiles = function(ar,dir){
		fs.readdir(dir,function(err,files){
			if(err){ar.next();return;}
			for(var i=0;i<files.length;i++){
				ar.addResult(path.resolve(path.join(dir,files[i])));
			}
			ar.next();
		});
	}
	
/*	this._sync = function(cb) {
		fs.readdir(path.resolve(tvdir),function(err,files){
			if(err){cb(err);return;}
			for(var i=0;i<files.length;i++) {
				if(!db.tv.shows.hasOwnProperty(files[i])){
					tvdb.getSeries(files[i],function(err,resp){
						if(err){cb(err);return;}
						console.log(i+" - "+resp);
						db.tv.shows[resp[0].SeriesName] = {seriesid:resp[0].seriesid,episodes:[]};
						db.tv.ids[resp[0].seriesid] = resp[0].SeriesName;
						tvdb.getSeriesAllById(resp[0].seriesid,function(err,resp){
							if(err){cb(err);return;}
							for(var a=0;a<resp.Episodes.length;a++){
								var show = db.tv.shows[db.tv.ids[resp.id]];
								if(!show.hasOwnProperty('episodes')){show.episodes = [];}
								var season = resp.Episodes[a].SeasonNumber;
								var episode = resp.Episodes[a].EpisodeNumber;
								season = (season.length < 2)?"0"+season:season;
								episode = (episode.length < 2)?"0"+episode:episode;
								show.episodes.push({episode:"s"+season+"e"+episode,present:false,downloading:false});
							}
							fs.readdir(path.resolve(path.join(tvdir,db.tv.ids[resp.id])),function(err,efiles){
								var resCount = 0;
								for(var a=0;a<efiles.length;a++){
									fs.readdir(path.resolve(path.join(tvdir,db.tv.ids[resp.id],efiles[a])),function(err,afiles){
										resCount += afiles.length;
										for(var c=0;c<afiles.length;c++){
											if(afiles[c].match(/s\d\de\d\d/i) != null){
												var show = db.tv.shows[db.tv.ids[resp.id]].episodes;
												for(var b=0;b<show.length;b++){
													if(afiles[c].match(/s\d\de\d\d/i) == show.episode){show.present = true; break;}
												}
											}
											if(resCount > 1){resCount--;}else{cb();}
										}
									});
								}
							});
						});
					});
				}
			}
			
		});
	}*/
	
	var _saveDb = function(cb){
		fs.writeFile(dbPath,JSON.stringify(db),cb);
	}

	var conts = "";
	try{
	conts = fs.readFileSync(dbPath);
	db = JSON.parse(conts);
	}catch(e){
	db = {tv:{},movies:{}};
	_saveDb(function(err){if(err){console.log(err)}});
	}
}

function AsyncResults(worker,work,cb){
	var that = this;
	var worker = worker;
	var work = work;
	var cb = cb;
	var results = [];
	
	this.addResult = function(result){results.push(result);}
	this.getWork = function(){if(work.length > 0){return work.shift();}else{return null;}}
	this.next = function(){
		if(work.length > 0 && worker != null){
			worker(this,this.getWork());
		}else{
			cb(results);
		}
	}
}

/*
sm.search("The 100 S02E10",{},function(res){
	if(res == null){return;}
	tm.download(res[0].link,path.resolve('C:\\tvshows\\'),function(info){
		if(info == null){console.log("Unsuccessful")return;}
		console.log(JSON.stringify(info));
	});
});
*/

