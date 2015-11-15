var fs = require('fs');
var path = require('path');

var parsersPath = 'parsers';
var parsers = [];

if(fs.existsSync(parsersPath)) {
        if(fs.lstatSync(parsersPath).isDirectory()) {
                var files = fs.readdirSync(parsersPath);
                for(var i=0;i<files.length;i++) {
                        parsers.push(require(path.resolve('.'+path.sep+path.join(parsersPath,files[i]))));
                }
        }
}

module.exports = new SearchManager();

function SearchManager() {
	var that = this;
	
	this.search = function (title,options,cb) {
		if(title == null || cb == null){return null;}
		var results = new Results(parsers.length,function(res){
			cb(filter(options,res));
		});
		for(var i=0;i<parsers.length;i++) {
			parsers[i].search(title,function(res){
				results.add(res);
			});
		}
	}
	
	var filter = function(options,results) {
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
}

function Results(count,callback) {
	var results = [];
	var count = count;
	this.add = function(result) {
		results.push(result);
		if(results.length == count) {
			callback(results);
		}
	}
}

