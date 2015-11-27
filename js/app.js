var parser = document.createElement('a');
parser.href = location.href;

var app = angular.module('Flix', []);
app.controller('search',function($scope){
	$scope.Math = Math;
	$scope.searchIO = io.connect('http://'+parser.host+'/search');
	$scope.query = "";
	$scope.progress = {msg:'',percent: 0};
	$scope.search = null;
	$scope.selected = null;
			
	$scope.searchIO.on('progress',function(status){
		$scope.progress = status.progress;
		$scope.loading = status.message;
		$scope.$apply();
	});
	$scope.searchIO.on('tmdb:search',function(res){
		if(!res){
			return;
		}
		$scope.progress = res.progress;
		$scope.loading = res.message;
		if(!res.results){
			$scope.error = res.message;
			$scope.$apply();
			return;
		}
		$scope.list = res.results;
		$scope.$apply();
	});
	$scope.searchIO.on('tmdb:results',function(res){
		if(!res){
			return;
		}
		$scope.progress = res.progress;
		$scope.loading = res.message;
		if(!res.results){
			$scope.error = res.message;
			$scope.$apply();
			return;
		}
		$scope.id = res.results.id;
		$scope.title = res.results.title;
		$scope.name = res.results.name;
		$scope.overview = res.results.overview;
		$scope.image = res.results.image;
		$scope.list = res.results.list;
		$scope.playable = res.results.playable;
		$scope.url = res.results.url;
		$scope.$apply();
	});
	$scope.searchIO.on('connect',function(){
		var path = parser.pathname.split("/");
		if(path.length > 1){
			if(path[1] == 'search'){
				if(path.length == 3){
					$scope.query = unescape(path[2]);
					$scope.searchIO.emit('tmdb:search',unescape(path[2]));
				}
			}else if(path[1] == 'tv'){
				if(path.length == 5){
					$scope.searchIO.emit('tmdb:getEpisode',path[2],path[3],path[4]);
				}else if(path.length == 4){
					$scope.searchIO.emit('tmdb:listEpisodes',path[2],path[3]);
				}else if(path.length == 3){
					$scope.searchIO.emit('tmdb:listSeasons',path[2]);
				}
			}else if(path[1] == 'movie'){
				if(path.length == 3){
					$scope.searchIO.emit('tmdb:getMovie',path[2]);
				}
			}
		}
	});
});

app.controller('stream',function($scope){
	$scope.streamIO = io.connect('http://'+parser.host+'/stream');
	$scope.videoUri = null;
	$scope.label = {msg:'Connecting'};
	$scope.tmdb = null;

	$scope.streamIO.on('progress',function(obj){
		$scope.label = obj;
		$scope.$apply();
	});
	
	$scope.streamIO.on('play',function(vidUrl){
		$scope.videoUri = vidUrl;
		document.querySelectorAll('.flowplayer')[0].remove();
		document.querySelectorAll('#player')[0].innerHTML = "<div class='flowplayer'></div>";
		flowplayer(".flowplayer",{clip:{sources:[{type: "video/mp4", src: vidUrl}]}});
		$scope.$apply();
	});
	
	$scope.streamIO.on('torrents',function(tors){
		console.log(tors);
		$scope.label = null;
		$scope.tmdb = tors;
		$scope.$apply();
	});
	
	$scope.streamIO.on('connect',function(){
		var path = parser.pathname.split("/");
		if(path.length > 1){
			$scope.label = {msg:'Retrieving torrents'};
			$scope.streamIO.emit('torrentsById',path[2]);
			$scope.$apply();return;
		}
		$scope.label = {msg:'Invalid ID'};
		$scope.$apply();
	});
});
