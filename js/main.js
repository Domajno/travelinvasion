let numberOfBlogViews = 0; // eslint-disable-line prefer-const

(function travelInvasion($, L) {
  'use strict';
  const server = 'ti-domajno.rhcloud.com';
  let isMobile = false;

  function articlesFetcher() {
    /*
     * Component responsible for fetching articles from given cluster.
     * When called with clusterId parameter it gets first 10 articles
     * Whe called without cluster_id parameter it gets next 10 articles.
     * If there are no more articles to return it does nothing and returns.
     */

    const url = `//${server}/api/articles/`;
    let skip = 0;
    let cluster = undefined;

    const main = function mainFunc(clusterId) {
      $('#right-panel').addClass('active');

      if (cluster === clusterId) {
        return;
      }

      if (clusterId === undefined) {
        skip += 10;
      } else {
        skip = 0;
        cluster = clusterId;
      }

      if (cluster === undefined) {
        return;
      }

      $.ajax({
        url: `${url}${cluster}/?skip=${skip}`,
        success: function success(response) {
          if (response.length === 0) {
            cluster = undefined;
            return;
          }

          const out = [];
          response.forEach(article => {
            const analyticsEvent = `onClick="numberOfBlogViews += 1;
              _gaq.push(['_trackEvent', 'blog', 'visit', 'blog', numberOfBlogViews]);"`;
            const html = `<div class="article">
              <a class="article-title" href="${article.link}" target="_blank" ${analyticsEvent}>
                ${article.title}
              </a>
              <div class="article-url">${article.link}</div>
              <div class="article-footer">
              <span>${new Date(article.date).toGMTString().substr(5, 11)}</span>
              <span class="by" style="margin-left:2em;">by</span>
              <span style="margin-left:0.4em;">${article.author}</span>
              <span class="report place" title="Report incorrect place"/>
              <span class="report content" title="Report content"/>
              </div></div>`;

            out.push(html);
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
            $('#right-panel').css('margin-right', isMobile ? '0' : '60px');
          } else {
            // Adjusting this margin is hiding the scrollbar under menu div.
            $('#right-panel').css('margin-right', isMobile ? '0' : '40px');
          }
        }
      });
    };

    main.hasMore = function hasMore() {
      return cluster !== undefined;
    };

    return main;
  }

  function mapClustersManager() {
    /*
     * Component responsible for fetching clusters
     */

    const url = `//${server}/api/clusters/`;
    let map = null;
    let articlesManager = null;
    let currentlyVisibleTiles = [];
    let enteringDataTiles = [];
    let currentZoomLevel = 1;
    let clickCount = 0;

    // e.g. zoom level 3 is divided in 9 parts - 3x3
    const divisionNumber = { 1: 1, 2: 2, 3: 3, 4: 4, 5: 1, 6: 1, 7: 1, 8: 1 };
    const markers = { 1: {}, 2: {}, 3: {}, 4: {}, 5: {},
      6: {}, 7: {}, 8: {}, 9: {}, 10: {}, 11: {} };

    function removeTile(id, zoomLevel, isAnimated) {
      // Removes markers from tile id from the map.
      console.info(`Removing unvisible markers. zoom level ${zoomLevel} cluster id ${id}`);
      if (isAnimated) {
        markers[zoomLevel][id].map(m => $(m._icon).fadeOut(400, () => map.removeLayer(m)));
      } else {
        markers[zoomLevel][id].map(m => map.removeLayer(m));
      }
      delete markers[zoomLevel][id];
    }

    function displayMarkers(data, id, zoomLevel) {
      // Display markers
      markers[zoomLevel][id] = [];
      data.forEach((object) => {
        if (object.centroid && object.centroid[0] > -200 && object.centroid[1] > -200) {
          const icon = {
            className: 'cluster-marker',
            html: object.size,
            iconSize: ['', ''],
            iconAnchor: [16, 16],
            riseOnHover: true
          };
          const m = L.marker([object.centroid[1], object.centroid[0]], { icon: L.divIcon(icon) });

          // TODO attach this event to the parent div of the markers and use target of the event
          m.on('click', () => {
            $('#intro').hide();
            $('#articles').show();
            articlesManager(object.id);

            // Google analytics event
            clickCount += 1;
            _gaq.push(['_trackEvent', 'map', 'click', 'map', clickCount]);
          });

          markers[zoomLevel][id].push(m);
          m.addTo(map);
        } else {
          console.warn('Empty or wrong coordinates');
        }
      });
    }

    function getVisibleDataTiles() {
      // Returns list of id's of the visible data tiles on the map

      const bounds = map.getBounds();

      // If we see more than whole map set bounds to [[-180, -90],[180, 90]]
      bounds._southWest.lng = bounds._southWest.lng < -180 ? -180 : bounds._southWest.lng;
      bounds._southWest.lng = bounds._southWest.lng > 179.9 ? 179.9 : bounds._southWest.lng;
      bounds._southWest.lat = bounds._southWest.lat < -90 ? -90 : bounds._southWest.lat;
      bounds._southWest.lat = bounds._southWest.lat > 90 ? 90 : bounds._southWest.lat;
      bounds._northEast.lng = bounds._northEast.lng > 179.9 ? 179.9 : bounds._northEast.lng;
      bounds._northEast.lng = bounds._northEast.lng < -180 ? -180 : bounds._northEast.lng;
      bounds._northEast.lat = bounds._northEast.lat > 90 ? 90 : bounds._northEast.lat;
      bounds._northEast.lat = bounds._northEast.lat < -90 ? -90 : bounds._northEast.lat;

      const currentDivisionNumber = divisionNumber[map.getZoom()];
      const tileWidth = 360 / currentDivisionNumber;
      const tileHeight = 180 / currentDivisionNumber;
      const northEastColumn = Math.floor(Math.abs(-180 - bounds._northEast.lng) / tileWidth);
      const northEastRow = Math.floor(Math.abs(90 - bounds._northEast.lat) / tileHeight);
      const southWestColumn = Math.floor(Math.abs(-180 - bounds._southWest.lng) / tileWidth);
      const southWestRow = Math.floor(Math.abs(90 - bounds._southWest.lat) / tileHeight);
      const southWestId = (southWestRow * currentDivisionNumber) + southWestColumn;
      const northEastId = (northEastRow * currentDivisionNumber) + northEastColumn;
      const northWestId = (northEastRow * currentDivisionNumber) + southWestColumn;
      // const southEastId = (southWestRow * currentDivisionNumber) + northEastColumn;
      const width = (northEastId - northWestId) + 1;
      const visibleDataTiles = [];

      // Select all tiles between northWestId and southEastId that are visible
      // iterate rows first and then for each row take cells
      for (let i = northWestId; i <= southWestId; i += currentDivisionNumber) {
        for (let j = i; j < i + width; j++) {
          visibleDataTiles.push(j);
        }
      }

      return visibleDataTiles;
    }

    function fetchTile(id) {
      const zoom = currentZoomLevel;

      let data = null;
      if (sessionStorage) {
        // get clusters from cache
        data = sessionStorage.getItem(`${zoom}_${id}`);
      }

      if (data !== null) {
        console.info(`Getting data from sessionStorage. zoom level ${zoom} cluster id ${id}`);
        if (zoom === map.getZoom() && enteringDataTiles.indexOf(id) >= 0) {
          displayMarkers(JSON.parse(data), id, zoom);
        }
      } else {
        // get clusters from the server
        console.info(`Getting data from the SERVER. zoom level ${zoom} cluster id ${id}`);
        $.ajax({
          url: `${url}${zoom}/${id}/${divisionNumber[zoom]}/`,
          success: response => {
            if (zoom === map.getZoom() && enteringDataTiles.indexOf(id) >= 0) {
              displayMarkers(response, id, zoom);
            }

            // Save into cache
            if (sessionStorage) {
              sessionStorage.setItem(`${zoom}_${id}`, JSON.stringify(response));
            }
          }
        });
      }
    }

    const main = function mainFunc() {
      // If we change zoom level:
      // remove all markers from current zoom level, set currently visible tiles to [].
      if (currentZoomLevel !== map.getZoom()) {
        console.info('Changing zoom level - removing all markers.');
        Object.keys(markers[currentZoomLevel]).map(key => removeTile(key, currentZoomLevel, true));
        currentlyVisibleTiles = [];
      }
      currentZoomLevel = map.getZoom();

      // Detect which tiles are new and get the data
      enteringDataTiles = getVisibleDataTiles();
      enteringDataTiles.forEach(tile => {
        if (currentlyVisibleTiles.indexOf(tile) < 0) {
          fetchTile(tile);
        }
      });

      // Detect which tiles are old and remove the markers.
      currentlyVisibleTiles.forEach(tile => {
        if (enteringDataTiles.indexOf(tile) < 0) {
          removeTile(tile, currentZoomLevel);
        }
      });
      currentlyVisibleTiles = enteringDataTiles;
    };

    main.map = function mapSetterGetter(value) {
      if (!arguments.length) return map;
      map = value;
      return main;
    };

    main.articlesManager = function articlesManagerSetterGetter(value) {
      if (!arguments.length) return articlesManager;
      articlesManager = value;
      return main;
    };

    main.markers = function markersSetterGetter() {
      return markers;
    };

    return main;
  }

  $(() => {
    $(window).bind('resize', () => {
      if ($(window).width() > 600) {
        $('#right-panel').css('margin-left', `${$('#map').width()}px`);
        isMobile = false;
      } else {
        isMobile = true;
      }
      $('#right-panel').css('height',
        `${$('#map').height() -
        parseInt($('#right-panel').css('paddingTop'), 10) -
        parseInt($('#right-panel').css('paddingBottom'), 10)}px`);
    });
    $(window).trigger('resize');


    const map = L.map('map', {
      zoomControl: false,
      maxBounds: L.latLngBounds(L.latLng(-90, -180), L.latLng(90, 180))
    }).setView([31, 10], 3);

    function setLongitude(position) {
      map.setView([map.getCenter().lat, position.coords.longitude], map.getZoom());
    }

    // Try to set map's longitude according to users position;
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(setLongitude);
    }

    L.tileLayer('//{s}.tile.thunderforest.com/outdoors/{z}/{x}/{y}.png', {
      attribution: 'Maps © <a href="http://www.thunderforest.com">Thunderforest</a>, ' +
        'Data © <a href="http://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>',
      maxZoom: 8,
      minZoom: 2
    }).addTo(map);

    if (!isMobile) {
      new L.Control.Zoom({ position: 'bottomleft' }).addTo(map);
    }

    // Initialize main components
    const articlesManager = articlesFetcher();
    const mapManager = mapClustersManager().map(map).articlesManager(articlesManager);

    // Call mapManager when map is moved or zoomed
    map.on('zoomend', mapManager);
    map.on('moveend', mapManager);
    map.on('click', () => $('#right-panel').removeClass('active'));
    map.on('movestart', () => $('#right-panel').removeClass('active'));
    mapManager();

    // Detect when user scrolls to the bottom and load more articles.
    $('#right-panel').scroll(() => {
      // REMOVED Math.abs from this condition
      if ($('#right-panel')[0].scrollHeight -
          $('#right-panel').outerHeight() - $('#right-panel').scrollTop() < 5) {
        if (mapManager.articlesManager().hasMore()) {
          mapManager.articlesManager()();
        }
      }
    });

    $('#menu-home').bind('click', () => {
      $('#intro').show();
      $('#articles').hide();
    });
    $('#menu-map').bind('click', () => $('#left-panel').removeClass().addClass('map'));

    // Reporting incorrect place or content
    $('#articles').bind('click', evt => {
      if ('report place report content'.indexOf(evt.target.className) >= 0) {
        const articleUrl = $(evt.target)
          .parent()
          .siblings('.article-url')
          .text();
        const eventName = evt.target.className.replace('report', '').trim();
        const message = JSON.stringify({ article: articleUrl, event: eventName });

        $.post(`//${server}/api/report/`, message)
          .done(() => $(evt.target).addClass('done'));
      }
    });
  });
}($, L));
