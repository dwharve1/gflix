var log = require('./logger.js');

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
var tmdb = require('moviedb')('ae171aa864156acb87af501e1dcf2d84');
//var tvdb = new (require('node-tvdb'))("6BBEDAE780DC7C68");
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
	tmdbId: Number,
	magnet: String,
	timeStamp: Date
});

var Torrent = mongoose.model('Torrent', torrentSchema);

module.exports = new SearchManager();

function SearchManager() {
	var that = this;

	this.search = function(query,options,cb){
		searchTmdb(query,function(err,res){
			if(err){cb(err);return;}
			queryTorrents(res,function(err, res){
				if(err){cb(err);return;}
				searchTorrents(res,options,function(res){
					cb(null,res);return;
				});
			});
		});
	}
	this.listSeasons = function(tmdbId,cb){
		getSeasons(tmdbId,cb);
	}
	this.listEpisodes = function(name, tmdbId,seasonId,options,cb){
		getEpisodes(name, tmdbId,seasonId,function(err,res){
			if(err){cb(err);return;}
			queryTorrents(res,function(err,res){
				if(err){cb(err);return;}
				searchTorrents(res,options,function(res){
					cb(null,res);return;
				});
			});
		});
	}
}

function getEpisodes(name, tmdbId, seasonId, cb){
	log.debug('Fetching episodes');
	request({
		method:'GET',
		url: 'http://api.themoviedb.org/3/tv/'+tmdbId+'/season/'+seasonId+'?api_key=ae171aa864156acb87af501e1dcf2d84',
		headers: {'Accept': 'application/json'}},
		function(err,res){
			if(err){log.error(err);cb(err);return;}
			log.debug('Status: '+res.statusCode);
			var json = JSON.parse(res.body);
			for(var i=0;i<json.episodes.length;i++){
				json.episodes[i].title = name;
			}
			cb(null,json.episodes);
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
					tmdbResults[i]['torrent'] = res[a];
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
	if(tmdbResults.length == 0){cb(results);return;}
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
	if(cur.hasOwnProperty('torrent')){
		// Was the torrent information obtained withing the last 24 hours?
		if(Date.now() - cur.torrent.timeStamp < 86400000){
			// Torrent property set without a link means there is no torrent for the media
			if(cur.torrent.magnet != null){results.push(cur);}
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
	var q = cur.title;
	if(cur.hasOwnProperty('release_date') && !cur.hasOwnProperty('episode_number')){
		if(cur.release_date != null){ q += ' '+cur.release_date.split('-')[0];}
	}else if(cur.hasOwnProperty('episode_number') && cur.hasOwnProperty('season_number')){
		if(cur.episode_number != null && cur.season_number != null){
			var s = (cur.season_number < 10)?'0'+cur.season_number:cur.season_number;
			var e = (cur.episode_number < 10)?'0'+cur.episode_number:cur.episode_number;
			q += ' s'+s+'e'+e;
		}
	}
	log.debug('Searching parsers for '+q);
	// Query parsers
	searchParsers(q,0,function(res){
		res = filter(options,res);
		log.debug('Found '+res.length+' torrents for '+q);
		if(res.length > 0){
			// Update database with highest seeded magnet link
			var torrent = {tmdbId: cur.id, timeStamp: Date.now(), magnet: res[0].link};
			var tcb = function(){
				log.debug('Database updated for '+q);
				cur['torrent'] = torrent;
				results.push(cur);
				if(tmdbResults.length == 0){cb(results);return;}
				else{searchTorrents(tmdbResults,options,cb,results);return;}
			}
			if(cur.hasOwnProperty('torrnet')){
				Torrent.update(torrent,tcb)
			}else{
				Torrent.create(torrent,tcb);
			}
		}else{
			// Update database with empty magnet link
			var torrent = {tmdbId: cur.id, timeStamp: Date.now(), magnet: null};
			var tcb = function(){
				log.debug('Database updated for '+q);
				if(tmdbResults.length == 0){cb(results);return;}
				else{searchTorrents(tmdbResults,options,cb,results);return;}
			}
			if(cur.hasOwnProperty('torrnet')){
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
	var count = (options.hasOwnProperty('maxResults'))?options.resultCount:1;
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
	return res.slice(0,count);
}
