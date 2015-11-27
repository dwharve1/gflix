var log = new (require('./logger.js'))(true);
var ts = require('torrent-stream');
var mime = require('mime');
var rangeParser = require('range-parser');
var pump = require('pump');
var rimraf = require('rimraf');

module.exports = new StreamManager();

function StreamManager(){
	var that = this;
	var torrents = [];
	
	this.start = function(magUri,options,cb){
		if(magUri){
			log.debug("stream: start requested for magnet: "+magUri);
			var tor = ts(magUri,options);
			tor['infoHash'] = that.parseInfoHash(magUri);
			torrents.push(tor);
			tor.on('ready',function(){
				if(that.exists(that.parseInfoHash(magUri))){
					log.debug("stream: torrent("+that.parseInfoHash(magUri)+") ready");
					cb();
				}else{
					log.debug("stream: torrent("+that.parseInfoHash(magUri)+") started but removed");
					cb(true);
				}
			});
		}
	}
	
	this.stream = function(req,res){
		//Check for infoHash
		if(req.params.infoHash){
			log.debug("stream: stream requested for infoHash: "+req.params.infoHash);

			//Check for torrent
			var tid = getIdByInfoHash(req.params.infoHash);
			if(tid != null){
				log.debug("stream: found torrent("+req.params.infoHash+") with id: "+tid);

				//Select file to stream
				var file = getFile(tid);
				if(file != null){
					log.debug("stream: automatically selected file: "+file.name);

					//Set response headers
					res.statusCode = 200;
					res.setHeader('Accept-Ranges','bytes');
					res.setHeader('Content-Type', mime.lookup(file.name));
					res.setHeader('transferMode.dlna.org','Streaming');
					res.setHeader('contentFeatures.dlna.org','DLNA.ORG_OP=01;DLNA.ORG_CI=0;DLNA.ORG_FLAGS=01700000000000000000000000000000');
					if(req.headers.range){
						
						//Partial content request, set range
						res.statusCode = 206;
						var range = rangeParser(file.length,req.headers.range)[0];
						res.setHeader('Content-Range','bytes '+range.start+'-'+range.end+'/'+file.length);
						res.setHeader('Content-Length',range.end-range.start+1);
						log.debug("stream: range("+req.headers.range+") requested, setting file range (start: "+range.start+", end: "+range.end+")");
					}else{
						res.setHeader('Content-Length',file.length);
					}
					if(req.method === 'HEAD'){res.end()};
					/*ffmpeg(file.createReadStream(range))
						.format('dash')
						//.videoBitrate('48')
						//.videoCodec('libvpx')
						//.size('?x720')
						//.audioBitrate('48')
						//.audioCodec('libvorbis')
						//.outputOptions(['-crf 20'])
						.on('error',function(err){
							log.debug(err.message);
						})
						.pipe(res, {end:true});*/
					
					//Pump stream to response
					log.debug("stream: sending stream");
					pump(file.createReadStream(range), res);
				}else{
					log.error("stream: unable to automatically select a file");
					res.sendStatus(404).end();
				}
			}else{
				log.error("stream: no torrent found for infoHash");
				res.sendStatus(404).end();
			}
		}else{
			log.error("stream: no infoHash provided");
			res.sendStatus(404).end();
		}
	}
	
	this.remove = function(infoHash){
		//Get torrent index
		var tid = getIdByInfoHash(infoHash);
		if(tid != null){
			log.debug("stream: removing torrent("+infoHash+")");
			torrents[tid].destroy(function(){
				//Manually delete torrent folder
				rimraf('/tmp/torrent-stream/'+torrents[tid].infoHash+'*',function(err){
						//Remove torrent element from torrent array
						torrents.splice(tid,1);
					if(err){
						log.error('stream: error removing torrent('+tid+'): '+err);
					}
				});
			});
		}
	}
	
	this.parseInfoHash = function(magUri){
		if(magUri){
			var tmp = magUri.split("btih:");
			if(tmp.length > 1){
				tmp = tmp[1].split("&");
				if(tmp.length > 0){
					log.debug("stream: infoHash: "+tmp[0].toLowerCase());
					return tmp[0].toLowerCase();
				}
			}
		}
		log.error("stream: unable to parse infoHash from magnet");
		return null;
	}

	this.getInfoHashes = function(){
		var res = [];
		for(var i=0;i<torrents.length;i++){
			res.push(torrents[i].infoHash);
		}
		return res;
	}
	
	this.exists = function(infoHash){
		return (getIdByInfoHash(infoHash) != null);
	}
	
	var getFile = function(tid){
		//Get index of largest file within torrent
		//TODO: support multiple episodes in torrent
		var fid = null;
		var len = 0;
		for(var i=0;i<torrents[tid].files.length;i++){
			fid = (torrents[tid].files[i].length > len)?i:fid;
			len = (torrents[tid].files[i].length > len)?torrents[tid].files[i].length:len;
		}
		return (fid != null)?torrents[tid].files[fid]:null;
	}

	var getIdByInfoHash = function(infoHash){
		log.debug("stream: getIdByInfoHash:");
		for(var i=0;i<torrents.length;i++){
			log.debug("		"+torrents[i].infoHash);
			if(torrents[i].infoHash == infoHash){return i;}
		}
		return null;
	}
}
