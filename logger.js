
module.exports = Logger;

function Logger(debug){
	var DEBUG = debug;
	
	this.log = function(msg){
		console.log("[INFO] "+now()+": "+msg);
	}
	
	this.warn = function(msg){
		console.log("[WARN] "+now()+": "+msg);
	}
	
	this.error = function(msg){
		console.error("[ERROR] "+now()+": "+msg);
	}
	
	this.debug = function(msg){
		if(DEBUG){
			console.log("[DEBUG] "+now()+": "+msg);
		}
	}
	
	function now(){
		return (new Date()).toISOString().replace(/T/,' ').replace('/\..+/,'');
	}
}
