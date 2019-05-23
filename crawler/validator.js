/**
 * Validator module.
 * @module crawler/validator
 */

const request = require('request');
const validUrl = require('valid-url');

/**
 * Checks if URL string is valid.
 * @param {string} url - URL to check validity.
 * @return {Promise} resolves if URL is valid.
 */
module.exports.isUrl = function (url) {
	return new Promise(function (resolve, reject) {
		// Check if valid protocol
		var path = url.split('/');
		if (path[0] != 'http:' && path[0] != 'https:') {
			reject('Invalid protocol');
		}

		// Check if URL is formatted correctly
		if (validUrl.isUri(url)) {
			var options = {
				url: url,
				headers: {
					'User-Agent': 'request'
				}
			};

			// Check if there is a response when requesting the URL
			request.get(options, function (err, res, body) {
				if (err) {
					reject(err);
				} else if (res.statusCode != 200) {
					reject('Invalid status code <' + response.statusCode + '>');
				} else {
					resolve();
				}
			})
		}
	});
}
