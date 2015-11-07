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
				var results = getSplit(body,"mainSearchTable\">",1);
				if(results == null){
					console.log("Parse error (kickasstorrents.to)");
					cb({site:"kickasstorrents.to",results:null});
					return;
				}
				results = getSplit(results,"</tbody>",0);
				if(results == null){
					console.log("Parse error (kickasstorrents.to)");
					cb({site:"kickasstorrents.to",results:null});
					return;
				}
				results = results.split("id=\"torrent_");
				var res = [];
				for(i=1;i<results.length;i++) {
					var tmp = new torrent();
					tmp.title = results[i].substring(results[i].search(/cellMainLink">/)+14,results[i].indexOf("</a",results[i].search(/cellMainLink"/))).replace(/\./g," ").replace(/<strong class="red">|<\/strong>/g,'');
					if(that.isSupported(tmp.title)) {
						tmp.name = tmp.title.match(/[\W\w]+(?=\ss\d\de\d\d)/i)[0];
						if(tmp.title.match(/[\W\w]+s\d\de\d\d/i)[0].toLowerCase() != title.match(/[\W\w]+s\d\de\d\d/i)[0].toLowerCase()){continue;}
						tmp.link  = results[i].substring(results[i].search("magnet:"),results[i].indexOf("\" ",results[i].search("magnet:")));
						tmp.seeders = parseInt(results[i].substring(results[i].search("green center\">")+14,results[i].indexOf("</td>",results[i].search("green center\">"))));
						tmp.size = results[i].substring(results[i].search("nobr center\">")+13,results[i].indexOf("</td>",results[i].search("nobr center\">"))).replace(/(<([^>]+)>)/ig,"").split(" ");
						tmp.size = convertSize(tmp.size[0],tmp.size[1]);
						tmp.plex = tmp.name+" "+tmp.title.match(/s\d\de\d\d/i)[0].toLowerCase();
						res.push(tmp);
					}
				}
				cb({site:"kickasstorrents.to",results:res});return;
			});
			res.on('error',function(err){
				console.log(err);
			});
		})
	}

	this.isSupported = function(title) {
			return (title.match(/[\W\w]+s\d\de\d\d[\W\w]+HDTV(?:\s|.)x264/i) != null);
	}

	var convertSize = function(num,type){
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
}

function getSplit(data,term,indice) {
	var tmp = data.split(term);
	if(tmp.length > indice){ return tmp[indice]; }
	return null;
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


