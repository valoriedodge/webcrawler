/**
 * Crawler module.
 * @module crawler/crawler
 */

const request = require('request');
const cheerio = require('cheerio');
var Promise = require('bluebird');
const fs = require('fs');

Promise.config({
	cancellation: true
});

const MAX_LINKS = 1000;
const USER_AGENTS = [
	"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/70.0.3538.77 Safari/537.36", // Chrome
	"Mozilla/5.0 (X11; Linux i686; rv:64.0) Gecko/20100101 Firefox/64.0", // Firefox
	"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_9_3) AppleWebKit/537.75.14 (KHTML, like Gecko) Version/7.0.3 Safari/7046A194A", // Safari
	"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML like Gecko) Chrome/51.0.2704.79 Safari/537.36 Edge/14.14931" // Edge
]

/**
 * Exception object that gets thrown when the crawler stops
 * @param {string} message - exception message.
 */
function StopCrawler(message) {
	this.message = 'Crawler Stopped: ' + message;
	this.name = 'StopCrawler';
}

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
function formatLinks(links, currentPage) {
	var uniqueLinks = new Set();

	$(links).each(function (i, link) {
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
	return Array.from(uniqueLinks);
}

/**
 * Adds the URL of a webpage and its links found on the page to a queue.
 * @param {Array.<string>} links - links found on webpage.
 * @param {string} url - webpage URL the links were found on.
 * @param {Array.<Object>} queue - data structure to store URLs.
 */
function addLinksToQueue(links, url, queue) {
	links.forEach(function (link) {
		queue.push({
			link: link,
			prevURL: url
		});
	});
}

/**
 * Performs depth-first crawl of links on a webpage.
 * @param {string} url - website URL to visit.
 * @param {string} previousURL - URL that pointed to page being visited.
 * @param {string} keyword - keyword that stops crawler if found on a page.
 * @param {Array.<Object>} pagesVisited - array that stores info of pages being visited.
 * @param {stream.Writable} stream - writes data to file.
 * @return {Promise.<Array.<string>>} array of links found on webpage.
 */
function visitPage(url, previousURL, keyword, pagesVisited, stream) {
	// Set user-agent to prevent websites from blocking the crawler
	var userAgent = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
	var customRequest = request.defaults({
			headers: {
				'User-Agent': userAgent
			}
		});

	return new Promise(function (resolve, reject, onCancel) {
		// Get html body from url
		customRequest.get(url, function (err, res, body) {
			if (err) {
				reject(err);
			} else {
				$ = cheerio.load(body);

				// Search for keyword on page
				let keywordFound = findKeyword($, keyword);

				// Get links on page and format them
				links = $('a');
				links = formatLinks(links, url);

				// Get group number of url, where group number is the depth of the crawler
				// e.g. starting url = 0, links on starting url = 1, links of those links = 2
				let group = 0;
				if (previousURL != null) {
					let pos = pagesVisited.map(function (x) {
							return x.url;
						}).indexOf(previousURL);
					group = pagesVisited[pos].group + 1;
				}

				// Get title of webpage
				let title = $("title").text();

				// Create object of page information
				pagesVisited.push({
					url: url,
					prevURL: previousURL,
					title: title,
					keyword: keywordFound,
					group: group
				})

				// Write to file
				logToFile(pagesVisited[pagesVisited.length - 1], stream); 
				
				resolve(links);
			}
		});
		onCancel(function () {
			console.log("aborted");
			customRequest.abort();
		});
	})
}

/**
 * Performs depth-first crawl of links on a webpage.
 * @param {string} url - website url to start crawl at.
 * @param {number} limit - number of pages to visit.
 * @param {string} keyword - keyword that stops crawler if found on a page.
 * @return {Promise.<Array.<Object>>} array of objects with links visited.
 */
module.exports.depthFirst = function (url, limit, keyword) {
	var pagesVisited = [];
	var previousURL = null;

	return new Promise(async function (resolve, reject) {

		for (let numLinks = 1; numLinks <= limit; numLinks++) {

			// Visit page to get all links and check if the keyword appears on the page
			try {
				links = await visitPage(url, previousURL, keyword, pagesVisited, stream);
			} catch (error) {
				console.error(error);
			}

			// Check if there are links to follow on page
			if (links && links.length) {
				var link = links[Math.floor(Math.random() * links.length)]; // get random link
				console.log(link);

				// Update URLs
				previousURL = url;
				url = link;
			} else {
				error = 'No links to follow';
				reject(error);
			}

			// Once the limit is reached or the keyword is found, stop the crawler and
			// resolve the promise
			if (numLinks == limit || pagesVisited[pagesVisited.length - 1].keyword) {
				resolve(pagesVisited);
				break;
			}
		}
	})
}

/**
 * Performs breadth-first crawl of links on a webpage.
 * @param {string} url - website url to start crawl at.
 * @param {number} limit - number of pages to visit.
 * @param {string} keyword - keyword that stops crawler if found on a page.
 * @return {Promise.<Array.<Object>>} array of objects with links visited.
 */
module.exports.asyncBreadthFirst = function (url, limit, keyword) {
	var queue = [];
	var pagesVisited = [];
	var previousURL = null;

	return new Promise(async function (resolve, reject) {
		// Get webpage information of starting URL, then add all its links to a queue.
		try {
			var links = await visitPage(url, previousURL, keyword, pagesVisited, stream);
		} catch (error) {
			console.error(error);
		}
		addLinksToQueue(links, url, queue);

		// Iterate through the queue to visit each URL and get its links on the page.
		// Then add those links to the queue. Repeat to desired depth limit set by user.
		for (let i = 0; i < limit; ++i) {
			try {
				await getLinksFromQueue(queue, keyword, pagesVisited, limit, resolve);
			} catch (error) {
				console.error(error);
			}
		}

		// If no exit condition was reached (i.e. keyword found, max links reached), then
		// check if the max limit of the last link was reached, if so resolve the promise.
		if (pagesVisited[pagesVisited.length - 1].group >= limit) {
			resolve(pagesVisited);
		} else {
			// Something went wrong
			reject(pagesVisited);
		}

	});
}

/**
 * Iterates through a queue to get all links from the URL, then adds those
 * links to the end of the queue. This repeats until an exit condition is met.
 * @param {Array.<Object>} queue - links with the URL that pointed to said link.
 * @param {string} keyword - keyword that stops crawler if found on a page.
 * @param {Array.<Object>} pageVisited - array that stores info of pages being visited.
 * @param {number} limit - number of pages to visit.
 * @param {resolve} resolve - function that resolves the original promise.
 * @return {Promise} resolves when all pages are visited in the queue.
 */
function getLinksFromQueue(queue, keyword, pagesVisited, limit, resolve) {
	var tempQueue = queue.slice(0); // Copy queue into temporary array
	queue.length = 0; // Empty queue

	// Prevent the crawler from getting too many links
	var size = (tempQueue.length > MAX_LINKS) ? MAX_LINKS : tempQueue.length;

	// Iterate through the temporary queue to add links to original queue.
	// If an exit condition is met, an exception is thrown to stop the crawler.
	// Each page that is visited returns a promise that is added to an array.
	var promises = [];
	for (let i = 0; i < size; ++i) {
		var result = getLinks(tempQueue[i].link, tempQueue[i].prevURL, keyword, pagesVisited, limit, resolve).catch(e => {
				if (e.message == 'max depth reached' ||
					e.message == 'keyword found' ||
					e.message == 'max number of links reached') {
					throw new StopCrawler(e.message);
				}
			});
		promises.push(result);
	}

	// When all promises are returned, resolve the original promise.
	return Promise.all(promises).then(function () {
		console.log("Done");
	}).catch(e => {
		// If an error occurs, resolve the incomplete data and cancel the
		// remaining promises.
		console.log(e.message);
		resolve(pagesVisited);
		promises.forEach(p => p.cancel());
	});

	/**
	 * Gets all links found on webpage and adds them to a queue.
	 * links to the end of the queue. This repeats until an exit condition is met.
	 * @param {Array.<Object>} queue - links with the URL that pointed to said link.
	 * @param {string} keyword - keyword that stops crawler if found on a page.
	 * @param {Array.<Object>} pageVisited - array that stores info of pages being visited.
	 * @param {number} limit - number of pages to visit.
	 * @param {resolve} resolve - function that resolves the original promise.
	 * @return {function} adds links found on webpage to queue.
	 */
	function getLinks(url, previousURL, keyword, pagesVisited, limit, resolve) {
		return visitPage(url, previousURL, keyword, pagesVisited, stream).then(function (links) {
			//console.log(url);

			// Check for exit conditions of crawler:
			// Above depth limit, keyword found, max number of links reached.
			if (pagesVisited[pagesVisited.length - 1].group > limit) {
				resolve(pagesVisited);
				throw new StopCrawler('max depth reached');
			} else if (pagesVisited[pagesVisited.length - 1].keyword) {
				resolve(pagesVisited);
				throw new StopCrawler('keyword found');
			} else if (pagesVisited.length >= MAX_LINKS) {
				resolve(pagesVisited);
				throw new StopCrawler('max number of links reached');
			}

			return addLinksToQueue(links, url, queue);
		});
	}

}

/**
 * Performs breadth-first crawl of links on a webpage.
 * @param {string} url - website url to start crawl at.
 * @param {number} limit - number of pages to visit.
 * @param {string} keyword - keyword that stops crawler if found on a page.
 * @return {Promise.<Array.<Object>>} array of objects with links visited.
 */
module.exports.breadthFirst = function (url, limit, keyword) {
	var queue = [];
	var pagesVisited = [];
	var previousURL = null;

	return new Promise(async function (resolve, reject) {
		try {
			var links = await visitPage(url, previousURL, keyword, pagesVisited, stream);
		} catch (error) {
			console.error(error);
		}
		addLinksToQueue(links, url, queue);
		while (true) {
			// Check if depth surpassed the limit or if the keyword was found.
			// If so, stop crawler and resolve promise.
			if (pagesVisited[pagesVisited.length - 1].group > limit ||
				pagesVisited[pagesVisited.length - 1].keyword) {

				resolve(pagesVisited);
				break;
			} else {
				if (queue.length) {
					// Get next URL to visit
					previousURL = queue[0].prevURL;
					url = queue.shift().link;

					// Add links to queue asynchronously to speed up crawler
					links = await visitPage(url, previousURL, keyword, pagesVisited, stream);
					addLinksToQueue(links, url, queue);
				}
			}
		}
	});
}

/**
 * Logs data to file.
 * @param {Array.<Object>} data - array of objects containing page info.
 * @param {stream.Writable} stream - file stream to log data.
 */
function logToFile(data, stream) {
	var log = new Date().toISOString() + '\t' + data.title + '\t' + data.url +
		'\t' + data.keyword + '\t' + data.group + '\n';
	stream.write(log);
}
