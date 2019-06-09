/**
 * Crawler module.
 * @module crawler/crawler
 */

const request = require('request');
const cheerio = require('cheerio');
var Promise = require('bluebird');

Promise.config({
    cancellation: true
});

/** @const max number of pages to visit. */
const MAX_LINKS = 300;

/** @const user agents in case websites block servers from scraping data */
const USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/70.0.3538.77 Safari/537.36", // Chrome
    "Mozilla/5.0 (X11; Linux i686; rv:64.0) Gecko/20100101 Firefox/64.0", // Firefox
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_9_3) AppleWebKit/537.75.14 (KHTML, like Gecko) Version/7.0.3 Safari/7046A194A", // Safari
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML like Gecko) Chrome/51.0.2704.79 Safari/537.36 Edge/14.14931" // Edge
]

/**
 * Crawls webpages and returns links found on each page.
 */
class Crawler {
    /**
     * @param {object} logger - file stream of log file to be written to.
     * @param {object} sse - server side connection to client.
     */
    constructor(logger, sse) {
        this.logger = logger;
        this.sse = sse;

        /** @private {Array.<Object>} list of pages visited. */
        this.pagesVisited = [];

        /** @private {number} id of message to be sent to client */
        this.id = 0;

        /** @private {number} depth limit of crawler. */
        this.limit = 0;

        /** @private {string} keyword to be searched for. */
        this.keyword = null;

        /** @private {Set.<string>} URLs visited. */
        this.pastURLs = new Set();

        /** @private {boolean} if keyword is found on page */
        this.keywordFound = false;
    }

    /**
     * Exception object that gets thrown when the crawler stops
     * @param {string} message - exception message.
     */
    _StopCrawler(message) {
        this.message = 'Crawler Stopped: ' + message;
        this.name = 'StopCrawler';
    }

    /**
     * Checks if an exit condition has been met to stop the crawler.
     */
    _checkExitConditions() {
        let end = this.pagesVisited.length - 1;
        let lastPage = this.pagesVisited[end];

        if (lastPage.group > this.limit) {
            return {
                stop: true,
                val: 'limit',
                msg: 'max depth reached'
            };
        } else if (lastPage.keyword) {
            return {
                stop: true,
                val: 'keyword',
                msg: 'keyword found'
            };
        } else if (this.id >= MAX_LINKS || this.id < 0) {
            return {
                stop: true,
                val: 'max',
                msg: 'max number of links reached'
            };
        } else {
            return {
                stop: false,
                val: '',
                msg: ''
            };
        }
    }

    /**
     * Logs data to file.
     * @param {Array.<Object>} data - array of objects containing page info.
     */
    _logToFile(data) {
        var log = new Date().toISOString() + '||' + data.title + '||' + data.url +
            '||' + data.keyword + '||' + data.group;
        this.logger.write(log);
    }

    /**
     * Checks HTML for keyword.
     * @param {cheerio} $ - cheerio object with loaded HTML.
     * @return {boolean} returns true if found.
     */
    _findKeyword($) {
        var text = $("body").text();
        var regex = new RegExp('\\b' + this.keyword + '\\b', 'gi');
        return regex.test(text);
    }

