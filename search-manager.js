var log = new (require('./logger.js'))(true);

var MAX_PAGE_LIMIT = 2;

// Parsers
var fs = require('fs');
var path = require('path');
var parsersPath = 'parsers';
var parsers = [];
// Load parsers
if(fs.existsSync(parsersPath)) {
	if(fs.lstatSync(parsersPath).isDirectory()) {
		var files = fs.readdirSync(parsersPath);
		for(var i=0;i<files.length;i++) {
			parsers.push(require(path.resolve('.'+path.sep+path.join(parsersPath,files[i]))));
		}
	}
}

// Databases
var request = require('request');
var mongoose = require('mongoose');
var db = mongoose.connection;

// Setup database connection and schema
db.on('error', function(e){
	log.error(e);
	exit();
});
db.once('open',function(){
	log.debug("Connected to DB");
});
mongoose.connect('mongodb://localhost/tmdb');

/*
var tmdbSearchSchema = mongoose.Schema({
	backdrop_path: String,
	first_air_date: Date,
	genre_ids: [Number],
	id: Number,
	original_lanuage: String,
	original_name: String,
	overview: String,
	origin_country: [String],
	poster_path: String,
	popularity: Number,
	name: String,
	vote_average: Number,
	vote_count: Number,
	media_type: String
});
*/

var torrentSchema = mongoose.Schema({
	title: String,
	name: String,
	year: String,
	tv: String,
	movie: String,
	seeders: Number,
	size: String,
	link: String
});

var parserResultsSchema = mongoose.Schema({
	tmdbId: Number,
	torrents: [torrentSchema],
	timeStamp: Date
});

var Torrent = mongoose.model('Torrent', parserResultsSchema);

module.exports = new SearchManager();

