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
	var pattern = RegExp('https?:\/\//i');
	return pattern.test(url);
}

function convertUrlRelativeToAbsolute(strRelative, url) {
	var strAbsolute = "";
	return strAbsolute;
}

function isLimitValid(limit, max) {
	if (limit > 0 && limit <= max) {
		return true;
	}
	else {
		return false;
	}
}

/**
 * Performs depth-first crawl of links on a webpage.
 * @param {string} url - website url to start crawl at.
 * @param {number} limit - number of pages to visit.
 * @param {string} keyword - keyword that stops crawler if found on a page.
 * @return {boolean} if function exited successfully.
 */
function depthFirst(url, limit, keyword) {	
	for (var i = 0; i < depth; i++) {
		var links = getLinks(url);	// get all links from webpage
		
		// Check if there are links to follow on page
		if (links) {
			var link = links[Math.floor(Math.random() * links.length)].text();	// get random link
			logToFile(link);
			url = link;
		}
		else {
			break; 
		}
	}
	return true;
}

function addLinksToQueue(url, queue) {
	var links = getLinks(url);
	links.forEach(function(link) {
		queue.push(link);
	});
	return;
}

function breadthFirst(url, limit, keyword) {
	var queue = [];
	var currentDepth = 1;
	
	// Add all links to queue from webpage and add null to the end to signify
	// a new level of depth.
	addLinksToQueue(url, queue);
	queue.push(null);
	
	while (true) {
		url = links.shift();
		
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
			}
		}
		else {
			addLinksToQueue(url, queue);
			url = queue.shift();
		}
	}
	
	return true;
}

function getLinks(url) {
	// Set user-agent to prevent websites from blocking the crawler
	var userAgent = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
	var customRequest = request.defaults({
		headers: {'User-Agent': userAgent}
	});
	
	// Get html body from url
	customRequest.get(url, function(err, res, body) {
		if(err) {
			console.log(err);
			return undefined;
		}
		else {
			$ = cheerio.load(body);
			links = $('a');
			
			//debug
			$(links).each(function(i, link) {
				console.log($(link).text());
			});
			return links;
		}
	});
}

function logToFile(link) {
	return;
}

module.exports.depthFirst = depthFirst
module.exports.breadthFirst = breadthFirst