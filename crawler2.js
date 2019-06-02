const request = require('request');
const cheerio = require('cheerio');
var rp = require('request-promise');

const MAX_LINKS = 1000;
const USER_AGENTS = [
	"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/70.0.3538.77 Safari/537.36", 				// Chrome
	"Mozilla/5.0 (X11; Linux i686; rv:64.0) Gecko/20100101 Firefox/64.0", 																// Firefox
	"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_9_3) AppleWebKit/537.75.14 (KHTML, like Gecko) Version/7.0.3 Safari/7046A194A", 			// Safari
	"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML like Gecko) Chrome/51.0.2704.79 Safari/537.36 Edge/14.14931" 	// Edge
]
/**
 * Checks HTML for keyword.
 * @param {cheerio} $ - cheerio object with loaded HTML.
 * @return {boolean} returns true if found.
 */
function findKeyword($, keyword) {
	text = $("body").text();
	var regex = new RegExp('\\b' + keyword + '\\b', 'gi');
	return regex.test(text);
}

/**
 * Checks if URL link has a relative or absolute path.
 * @param {string} url - url of webpage to be checked.
 * @return {boolean} returns true if absolute, false if relative.
 */
function isUrlAbsolutePath(url) {
	var regex = new RegExp('https?:\/\/', 'i');
	return regex.test(url);
}

/**
 * Formats links found on a webpage by stripping them of any tags
 * and converting relative paths to absolute. Removes any duplicates
 * and stores the links as a string in an array.
 * @param {Array.<Object>} links - links found on webpage.
 * @param {string} currentPage - URL of page with links to be formatted.
 * @return {Array.<string>} array of web URLs.
 */
// module.exports.formatLinks =
function formatLinks (currentPage, $) {
	// $('a'), "***"
	var uniqueLinks = new Set();

	$('a').each(function(i, link) {
		var url = $(link).attr('href');

		// Ignore links to elements
		if (url != null && url.charAt(0) == '#')
			return true;

		// Convert relative paths to absolute
		if (!isUrlAbsolutePath(url))
			url = currentPage + url;

		uniqueLinks.add(url);
	});
	return Array.from(uniqueLinks);
}

function writeMessage(res, id, data){
  res.write('id: ' + id + '\n');
  res.write("data: " + JSON.stringify(data) + '\n\n'); // Note the extra newline
}

function closeSSE(res, id, data){
  res.write('event: close\n');
  writeMessage(res, id, data)
  res.end();
}

function createResponse(group, previousURL, currentURL, keyword, $) {
  var tosend = {};
  tosend['group'] = group;
  tosend['prevURL'] = previousURL;
  tosend['url'] = currentURL;
  tosend['keyword'] = findKeyword($, keyword);
  tosend['title'] = $("title").text();
  return tosend;
}

module.exports.setUpSearch = function(req, res){
  var closed = false;
  var found = false;
  var messageCount = 0;
  var group = 0;
  var URLS = [];
  var allURLS = new Set();
  var limit = Math.min(req.query.limit, 5);
  for (let i=0; i<=limit; i++){
    URLS.push([]);
  }
  var currentURL = req.query.url;
  var keyword = req.query.keyword;
  var previousURL = currentURL;
  allURLS.add(currentURL);

  req.on('error', function(err) {
    console.log(err);
  });
  req.on('close', () => {
    closed = true;
    console.log('Stopped sending events.');
  });

  function handleBreadthSearch(previousURL, currentURL, group, messageCount){
    messageCount++;
    // Check for more links in the current group to visit
    while (URLS[group].length == 0 && group <= limit){
      group++;
    }
    // We have reached the limit or we found the keyword so we can close the SSE connection
    if(group > limit || found == true || closed == true){
      closeSSE(res,  messageCount, "no more links");
    }
    else{
      var idx = Math.floor(Math.random() * URLS[group].length)
      var tmp = URLS[group].splice(idx,1)[0];
      previousURL = tmp.prevURL;
      currentURL = tmp.url;
      console.log(currentURL);
      breadthSearch(previousURL, currentURL, group, messageCount);
    }
  }

  function handleDepthSearch(previousURL, currentURL, messageCount){
    messageCount++;
    var currentGroup = limit;
    while (currentGroup > 0 && URLS[currentGroup].length == 0){
      currentGroup--;
    }
    // We have reached the limit or we found the keyword so we can close the SSE connection
    if(currentGroup <= 0 || found == true || closed == true){
      closeSSE(res,  messageCount, "no more links");
    }
    else{
      var idx = Math.floor(Math.random() * URLS[currentGroup].length)
      var tmp = URLS[currentGroup].splice(idx,1)[0];
      previousURL = tmp.prevURL;
      currentURL = tmp.url;
      console.log(currentURL);
      depthSearch(previousURL, currentURL, currentGroup, messageCount);
    }
  }

  function addLinksToList(group, links, currentURL){
    if (group < limit){
      for(let i=0; i< links.length; i++){
        if(!allURLS.has(links[i])){
          URLS[group + 1].push({'url':links[i], 'prevURL': currentURL});
          allURLS.add(links[i]);
        }
      }
    }
  }

  function buildOptions(currentURL){
    var options = {
      uri: currentURL,
      transform: function (body) {
          return cheerio.load(body);
      }
    };
    return options;
  }

  function handleSSE(group, previousURL, currentURL, messageCount, $){
    var tosend = createResponse(group, previousURL, currentURL, keyword, $);
    var links = formatLinks(currentURL, $);
    writeMessage(res, messageCount, tosend);
    // Stop the loop if the keyword was found
    if(tosend['keyword']) found = true;
    // If the group we are on is less than the limit, add its links to those to be searched
    addLinksToList(group, links, currentURL);
  }


  function breadthSearch(previousURL, currentURL, group, messageCount){
    // Stop the recursion if the connection is closed
    if (closed) return;

    rp(buildOptions(currentURL)) // call to request promise
    .then(function ($) {
        handleSSE(group, previousURL, currentURL, messageCount, $);
        handleBreadthSearch(previousURL, currentURL, group, messageCount);

    })
    .catch(function (err) { // Something happened, but let's try to keep going
        // console.log(err);
        handleBreadthSearch(previousURL, currentURL, group, messageCount);
    });
  }

  function depthSearch(previousURL, currentURL, group, messageCount){
    // Stop the recursion if the connection is closed
    if (closed) return;

    rp(buildOptions(currentURL)) // call to request promise
    .then(function ($) {
        handleSSE(group, previousURL, currentURL, messageCount, $);
        handleDepthSearch(previousURL, currentURL, messageCount);

    })
    .catch(function (err) { // Something happened, but let's try to keep going
        handleDepthSearch(previousURL, currentURL, messageCount);
    });
  }

  // Main entry to call breadth or depth first recursively
  if (req.query.searchType == 'Breadth'){
    breadthSearch(previousURL, currentURL, group, messageCount);
  }else if (req.query.searchType == 'Depth') {
    depthSearch(previousURL, currentURL, group, messageCount);
  }else{
    closeSSE(res,  messageCount, "invalid searchtype")
  }
}