function SearchManager() {
	var that = this;
	
	this.getTorrent = function(tmdbId,cb){
		Torrent.where({tmdbId: tmdbId}).findOne(cb);
	}

	this.search = function(query,options,cb){
		
		cb({message:"Searching for "+query,progress:0,results:null});
		searchTmdb(query,function(err,res){
			if(err){
				log.error("tmdb search error: "+err);
				cb({message:"Server error, please try again later",progress:100,results:null});
				return;
			}
			if(res.length < 1){
				log.debug("tmdb returned no results");
				cb({message:"Searching for "+query+" returned no results",progress:100,results:null});
				return;
			}

			var list = [];
			for(var i=0;i<res.length;i++){
				var item = {};
				item.id = res[i].id;
				item.title = (res[i].title)?res[i].title:res[i].name;
				item.torrentTitle = item.title;
				item.torrentTitle += (res[i].release_date)?' '+res[i].release_date.split('-')[0]:'';
				item.image = (res[i].poster_path)?'http://image.tmdb.org/t/p/w185'+res[i].poster_path:null;
				item.url = '/'+res[i].media_type+'/'+res[i].id;
				item.media_type = res[i].media_type;
				list.push(item);
			}

			cb({message:"Checking cached torrents",progress:33,results:null});
			queryTorrents(list,function(err, queryRes){
				if(err){
					log.error("Mongo query error: "+err);
					cb({message:"Server error, please try again later",progress:100,results:null});
					return;
				}
				if(!queryRes){
					log.error("Mongo returned no results");
					cb({message:"Server error, please try again later",progress:100,results:null});
					return;
				}
				
				cb({message:"Searching torrent sites for availability",progress:75,results:null});
				var resCount = queryRes.length;
				searchTorrents(queryRes,options,function(torRes){
					if(torRes.count > 0){
							cb({message:"Searching torrent sites for availability",progress:((resCount-torRes.count)/resCount*25)+75,results:null});
					}else{
						if(torRes.results.length < 1){
							cb({message:"No torrents found",progress:100,results:null});
							return;
						}
						cb({message:"",progress:100,results:torRes.results});
						return;
					}
				});
			});
		});
	}
	this.getMovie = function(tmdbId,options,cb){

		cb({message:"Retreiving movie details",progress:0,results:null});
		request({
			method:'GET',
			url: 'http://api.themoviedb.org/3/movie/'+tmdbId+'?api_key=ae171aa864156acb87af501e1dcf2d84',
			headers: {'Accept': 'application/json'}},
			function(err,res){
				if(err){
					log.error(err);
					cb({message:"Server error, please try again later",progress:100,results:null});
					return;
				}
				var json = JSON.parse(res.body);
				if(!json){
					log.debug("tmdb returned no results");
					cb({message:"Unable to find movie details",progress:100,results:null});
					return;
				}
				var result = {};
				result.id = json.id;
				result.title = json.title;
				result.torrentTitle = json.title;
				result.torrentTitle += (json.release_date)?' '+json.release_date.split('-')[0]:'';
				result.overview = json.overview;
				result.image = (json.poster_path)?'http://image.tmdb.org/t/p/w185'+json.poster_path:null;
				result.url = '/watch/'+json.id;
				
				cb({message:"Checking cached torrents",progress:33,results:null});
				queryTorrents([result],function(err, queryRes){
					if(err){
						log.error("Mongo query error: "+err);
						cb({message:"Server error, please try again later",progress:100,results:null});
						return;
					}
					if(!queryRes){
						log.error("Mongo returned no results");
						cb({message:"Server error, please try again later",progress:100,results:null});
						return;
					}

					var resCount = queryRes.length;
					cb({message:"Searching torrent sites for availability",progress:75,results:null});
					searchTorrents(queryRes,options,function(torRes){
						if(torRes.count > 0){
							cb({message:"Searching torrent sites for availability",progress:((resCount-torRes.count)/resCount*25)+75,results:null});
						}else{
							if(torRes.results.length < 1){
								cb({message:"No torrents found",progress:100,results:null});
								return;
							}
							result = torRes.results[0];
							result.playable = (torRes.results[0].torrents)?true:null;
							cb({message:"",progress:100,results:result});return;
						}
					});
				});
			}
		);
	}
	this.listSeasons = function(tmdbId,cb){

		cb({message:"Retreiving seasons",progress:0,results:null});
		getSeasons(tmdbId,function(err,res){
			if(err){
				log.error("tmdb search error: "+err);
				cb({message:"Server error, please try again later",progress:100,results:null});
				return;
			}
			if(!res){
				log.debug("tmdb returned no results");
				cb({message:"Unable to find seasons",progress:100,results:null});
				return;
			}
			var results = {};
			results.id = res.id;
			results.title = res.name;
			results.overview = res.overview;
			results.image = 'http://image.tmdb.org/t/p/w185'+res.poster_path;
			results.list = [];
			for(var i=0;i<res.seasons.length;i++){
				var item = {};
				item.id = res.seasons[i].id;
				item.title = 'Season '+res.seasons[i].season_number;
				item.image = (res.seasons[i].poster_path)?'http://image.tmdb.org/t/p/w185'+res.seasons[i].poster_path:null;
				item.url = '/tv/'+res.id+'/'+res.seasons[i].season_number;
				results.list.push(item);
			}
			cb({message:"",progress:100,results:results});
		});
	}
	this.listEpisodes = function(tmdbId,seasonId,options,cb){
		
		cb({message:"Retreiving show details",progress:0,results:null});
		getSeasons(tmdbId,function(err,res){
			if(err){
				log.error("tmdb search error: "+err);
				cb({message:"Server error, please try again later",progress:100,results:null});
				return;
			}
			if(!res){
				log.debug("tmdb returned no results");
				cb({message:"Unable to find episodes",progress:100,results:null});
				return;
			}
			var results = {};
			results.title = res.name;
			
			cb({message:"Retreiving episodes",progress:25,results:null});
			getEpisodes(tmdbId,seasonId,function(err,epRes){
				if(err){
					log.error("tmdb search error: "+err);
					cb({message:"Server error, please try again later",progress:100,results:null});
					return;
				}
				if(!epRes){
					log.debug("tmdb returned no results");
					cb({message:"Unable to find episodes",progress:100,results:null});
					return;
				}
				if(!epRes.episodes){
					log.debug("tmdb returned no results");
					cb({message:"Unable to find episodes",progress:100,results:null});
					return;
				}
				results.list = [];
				results.id = epRes.id;
				results.name = epRes.name;
				results.overview = epRes.overview;
				results.image = (epRes.poster_path)?'http://image.tmdb.org/t/p/w185'+epRes.poster_path:null;
				for(var i=0;i<epRes.episodes.length;i++){
					var item = {};
					item.id = epRes.episodes[i].id;
					item.torrentTitle = results.title + ' s';
					item.torrentTitle += (epRes.season_number)?'0'+epRes.season_number:epRes.season_number;
					item.torrentTitle += 'e';
					item.torrentTitle += (epRes.episodes[i].episode_number < 10)?'0'+epRes.episodes[i].episode_number:epRes.episodes[i].episode_number;
					item.title = 'Ep. '+epRes.episodes[i].episode_number+' '+epRes.episodes[i].name;
					item.image = 'http://image.tmdb.org/t/p/w185'+epRes.episodes[i].still_path;
					item.url = '/tv/'+tmdbId+'/'+seasonId+'/'+epRes.episodes[i].episode_number;
					results.list.push(item);
				}
				
				cb({message:"Checking cached torrents",progress:50,results:null});
				queryTorrents(results.list,function(err,queryRes){
					if(err){
						log.error("Mongo query error: "+err);
						cb({message:"Server error, please try again later",progress:100,results:null});
						return;
					}
					if(!queryRes){
						log.error("Mongo returned no results");
						cb({message:"Server error, please try again later",progress:100,results:null});
						return;
					}
					
					var resCount = queryRes.length;
					cb({message:"Searching torrent sites for availability",progress:75,results:null});
					searchTorrents(queryRes,options,function(torRes){
						if(torRes.count > 0){
							cb({message:"Searching torrent sites for availability",progress:((resCount-torRes.count)/resCount*25)+75,results:null});
						}else{
							if(torRes.results.length < 1){
								cb({message:"No torrents found",progress:100,results:null});
								return;
							}
							results.list = torRes.results;
							cb({message:"",progress:100,results:results});
							return;
						}
					});
				});
			});
		});
	}
	this.getEpisode = function(tmdbId,seasonId,episodeId,options,cb){
		
		cb({message:"Retreiving seasons",progress:0,results:null});
		getSeasons(tmdbId,function(err,res){
			if(err){
				log.error("tmdb search error: "+err);
				cb({message:"Server error, please try again later",progress:100,results:null});
				return;
			}
			if(!res){
				log.debug("tmdb returned no results");
				cb({message:"Unable to find seasons",progress:100,results:null});
				return;
			}
			var results = {};
			results.title = res.name;

			cb({message:"Retreiving episodes",progress:25,results:null});
			getEpisodes(tmdbId,seasonId,function(err,epRes){
				if(err){
					log.error("tmdb search error: "+err);
					cb({message:"Server error, please try again later",progress:100,results:null});
					return;
				}
				if(!epRes){
					log.debug("tmdb returned no results");
					cb({message:"Unable to find episodes",progress:100,results:null});
					return;
				}
				if(!epRes.episodes){
					log.debug("tmdb returned no results");
					cb({message:"Unable to find episodes",progress:100,results:null});
					return;
				}
				for(var i=0;i<epRes.episodes.length;i++){
					if(epRes.episodes[i].episode_number == episodeId){
						results.id = epRes.episodes[i].id;
						results.torrentTitle = results.title + ' s';
						results.torrentTitle += (epRes.season_number)?'0'+epRes.season_number:epRes.season_number;
						results.torrentTitle += 'e';
						results.torrentTitle += (epRes.episodes[i].episode_number < 10)?'0'+epRes.episodes[i].episode_number:epRes.episodes[i].episode_number;
						results.name = 'Ep. '+epRes.episodes[i].episode_number+' '+epRes.episodes[i].name;
						results.overview = epRes.episodes[i].overview;
						results.image = 'http://image.tmdb.org/t/p/w185'+epRes.episodes[i].still_path;
						results.url = '/watch/'+epRes.episodes[i].id;
					}
				}
				cb({message:"Checking cached torrents",progress:50,results:null});
				queryTorrents([results],function(err,queryRes){
					if(err){
						log.error("Mongo query error: "+err);
						cb({message:"Server error, please try again later",progress:100,results:null});
						return;
					}
					if(!queryRes){
						log.error("Mongo returned no results");
						cb({message:"Server error, please try again later",progress:100,results:null});
						return;
					}
					
					var resCount = queryRes.length;
					cb({message:"Searching torrent sites for availability",progress:75,results:null});
					searchTorrents(queryRes,options,function(torRes){
						if(torRes.count > 0){
							cb({message:"Searching torrent sites for availability",progress:((resCount-torRes.count)/resCount*25)+75,results:null});
						}else{
							if(torRes.results.length < 1){
								cb({message:"No torrents found",progress:100,results:null});
								return;
							}
							results = torRes.results[0];
							results.playable = (torRes.results[0].torrents)?true:null;
							cb({message:"",progress:100,results:results});
							return;
						}
					});
				});
			});
		});
	}

}

