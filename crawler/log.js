const fs = require('fs');

/**
 * Logger.
 */
class Log {
	/**
	 * @param {Object} options - file properties.
	 * @param {string} options.filename - name of file.
	 * @param {string} options.header - first line of file.
	 * @param {string} options.path - path to file.
	 */
    constructor({
        filename = 'log',
        header = '',
        path = './'
    } = {}) {
        this.filename = filename;
        this.header = header;
        this.path = path;
		
		/** @type {stream.Writable} file stream */
        this.stream;
		
		// Add newline to header if user did not add one.
        if (header != '' && header[header.length - 1] != '\n') {
            this.header += '\n';
        }
    }

	/**
	 * Creates a file stream to append messages to.
	 */
    createFileStream() {
        fs.appendFileSync(this.path + this.filename, this.header);
        this.stream = fs.createWriteStream(this.path + this.filename, {
                flags: 'a'
            });
    }

	/**
	 * Writes to the open file stream.
	 * @param {string} message - message written to file.
	 */
    write(message) {
        this.stream.write(message + '\n');
    }
}

module.exports = Log;
