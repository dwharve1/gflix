var app = angular.module('Flix', []);
app.controller('search',function($scope){
	var parser = document.createElement('a');
	parser.href = location.href;

	$scope.searchIO = io.connect('http://'+parser.host+'/search');
	$scope.query = "";
	$scope.progress = {msg:'',percent: 0};
	$scope.search = null;
	$scope.selected = null;
			
	$scope.searchIO.on('progress',function(status){
		$scope.progress = status;
		$scope.$apply();
	});
	$scope.searchIO.on('tmdb:search',function(err,res){
		if(err){$scope.label.msg = err; $scope.$apply();return;}
		$scope.search = res;
		$scope.$apply();
	});
	$scope.searchIO.on('tmdb:results',function(err,res){
		if(err){$scope.label.msg = err; $scope.$apply();return;}
		$scope.selected = res;
		$scope.$apply();
	});
	$scope.searchIO.on('connect',function(){
		var path = parser.pathname.split("/");
		if(path.length > 1){
			if(path[1] == 'tv'){
				if(path.length == 3){
					$scope.searchIO.emit('tmdb:listSeasons',path[2]);
				}else if(path.length == 5){
					$scope.searchIO.emit('tmdb:listEpisodes',path[2],path[4]);
				}
			}
		}
	});
});

app.controller('stream',function($scope){
	
});