function getEpisodes(tmdbId, seasonId, cb){
	log.debug('Fetching episodes: id:'+tmdbId+', season:'+seasonId);
	request({
		method:'GET',
		url: 'http://api.themoviedb.org/3/tv/'+tmdbId+'/season/'+seasonId+'?api_key=ae171aa864156acb87af501e1dcf2d84',
		headers: {'Accept': 'application/json'}},
		function(err,res){
			if(err){log.error(err);cb(err);return;}
			log.debug('Status: '+res.statusCode);
			var json = JSON.parse(res.body);
			cb(null,json);
		}
	);
}

function getSeasons(tmdbId,cb){
	log.debug('Fetching seasons');
	request({
		method:'GET',
		url: 'http://api.themoviedb.org/3/tv/'+tmdbId+'?api_key=ae171aa864156acb87af501e1dcf2d84',
		headers: {'Accept': 'application/json'}},
		function(err,res){
			if(err){log.error(err);cb(err);return;}
			log.debug('Status: '+res.statusCode);
			cb(null,JSON.parse(res.body));
		}
	);
}

function searchTmdb(query,cb,page,results){
	if(results == null){results = [];}
	if(page == null){page = 1;}
	log.debug('Fetching page '+page);
	request({
		method:'GET',
		url: 'http://api.themoviedb.org/3/search/multi?api_key=ae171aa864156acb87af501e1dcf2d84&query='+escape(query)+'&page='+page,
		headers: {'Accept': 'application/json'}},
		function(err,res){
			if(err){log.error(err);cb(err,results);return;}
			log.debug('Status: '+res.statusCode);
			var json = JSON.parse(res.body);
			for(var i=0;i<json.results.length;i++){
				results.push(json.results[i]);
			}
			page++;
			if(page <= json.total_pages && page <= MAX_PAGE_LIMIT){searchTmdb(query,cb,page,results);}
			else{
				log.debug('tmdb results returned '+results.length);
				cb(null,results);return;
			}
		}
	);
}
/*
function getTmdbTv(tmdbResults,cb,results){
	if(results == null){results = [];}
	if(tmdbResults.length == 0){cb(null,results);return;}
	var cur = tmdbResults.shift();
	if(cur.media_type != 'tv'){results.push(cur);getTmdbTv(tmdbResults,cb,results);return;}
	tvdb.getSeriesByName(cur.name,function(err,res){
		
	});
}
*/
function queryTorrents(tmdbResults,cb){
	var ids = [];
	if(!tmdbResults){cb();return;}
	for(var i=0;i<tmdbResults.length;i++){
		ids.push({tmdbId: tmdbResults[i].id});
	}
	if(ids.length == 0){cb(null,tmdbResults);return;}
	log.debug('Querying database for torrents');
	Torrent.find({$or: ids}).exec(function(err,res){
		if(err){cb(err);return;}
		if(res != null){log.debug('Query returned '+res.length+' results');}
		else{log.debug('Query returned no results');}
		for(var i=0;i<tmdbResults.length;i++){
			for(var a=0;a<res.length;a++){
				if(tmdbResults[i].id == res[a].tmdbId){
					tmdbResults[i]['torrents'] = res[a];
					break;
				}
			}
		}
		cb(null,tmdbResults);return;
	});
}

