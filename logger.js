var DEBUG = true;

module.exports = new Logger();

function Logger(){
	this.log = function(msg){console.log(Date.now()+': '+msg);}
	this.error = function(msg){console.log(Date.now()+' ERROR: '+msg);}
	this.warn = function(msg){console.log(Date.now()+' WARN: '+msg);}
	this.debug = function(msg){if(DEBUG){console.log(Date.now()+' DEBUG: '+msg);}}
}
