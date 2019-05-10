/**
 * Crawler module.
 * @module crawler/crawler
 */

const request = require('request');
const cheerio = require('cheerio');
const fs = require('fs');

var USER_AGENTS = [
	"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/70.0.3538.77 Safari/537.36", 				// Chrome
	"Mozilla/5.0 (X11; Linux i686; rv:64.0) Gecko/20100101 Firefox/64.0", 																// Firefox
	"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_9_3) AppleWebKit/537.75.14 (KHTML, like Gecko) Version/7.0.3 Safari/7046A194A", 			// Safari
	"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML like Gecko) Chrome/51.0.2704.79 Safari/537.36 Edge/14.14931" 	// Edge
]
var MAX_BREADTH_LIMIT = 3;
var MAX_DEPTH_LIMIT = 30;

function isKeywordValid() {
	return;
}

function findKeyword() {
	return;
}

function isUrlAbsolutePath(url) {
	var pattern = new RegExp('https?:\/\/', 'i');
	return pattern.test(url);
}

function isLimitValid(limit, max) {
	if (limit > 0 && limit <= max) 
		return true;
	else 
		return false;
}


function addLinksToQueue(url, queue, callback) {
	var links = getLinks(url, addLinks);

	// callback 
	function addLinks(error, links) {
		if (error) return console.error(error);

		console.log();
		links.forEach(function(link) {
			queue.push(link);
			console.log(link);
		});

		callback(null, queue);
	}
}

module.exports.breadthFirst = function(url, limit, keyword) {
	var queue = [];
	var currentDepth = 1;
	
	// Add all links to queue from webpage and add null to the end to signify
	// a new level of depth.
	queue.push(null);
	addLinksToQueue(url, queue, bfs);

	function bfs(error, queue) {
		queue.push(null);
		
		while (true) {
			url = queue.shift();
			
			// Check if a new level (depth) has been reached, otherwise continue
			// traversing links.
			if (url == null) {
				currentDepth++;
				
				// Break out of loop if depth has reached the limit
				if (currentDepth > limit) {
					break;
				}
				else {
					// Mark that a new level has been reached
					queue.push(null);
					url = queue.shift();
					console.log('==================================================');
				}
			}
			else {
				addLinksToQueue(url, queue, newUrl);

				function newUrl(error, queue) {
					url = queue.shift();
				}
				
			}
		}
	}

	return true;
}

function scrubLinks(links, currentPage) {
	var uniqueLinks = new Set();

	$(links).each(function(i, link) {
		var url = $(link).attr('href');

		// Ignore links to elements
		if (url != null && url.charAt(0) == '#')
			return true;

		// Convert relative paths to absolute
		if (!isUrlAbsolutePath(url)) 
			url = currentPage + url;

		uniqueLinks.add(url);
	});

	// Return an array from the set of unique links
	let result = Array.from(uniqueLinks);
	return result;
}

function getLinks(url, callback) {
	// Set user-agent to prevent websites from blocking the crawler
	var userAgent = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
	var customRequest = request.defaults({
		headers: {'User-Agent': userAgent}
	});

	// Get html body from url
	customRequest.get(url, function(err, res, body) {
		if(err) {
			console.error(err);
			callback(err, null);
			return err;
		}
		else {
			$ = cheerio.load(body);
			links = $('a');

			// Get rid of unwanted links to elements and convert relative paths
			// to absolute paths.
			var result = scrubLinks(links, url);
			callback(null, result);
			return result;
		}
	});
};

/**
 * Performs depth-first crawl of links on a webpage.
 * @param {string} url - website url to start crawl at.
 * @param {number} limit - number of pages to visit.
 * @param {string} keyword - keyword that stops crawler if found on a page.
 * @return {boolean} if function exited successfully.
 */
module.exports.depthFirst = function(url, limit, keyword) {	
	for (var i = 0; i < limit; i++) {
		var links = getLinks(url, processLinks);	// get all links from webpage

		// callback 
		function processLinks(error, links) {
			if (error) return console.error(error);

			// Check if there are links to follow on page
			if (links && links.length) {
				var link = links[Math.floor(Math.random() * links.length)];	// get random link
				console.log(link);
				logToFile(link);
				url = link;
			}
			else {
				console.log('No links to follow'); 
			}
		}
	}
	return true;
}

function logToFile(link) {
	return;
}

