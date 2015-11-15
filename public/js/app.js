var searchApp = angular.module('Flix', []);
app.controller('search',function($scope){
	$scope.searchIO = io.connect(location.href+'search');
	$scope.query = "";
	$scope.progress = {msg:'',percent: 0};
	$scope.tmdb = null;
			
	$scope.searchIO.on('progress',function(status){
		$scope.progress = status;
		$scope.$apply();
	});
	$scope.searchIO.on('tmdb:search',function(err,res){
		if(err){$scope.label.msg = err; $scope.$apply();return;}
		$scope.tmdb = res;
		$scope.$apply();
	});
	$scope.searchIO.on('tmdb:seasons',function(err,res){
		if(err){$scope.label.msg = err; $scope.$apply();return;}
		if($scope.selected){
			$scope.selected['seasons'] = res;
		}
		$scope.$apply();
	});
	$scope.searchIO.on('tmdb:episodes',function(err,res){
		if(err){$scope.label.msg = err; $scope.$apply();return;}
		console.log(res);
		if($scope.selected){
			$scope.selected['episodes'] = res;
		}
		$scope.$apply();
	});
});

app.controller('stream',function($scope){
	
});