    /**
     * Checks if URL link has a relative or absolute path.
     * @param {string} url - url of webpage to be checked.
     * @return {boolean} returns true if absolute, false if relative.
     */
    _isUrlAbsolutePath(url) {
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
    _formatLinks(links, currentPage, $) {
        var uniqueLinks = new Set();
        var self = this;

        $(links).each(function (i, link) {
            var url = $(link).attr('href');

            // Ignore links to elements
            if (url != null && url.charAt(0) == '#')
                return true;

            // Convert relative paths to absolute
            if (!self._isUrlAbsolutePath(url)) {
                if (currentPage[currentPage.length - 1] == '/') {
                    currentPage = currentPage.substr(0, currentPage.length - 1);
                }
                url = currentPage + url;
            }

            // Check if valid protocol
            var path = url.split('/');
            if (path[0] == 'http:' || path[0] == 'https:')
                uniqueLinks.add(url);
        });

        // Return an array from the set of unique links, so that they can be indexed
        return Array.from(uniqueLinks);
    }

    /**
     * Knuth Shuffle for randomizing elements in an array.
     * http://stackoverflow.com/questions/2450954/how-to-randomize-shuffle-a-javascript-array
     * @param {Array.<*>} array - array to be randomized.
     * @return {Array.<*>} randomized array.
     */
    _shuffle(array) {
        var currentIndex = array.length,
        temporaryValue,
        randomIndex;

        // While there remain elements to shuffle...
        while (0 !== currentIndex) {

            // Pick a remaining element...
            randomIndex = Math.floor(Math.random() * currentIndex);
            currentIndex -= 1;

            // And swap it with the current element.
            temporaryValue = array[currentIndex];
            array[currentIndex] = array[randomIndex];
            array[randomIndex] = temporaryValue;
        }

        return array;
    }

    /**
     * Visits website and scrapes page information.
     * @param {string} url - website URL to visit.
     * @param {string} previousURL - URL that pointed to page being visited.
     * @return {Promise.<Array.<string>>} array of links found on webpage.
     */
    _visitPage(url, previousURL) {
        var self = this;
        // Set user-agent to prevent websites from blocking the crawler
        var userAgent = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
        var customRequest = request.defaults({
                headers: {
                    'User-Agent': userAgent
                }
            });

        return new Promise(function (resolve, reject, onCancel) {
            // Get html body from url
            var request = customRequest.get(url, function (err, res, body) {
                    if (err) {
                        reject(err);
                    } else {
                        let $ = cheerio.load(body);

                        // Search for keyword on page, if one is specified
                        let keywordFound = (self.keyword) ? self._findKeyword($) : false;

                        // Get links on page and format them
                        let links = $('a');
                        links = self._formatLinks(links, url, $);

                        // Get group number of url, where group number is the depth of the crawler
                        // e.g. starting url = 0, links on starting url = 1, links of those links = 2
                        let group = 0;
                        if (previousURL != null) {
                            let pos = self.pagesVisited.map(function (x) {
                                    return x.url;
                                }).indexOf(previousURL);
                            group = self.pagesVisited[pos].group + 1;
                        }

                        // Get title of webpage and strip of any tabs and new line characters
                        let title = $("title").text();
                        title = title.replace(/[\t\n\r]/g, '');

                        // Add to set of pages visited
                        self.pastURLs.add(url);

                        // Create object of page information
                        let data = {
                            url: url,
                            prevURL: previousURL,
                            title: title,
                            keyword: keywordFound,
                            group: group
                        };

                        // Store page information in an array
                        self.pagesVisited.push(data);

                        // If links were successfully scraped, write to file and send to client
                        let stopConditions = self._checkExitConditions();
                        let isStopped = stopConditions.val == 'max' || stopConditions.val == 'limit' || self.keywordFound;
                        if (links && links.length && !isStopped) {
                            self._logToFile(data);
							setTimeout(function () {
								self.sse.write(self.id, JSON.stringify(data));
								self.id++;
							}, 100);
                            
                            if (stopConditions.val == 'keyword') {
                                self.keywordFound = true;
                            }
                        }

                        resolve(links);
                    }
                });
            onCancel(function () {
                console.log("aborted request: " + url);
                request.abort();
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
    depthFirst(url, limit, keyword) {
        this.limit = limit;
        this.keyword = keyword;
        var pastLinks = [];
        var previousURL = null;
        this.id = 0;
        var self = this;

        return new Promise(async function (resolve, reject) {

            for (let depth = 1; depth <= limit; depth++) {

                // Visit page to get all links and check if the keyword appears on the page
                try {
                    var links = await self._visitPage(url, previousURL);
                } catch (error) {
                    console.error(error);
                }

                // Check if there are links to follow on page
                if (links && links.length) {
                    // Randomize links and save to new array
                    pastLinks = self._shuffle(links);

                    // Update URL and make sure the same link isn't visited twice
                    previousURL = url;
                    while (url == previousURL) {
                        url = pastLinks.pop();
                    }
                } else {
                    console.log('No links: ' + url);

                    // Try again with a new link or exit if there are no more links to try
                    if (pastLinks && pastLinks.length) {
                        self.pagesVisited.pop();
                        previousURL = self.pagesVisited[self.pagesVisited.length - 1].url;
                        url = pastLinks.pop();
                        depth--;
                    } else {
                        error = 'No more links to follow';
                        reject(error, self.pagesVisited);
                        break;
                    }
                }

                // Once the limit is reached or the keyword is found - stop the crawler
                // and resolve the promise.
                if (depth == limit || self.pagesVisited[self.pagesVisited.length - 1].keyword) {
                    resolve(self.pagesVisited);
                    break;
                }
            }
        })
    }

    /**
     * Adds the URL of a webpage and its links found on the page to a queue.
     * @param {Array.<string>} links - links found on webpage.
     * @param {string} url - webpage URL the links were found on.
     * @param {Array.<Object>} queue - data structure to store URLs.
     */
    _addLinksToQueue(links, url, queue) {
        links.forEach(function (link) {
            queue.push({
                link: link,
                prevURL: url
            });
        });
    }

    /**
     * Checks if URL has already been visited.
     * @param {string} url - URL to check.
     */
    _visited(url) {
        return this.pastURLs.has(url);
    }

    /**
     * Performs breadth-first crawl of links on a webpage.
     * @param {string} url - website url to start crawl at.
     * @param {number} limit - number of pages to visit.
     * @param {string} keyword - keyword that stops crawler if found on a page.
     * @return {Promise.<Array.<Object>>} array of objects with links visited.
     */
    breadthFirst(url, limit, keyword) {
        var queue = [];
        var previousURL = null;
        var currentDepth = 1;
        this.limit = limit;
        this.keyword = keyword;
		this.id = 0;
        var self = this;

        return new Promise(async function (resolve, reject) {
            // Get webpage information of starting URL, then add all its links to a queue.
            try {
                var links = await self._visitPage(url, previousURL);
            } catch (error) {
                console.error(error);
            }
            self._addLinksToQueue(links, url, queue);

            // Iterate through the queue to visit each URL and get its links on the page.
            // Then add those links to the queue. Repeat to desired depth limit set by user.
            for (let i = 0; i < limit; ++i) {
                try {
                    await visitLinksFromQueue();
                } catch (error) {
                    console.error(error);
                }
            }
            resolve(self.pagesVisited);
            // If no exit condition was reached (i.e. keyword found, max links reached), then
            // check if the max limit of the last link was reached, if so resolve the promise.
            if (self.pagesVisited[self.pagesVisited.length - 1].group >= limit) {
                resolve(self.pagesVisited);
            } else {
                // Something went wrong
                reject(self.pagesVisited);
            }

        });

        /**
         * Iterates through a queue to get all links from the URL, then adds those
         * links to the end of the queue. This repeats until an exit condition is met.
         * @return {Promise} resolves when all pages are visited in the queue.
         */
        function visitLinksFromQueue() {
            var tempQueue = queue.slice(0); // Copy queue into temporary array
            queue.length = 0; // Empty queue

            // Prevent the crawler from getting too many links
            var size = (tempQueue.length > MAX_LINKS) ? MAX_LINKS : tempQueue.length;

            // Iterate through the temporary queue to add links to original queue.
            // If an exit condition is met, an exception is thrown to stop the crawler.
            // Each page that is visited returns a promise that is added to an array.
            var promises = [];
            for (let i = 0; i < size; ++i) {
                if (!self._visited(tempQueue[i].link)) {
                    var result = visitLinks(tempQueue[i].link, tempQueue[i].prevURL).catch(e => {
                            if (e.message == 'max depth reached' ||
                                e.message == 'keyword found' ||
                                e.message == 'max number of links reached') {

                                throw {
                                    message: e.message
                                }
                            }
                            console.log(e.message);
                        });
                    promises.push(result);
                }
            }

            // When all promises are returned, resolve the original promise.
            return Promise.all(promises).then(function () {
                console.log('Completed Crawl at depth: ' + currentDepth++);
            }).catch(e => {
                // If an error occurs, resolve the incomplete data and cancel the
                // remaining promises.
                console.log(e.message);
                //resolve(self.pagesVisited);
                promises.forEach(p => p.cancel());
            });

            /**
             * Gets all links found on webpage and adds them to a queue.
             * @param {string} url - URL to scrape.
             * @param {string} previousURL - URL visited to get current link.
             * @return {function} adds links found on webpage to queue.
             */
            function visitLinks(url, previousURL) {
                return self._visitPage(url, previousURL).then(function (links) {
                    // Check exit conditions to stop the crawler
                    let isDone = self._checkExitConditions();
                    if (isDone.stop) {
                        throw {
                            message: isDone.msg
                        };
                        resolve(self.pagesVisited);
                    }
                    return self._addLinksToQueue(links, url, queue);
                });
            }

        }
    }

}

module.exports = Crawler;
