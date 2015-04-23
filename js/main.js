/* Map tiles providers
http://otile2.mqcdn.com/tiles/1.0.0/osm/{z}/{x}/{y}.png
http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png
 */
var server = 'travel-domajno.rhcloud.com',
//var server = 'localhost:5000',
 	 number_of_blog_views = 0;

$(function () {

    var map = L.map('map').setView([31, 85], 3);

    // Try to set map's longitude according to users position; 
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(setLongitude);
    }
    function setLongitude(position) {
    	map.setView([map.getCenter().lat, position.coords.longitude], map.getZoom());
    }


    L.tileLayer('//{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: 'Map data &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors, <a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, Imagery © <a href="http://cloudmade.com">CloudMade</a>',
        maxZoom: 8,
        minZoom: 2
    }).addTo(map);

    var getVisibleMap = function(){
        var bounds = map.getBounds();
        return '[[' + bounds['_southWest']['lng'] + ',' + bounds['_southWest']['lat'] + '],[' + bounds['_northEast']['lng'] + ',' + bounds['_northEast']['lat'] + ']]'
    }

    // Initialize main components.
    var articlesManager = articlesFetcher(),
    	mapManager = new mapClustersManager().map(map).articlesManager(articlesManager);

    // Call mapManager when map is moved or zoomed
    map.on('zoomend', function(evt) {
        mapManager();
    });
    map.on('moveend', function(evt) {
       mapManager(); 
    });
    mapManager();
	
	// Detect when user scrolls to the bottom and load more articles.
	$('#right-panel').scroll(function() {
		// REMOVED Math.abs from this condition
		if($('#right-panel')[0].scrollHeight - $('#right-panel').outerHeight() - $('#right-panel').scrollTop() < 5) {
			if(mapManager.articlesManager().hasMore()) {
				mapManager.articlesManager()();
			}
		}
	});
	
	//
	$('#menu').bind('mouseenter', function() {
		if ($( "#menu" ).css("right") === '-100px') {
			$( "#menu" ).animate({ right: "0px" }, 250, function() {
				// Animation complete.
			});
		}
	});
	$('#menu').bind('mouseleave', function() {		
		$( "#menu" ).animate({ right: "-100px" }, 400, function() {
			// Animation complete.
		});		
	});
	
	$('#menu-home').bind('click', function() {		
		$('#intro').show();
		$('#articles').hide();
	});

	$('#menu-feedback').bind('click', function() {		
		$('#left-panel').removeClass().addClass("feedback")
	});

	$('#menu-map').bind('click', function() {		
		$('#left-panel').removeClass().addClass("map")
	});

	$('#menu-register').bind('click', function() {		
		$('#left-panel').removeClass().addClass("register")
	});

	$('#feedback-submit-btn').bind('click', function() {	
		var data = $('#feedback-form').serializeArray().reduce(function(a,b){if(a[b.name]) {a[b.name].push(b.value) } else {a[b.name] = [b.value]}; return a;},{}),
			dataString = '';
		for(e in data) {
			dataString += e + '\n';
			data[e].forEach(function(d){ dataString += '\t' + d + '\n';});
		}
		$.post("//" + server + "/api/feedback/", dataString);
		$('#left-panel').addClass("map");
		$("#message").show().text("Thank you for your feedback");
		$('#feedback').animate({ opacity: 0 }, function () { $('#left-panel').removeClass('feedback'); $('#feedback').css('opacity', 100); $("#message").fadeOut(2000);});
		_gaq.push(['_trackEvent', 'feedback', 'submission', 'feedback', (data.newsletter[0]?2:1)]);
	});

	$('#register-submit-btn').bind('click', function() {				
		$.post("//" + server + "/api/register/", $('#register-form').serializeArray());
		$('#left-panel').addClass("map");
		$("#message").show().text("Thank you for registering");
		$('#register').animate({ opacity: 0 }, function () { $('#left-panel').removeClass('register'); $('#register').css('opacity', 100);  $("#message").fadeOut(2000);});
		_gaq.push(['_trackEvent', 'registration', 'submission', 'blog', 1]);
	});

});

