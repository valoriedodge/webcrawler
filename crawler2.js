const request = require('request');
const cheerio = require('cheerio');

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
module.exports.formatLinks = function(currentPage, previousURL, group, keyword, $) {
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
	// var res = {};
	// res['group'] = group;
	// res['visited'] = true;
	// res['prevURL'] = previousURL;
	// res['url'] = currentPage;
	// res['links'] = Array.from(uniqueLinks);
	// res['keyword'] = findKeyword($, keyword);
	// res['title'] = $("title").text();
	// Return an array from the set of unique links
	return Array.from(uniqueLinks);
}
