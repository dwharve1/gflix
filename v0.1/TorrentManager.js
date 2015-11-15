var bc = require('node-bencode');
var fs = require('fs');
var path = require('path');
var rm = require('rimraf');
var mv = require('mv');
var exec = require('child_process').exec;

module.exports = new TorrentManager();

function TorrentManager(){
	var downloadDir = "downloads";

	this.download = function(magnet,cb) {
		_getInfo(magnet,function(info) {
			if(info == null){console.log("No info");cb(null);return;}
			_download(magnet,function(){
				cb(info);return;
			});
		});
	}
	
	var _getInfo = function(magnet,cb) {
		exec("aria2c -d "+downloadDir+" --bt-metadata-only --bt-save-metadata \""+magnet+"\"",function(error,stdout,stderr) {
			if(error){console.log(error);cb(null);return;}
			var tmp = magnet.split("btih:"); if(tmp.length<1){cb(null);return;}
			tmp = tmp[1].split("&")[0].toLowerCase();
			var file = path.resolve(path.join(downloadDir,tmp+".torrent"));
			fs.readFile(file,function (err,data){
				if(err){console.log(err);cb(null);return;}
				rm(file,function(err){if(err){console.log(err);}});
				var torrent = bc.decode(data);
				var name = torrent.info.name.toString();
				if(torrent.info.hasOwnProperty('files')){
					var files = [];
					for(var i=0;i<torrent.info.files.length;i++) {
						files.push({length:torrent.info.files[i].length,path:path.resolve(path.join(downloadDir,name,torrent.info.files[i].path.toString()))});
					}
					cb({name:name,files:files});return;
				}
				cb({name:path.resolve(path.join(downloadDir,name)),files:[]});return;
			});
		})
	}
	
	var _download = function(magnet,cb) {
		exec("aria2c -d "+downloadDir+" --seed-time=0 \""+magnet+"\"",function(error,stdout,stderr) {
			cb();return;
		});
	}
	
}