var articlesFetcher = function(){
	/*
	 * Component responsible for fetching articles from given cluster.
	 * When called with cluster_id parameter it gets first 10 articles
	 * Whe called without cluster_id parameter it gets next 10 articles.
	 * If there are no more articles to return it does nothing and returns.
	 */

	var url = '//' + server + '/api/articles/',
		skip = 0,
		cluster = undefined,
		count = 0;
	
	var main = function(cluster_id){
		
		if (cluster === cluster_id)
			return
	
		if (cluster_id == undefined) {
			skip += 10;
		} else {
			skip = 0;
			cluster = cluster_id;
		}
		
		if (cluster == undefined)
			return
	
		$.ajax({
            url: url + cluster + "/?skip=" + skip,
            success: function( response ) {
				
				if (response.length === 0) {
					cluster = undefined;
					return;
				}
			
                var out = [];
                response.forEach(function(article){
					var analyticsEvent = 'onClick="number_of_blog_views += 1; _gaq.push([\'_trackEvent\', \'blog\', \'visit\', \'blog\', number_of_blog_views]);"',
					html = '<div class="article">' +
							   '<a class="article-title" href="' + article.link + '" target="_blank" ' + analyticsEvent + '>' + article.title + '</a>' +
							   '<div class="article-url">' + article.link + '</div>' +
							   '<div class="article-footer">' +
							   '<span>' + new Date(article.date).toGMTString().substr(5,11) + '</span>' +
							   '<span class="by" style="margin-left:2em;">by</span>' +
							   '<span style="margin-left:0.4em;">' + article.author + '</span>' +
							   '<span class="report-incorrect">!</span>' +
							   '</div></div>';					
                    out.push(html);

                    // For debugging purposes only - if "decision" key is in the article then it means we are in the debugging mode.
                    if (article["decision"]) {						
						var html = '<div class="debug-info">' +	
							   '<div style="white-space:pre; font-size:x-small;">' + JSON.stringify(article.decision, undefined, 2) + '</div>' +
							   '</div>';					
                    	out.push(html);
					}
                });
				
				if (skip === 0) {
					$('#articles').html(out.join(''));
					// TODO scroll div to the top
				} else {
					$('#articles').html($('#articles').html() + out.join(''));
				}
				
				// If scrollbar not present we can load next 10 articles
				if ($('#right-panel')[0].scrollHeight <= $('#right-panel').outerHeight()) {
					main();
					$('#right-panel').css("margin-right", "60px");
				} else {
					// Adjusting this margin is hiding the scrollbar under menu div.
					$('#right-panel').css("margin-right", "40px");
				}
            }
        });
	
	}
	
	main.hasMore = function() {
		return cluster !== undefined;
	}
	
	return main;

}

