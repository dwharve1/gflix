var https = require('https');
var pbsearch = "https://thepiratebay.se/search/";
var pbargs = "/0/99/0";
var filetypes = ['mp4','avi','mkv'];

module.exports = new PirateBay();

function PirateBay() {
        var that = this;
        this.search = function(title,cb) {
                https.get(pbsearch+escape(title)+pbargs, function(res) {
                        var body = '';
                        res.on('data', function(d){body+=d;});
                        res.on('end', function(){
                                var results = body.split("searchResult\">");
				if(results.length < 1){console.log("Parse error (thepiratebay.se)");cb({site:"thepiratebay.se",results:null});return;}
				if(results[0].match("No hits.") != null){cb({site:"thepiratebay.se",results:null});return;}
                                if(results.length < 2){console.log("Parse error (thepiratebay.se)");cb({site:"thepiratebay.se",results:null});return;}
                                results = results[1].split("</tbody>")[0];
                                results = results.split("<div class=\"detName\"> ");
                                if(results.length < 2){console.log("Parse error (thepiratebay.se)");cb({site:"thepiratebay.se",results:null});return;}
								var res = [];
								for(var i=1;i<results.length;i++) {
									var tmp = new torrent();
										tmp.title = results[i].substring(results[i].search(/>/)+1,results[i].search(/<\//)).replace(/\./g," ");
										if(that.isSupported(tmp.title)) {
											tmp.name = tmp.title.match(/[\W\w]+(?=\ss\d\de\d\d)/i)[0];
											if(tmp.title.match(/[\W\w]+s\d\de\d\d/i)[0].toLowerCase() != title.match(/[\W\w]+s\d\de\d\d/i)[0].toLowerCase()){continue;}
											tmp.link  = results[i].match(/magnet:[\W\w]+(?="\stitle="Download)/)[0];
											tmp.seeders = parseInt(results[i].match(/right">\d+<\/td>/)[0].match(/\d+/)[0]);
											tmp.size = results[i].match(/\d+\.{0,1}\d{0,1}&nbsp;\w\w\w/)[0].split(/&nbsp;/);
											tmp.size = convertSize(tmp.size[0],tmp.size[1]);
											tmp.plex = tmp.name+" "+tmp.title.match(/s\d\de\d\d/i)[0].toLowerCase();
											res.push(tmp);
                                        }
                                }
								if(res.length == 0){res = null;}
                                cb({site:"thepiratebay.se",results:res});return;
                        });
			res.on('error',function(err){
				console.log(err);
			});
                })
        }

        this.isSupported = function(title) {
                return (title.match(/[\W\w]+s\d\de\d\d[\W\w]+HDTV(?:\s|\.)x264/i) != null);
        }
		
		var convertSize = function(num,type){
			var n = parseInt(num);
			switch(type){
				case 'GiB':
					n *= 1000;
				case 'MiB':
					n *= 1000;
				case 'KiB':
					n *= 1000;
					break;
				default:
					break;
			}
			return n;
		}
}

function torrent() {
	var that = this;

	this.match = function(file) {
		var name = file.replace(/\./g," ").match(/[\W\w]+s\d\de\d\d/i);
		if(name != null) {
			if(that.title.match(/[\W\w]+s\d\de\d\d/i)[0] == name[0]) {
				return true;
			}
		}
		return false;
	}
}



