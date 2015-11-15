module.exports = Logger;

function Logger(){
	this.info = function(msg){
		console.log("[INFO] "+now()+": "+msg);
	}
	
	this.warn = function(msg){
		console.log("[WARN] "+now()+": "+msg);
	}
	
	this.error = function(msg){
		console.error("[ERROR] "+now()+": "+msg);
	}
	
	function now(){
		return (new Date()).toISOString().replace(/T/,' ').replace('/\..+/,'');
	}
}
