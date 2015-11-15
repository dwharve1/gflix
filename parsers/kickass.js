var log = require('../logger.js');
var http = require('http');
var pbsearch = "http://kickasstorrents.to/search.php?key=";
var filetypes = ['mp4','avi','mkv'];

module.exports = new KickAss();

function KickAss() {
	var that = this;
	this.search = function(title,cb) {
		http.get(pbsearch+escape(title), function(res) {
			var body = '';

			res.on('data', function(d){body+=d;});

			res.on('end', function(){
				var results = [];
				var torrents = scrapeFields(body);
				
				var titleMatch = title.replace(/[^a-z0-9\s]/gi,' ').replace(/\s\s/g,' ').toLowerCase();
				
				for(var i=0;i<torrents.length;i++){
					if(isSupported(torrents[i].title)) {
						var match = (torrents[i].tv)?(torrents[i].tv == titleMatch):(torrents[i].movie == titleMatch);
						if(match){results.push(torrents[i]); log.debug('kickasstorrents.to: Match: Query: '+titleMatch+' | TV: '+torrents[i].tv+' | '+torrents[i].movie+' | Title: '+torrents[i].title);}
						else{log.debug('kickasstorrents.to: No match: Query: '+titleMatch+' | TV: '+torrents[i].tv+' | '+torrents[i].movie+' | Title: '+torrents[i].title);}
					}
				}
				log.debug('kickasstorrents.to: '+results.length+' matches');
				cb({site:"kickasstorrents.to",results:results});return;
			});

			res.on('error',function(err){
				log.error(err);
			});
		})
	}
}

function convertSize(num,type){
	var n = parseInt(num);
	switch(type){
		case 'GB':
			n *= 1000;
		case 'MB':
			n *= 1000;
		case 'KB':
			n *= 1000;
			break;
		default:
			break;
	}
	return n;
}

function isSupported(title) {
	return (title.match(/[\W\w]+\ss\d\de\d\d[\W\w]*HDTV/i) != null ||
		title.match(/[\W\w]+\S*\d{4}[\W\w]+(?:BDRip|Bluray|BrRip|HDRip|XviD|DVDRip)[\W\w]+/i) != null);
}

function scrapeFields(body){
	var torrents = body.split("mainSearchTable\">");
	if(torrents.length < 2){log.error('kickasstorrents.to: Unable to parse body');return;}
	
	torrents = torrents[1].split("</tbody>");
	if(torrents.length < 1){log.error('kickasstorrents.to: Unable to parse body end'); return;}

	torrents = torrents[0].split("id=\"torrent_");
	var res = [];
	for(i=1;i<torrents.length;i++) {
		var tmp = {};
		tmp.title = torrents[i].substring(torrents[i].search(/cellMainLink">/)+14,
				torrents[i].indexOf("</a",
					torrents[i].search(/cellMainLink"/)
				)
			)
			.replace(/\./g," ")
			.replace(/<strong class="red">|<\/strong>/g,'')
			.replace(/[^a-z0-9\s]/gi,' ')
			.replace(/\s\s/g,' ');
		
		tmp.name = tmp.title.match(/[\W\w]+(?=\ss\d\de\d\d|\s\d{4}\s)/i);
		if(!tmp.name){log.debug('kickasstorrents.to: Unable to parse name: '+tmp.title);continue;}
		tmp.name = tmp.name[0];
		
		tmp.year = (tmp.title.match(/\d{4}(?=[^p])/))?tmp.title.match(/\d{4}(?=[^p])/)[0]:null;
		tmp.tv = (tmp.title.match(/s\d\de\d\d/i))?tmp.name.toLowerCase()+' '+tmp.title.match(/s\d\de\d\d/i)[0].toLowerCase():null;
		tmp.movie = (!tmp.tv)?tmp.name.toLowerCase()+' '+tmp.year:null;
		
		var tdel = (torrents[i].match(/magnet:\\?/))?"magnet:?":"magnet%3A%3F";
		tmp.link = torrents[i].split(tdel);
		if(tmp.link.length < 2){log.debug('kickasstorrents.to: Unable to parse magnet link');continue;}
		tmp.link = tmp.link[1].split(/['"]/);
		if(tmp.link.length < 1){log.debug('kickasstorrents.to: Unable to parse magnet link end');continue;}
		tmp.link = 'magnet:?'+tmp.link[0];
		
		tmp.seeders = parseInt(torrents[i].substring(torrents[i].search("green center\">")+14,torrents[i].indexOf("</td>",torrents[i].search("green center\">"))));
		tmp.size = torrents[i].substring(torrents[i].search("nobr center\">")+13,torrents[i].indexOf("</td>",torrents[i].search("nobr center\">"))).replace(/(<([^>]+)>)/ig,"").split(" ");
		if(tmp.size.length < 2){log.debug('kickasstorrents.to: Unable to parse size');continue;}
		tmp.size = convertSize(tmp.size[0],tmp.size[1]);
		
		res.push(tmp);
	}
	return res;
}