function searchTorrents(tmdbResults,options,cb,results){
	if(results == null){results = [];}
	// Is there any tmdb results to process?
	cb({count: tmdbResults.length, results: results});
	if(tmdbResults.length == 0){return;}
	// cur is the media element to process this round
	var cur = tmdbResults.shift();
	
	// Skip anything other than movie or tv if it comes from multi search
	// but add tv to results
	if(cur.hasOwnProperty('media_type')){
		if(cur.media_type == 'tv'){
			results.push(cur);
		}
		if(cur.media_type != 'movie'){
			searchTorrents(tmdbResults,options,cb,results);return;
		}
	}
	/* Skip TV season listings but add to results
	if((cur.hasOwnProperty('season_number') && !cur.hasOwnProperty('episode_number'))){
		results.push(cur);
		searchTorrents(tmdbResults,options,cb,results);return;
	}*/
	
	// Does media already have torrent information?
	if(cur.hasOwnProperty('torrents')){
		// Was the torrent information obtained withing the last 24 hours?
		if(Date.now() - cur.torrents.timeStamp < 86400000){
			// Torrent property set without a link means there is no torrent for the media
			if(cur.torrents.torrents != null){results.push(cur);}
			// Continue loop
			searchTorrents(tmdbResults,options,cb,results);return;
		}else{
			// Does the media have a release date?
			if(cur.release_date != null){
				// Is the media older than 6 months?
				if(Date.now() - Date.parse(cur.release_date) > 15768017280){
					// Continue loop
					searchTorrents(tmdbResults,options,cb,results);return;
				}
			// Continue loop (Assuming media without release date to be very old)
			}else{searchTorrents(tmdbResults,options,cb,results);return;}
		}
	}
	log.debug('Searching for torrent '+(results.length+1)+' of '+(tmdbResults.length+results.length+1));
	// This block adds the year of the release date to the title
	log.debug('Searching parsers for '+cur.torrentTitle);
	// Query parsers
	searchParsers(cur.torrentTitle,0,function(res){
		res = filter(options,res);
		log.debug('Found '+res.length+' torrents for '+cur.torrentTitle);
		if(res.length > 0){
			// Update database with highest seeded magnet link
			var torrent = {tmdbId: cur.id, timeStamp: Date.now(), torrents: res};
			var tcb = function(){
				log.debug('Database updated for '+cur.torrentTitle);
				cur['torrents'] = torrent;
				results.push(cur);
				searchTorrents(tmdbResults,options,cb,results);return;
			}
			if(cur.hasOwnProperty('torrents')){
				Torrent.update(torrent,tcb);
			}else{
				Torrent.create(torrent,tcb);
			}
		}else{
			// Update database with empty magnet link
			var torrent = {tmdbId: cur.id, timeStamp: Date.now(), torrents: null};
			var tcb = function(){
				log.debug('Database updated for '+cur.torrentTitle);
				searchTorrents(tmdbResults,options,cb,results);return;
			}
			if(cur.hasOwnProperty('torrents')){
				Torrent.update(torrent,tcb)
			}else{
				Torrent.create(torrent,tcb);
			}
		}
	});
}

function searchParsers(query,parserIndex,cb,results){
	if(results == null){results = [];}
	parsers[parserIndex].search(query,function(res){
		results.push(res);
		parserIndex++;
		if(parserIndex < parsers.length){
			searchParsers(query,parserIndex,cb,results);
		}else{cb(results);return;}
	});
}

function filter(options,results) {
	var count = (options.hasOwnProperty('maxResults'))?options.resultCount:0;
	var minSeeders = (options.hasOwnProperty('minSeeders'))?options.minSeeders:10;
	var minSize = (options.hasOwnProperty('minSize'))?options.minSize:102400000;
	var res = [];
	for(var i=0;i<results.length;i++) {
		if(results[i].results == null){continue;}
		for(var a=0;a<results[i].results.length;a++) {
			if(results[i].results[a].size >= minSize &&
			results[i].results[a].seeders >= minSeeders) {
				res.push(results[i].results[a]);
			}
		}
	}
	res.sort(function(a,b) {
		return b.seeders - a.seeders;
	});
	if(count > 0){
		return res.slice(0,count);
	}else{
		return res;
	}
}