var mapClustersManager = function(){
	/*
	 * Component responsible for fetching clusters
	 */

	var url = '//' + server + '/api/clusters/',
		map = null,
		articlesManager = null,
		currently_visible_tiles = [],
		entering_data_tiles = [],
		current_zoom_level = 1,
		division_number = {	1: 1, 2: 2, 3: 3, 4: 4, 5: 1, 6: 1, 7: 1, 8: 1 }, // e.g. zoom level 3 is divided in 9 parts - 3x3
		markers = {1:{}, 2:{}, 3:{}, 4:{}, 5:{}, 6:{}, 7:{}, 8:{}, 9:{}, 10:{}, 11:{}},
		click_count = 0;
	
	var main = function(){

		// If we change zoom level: remove all markers from current zoom level, set currently visible tiles to [].
		if(current_zoom_level !== map.getZoom()) {			
			console.log('[DEBUG] Changing zoom level - removing all markers.');
			for (var key in markers[current_zoom_level]) {
 				removeTile(key, current_zoom_level, true);
			}
			currently_visible_tiles = [];
		}
		current_zoom_level = map.getZoom();

		// Detect which tiles are new and get the data
		entering_data_tiles = getVisibleDataTiles();
		entering_data_tiles.forEach(function (tile) {
			if (currently_visible_tiles.indexOf(tile) < 0) {
				fetchTile(tile);
			}
		});
		// Detect which tiles are old and remove the markers.
		currently_visible_tiles.forEach(function(tile) {
			if(entering_data_tiles.indexOf(tile)<0) {
				removeTile(tile, current_zoom_level);
			}
		});
		currently_visible_tiles = entering_data_tiles;
	}

	var getVisibleDataTiles = function () {
		/* Returns list of id's of the visible data tiles on the map.
		 */

		var bounds = map.getBounds();

    	// If we see more than whole map set bounds to [[-180, -90],[180, 90]]
    	bounds['_southWest']['lng'] = bounds['_southWest']['lng'] < -180 ? -180 : bounds['_southWest']['lng'];
    	bounds['_southWest']['lng'] = bounds['_southWest']['lng'] >  179.9 ?  179.9 : bounds['_southWest']['lng'];
    	bounds['_southWest']['lat'] = bounds['_southWest']['lat'] < -90  ?  -90 : bounds['_southWest']['lat'];
    	bounds['_southWest']['lat'] = bounds['_southWest']['lat'] >  90  ?   90 : bounds['_southWest']['lat'];
    	bounds['_northEast']['lng'] = bounds['_northEast']['lng'] >  179.9 ?  179.9 : bounds['_northEast']['lng'];
    	bounds['_northEast']['lng'] = bounds['_northEast']['lng'] < -180 ? -180 : bounds['_northEast']['lng'];
    	bounds['_northEast']['lat'] = bounds['_northEast']['lat'] >   90 ?   90 : bounds['_northEast']['lat'];
    	bounds['_northEast']['lat'] = bounds['_northEast']['lat'] <  -90 ?  -90 : bounds['_northEast']['lat'];

    	var current_division_number = division_number[map.getZoom()],
    		tile_width = 360/current_division_number,
    		tile_height = 180/current_division_number,
    		northEast_column = Math.floor(Math.abs(-180 - bounds['_northEast']['lng'])/tile_width),
    		northEast_row = Math.floor(Math.abs(90 - bounds['_northEast']['lat'])/tile_height),
    		southWest_column = Math.floor(Math.abs(-180 - bounds['_southWest']['lng'])/tile_width),
    		southWest_row = Math.floor(Math.abs(90 - bounds['_southWest']['lat'])/tile_height),
    		southWest_id = southWest_row * current_division_number + southWest_column,
    		northEast_id = northEast_row * current_division_number + northEast_column,
    		northWest_id = northEast_row * current_division_number + southWest_column,
    		southEast_id = southWest_row * current_division_number + northEast_column,
    		width = northEast_id - northWest_id +1,
    		visible_data_tiles = [];
    
    	// Select all tiles between northWest_id and southEast_id that are visible
    	// iterate rows first and then for each row take cells
    	for (var i = northWest_id; i <= southWest_id; i += current_division_number) {
    		for (var j = i; j < i + width; j++){
    			visible_data_tiles.push(j);
    		}
    	}

    	return visible_data_tiles;
	}
	
	var fetchTile = function(id) {

		var zoom = current_zoom_level;

		data = null;
		if(sessionStorage)
			// get clusters from cache
			data = sessionStorage.getItem(zoom + '_' + id);
		if(data !== null) {
			console.log('[DEBUG] getting data from sessionStorage. zoom level ' + zoom + ' cluster id ' + id);
			if(zoom === map.getZoom() && entering_data_tiles.indexOf(id) >= 0)
				displayMarkers(JSON.parse(data), id, zoom);
		} else {
			// get clusters from the server
			console.log('[DEBUG] getting data from the SERVER. zoom level ' + zoom + ' cluster id ' + id);
			$.ajax({
	            url: url + zoom + "/" + id + "/" + division_number[zoom] + "/",
	            success: function( response ) {

					if(zoom === map.getZoom() && entering_data_tiles.indexOf(id) >= 0)
						displayMarkers(response, id, zoom);
					
					// Save into cache
					if (sessionStorage) {
						sessionStorage.setItem(zoom + '_' + id, JSON.stringify(response));
					}
	            }
	        });
		}
	}

	var removeTile = function(id, zoom_level, isAnimated) {
		// Removes markers from tile id from the map.
		console.log('[DEBUG] removing unvisible markers. zoom level ' + zoom_level + ' cluster id ' + id);
		if(isAnimated) {
			markers[zoom_level][id].map(function(m){ $(m._icon).fadeOut(400, function () { map.removeLayer(m); })});
		} else {
			markers[zoom_level][id].map(function(m){ map.removeLayer(m); });
		}
		delete markers[zoom_level][id];
	}

	var displayMarkers = function(data, id, zoom_level) {
		// Display markers
		markers[zoom_level][id] = [];
		data.forEach(function (object) {
	        if(object.centroid && object.centroid[0] > -200 && object.centroid[1] > -200){
	            var m = L.marker([object.centroid[1], object.centroid[0]],
	                                {icon: 		L.divIcon({className: 'cluster-marker',
	                                 html: 		object.size,
	                                 iconSize: 	['',''],
	                                 iconAnchor:[16,16],
	                             	 riseOnHover: true}
	                                                 )}).addTo(map);
				// TODO attach this event to the parent div of the markers and use target of the event
	            m.on('click', function(e) {
					$('#intro').hide();
					$('#articles').show();
	                articlesManager(object.id);

	                // Google analytics event
	                click_count += 1;
	                _gaq.push(['_trackEvent', 'map', 'click', 'map', click_count]);						
	            });
	            markers[zoom_level][id].push(m);
	        } else {
	            console.log('empty or wrong coordinates');
	        }
	    });
	}

	main.map = function(value) {
	    if (!arguments.length) return map;
	    map = value;
	    return main;
	};

	main.articlesManager = function(value) {
	    if (!arguments.length) return articlesManager;
	    articlesManager = value;
	    return main;
	};

	main.markers = function() {
	    return markers;
	};
	
	return main;

}