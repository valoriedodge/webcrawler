/**
 * Server Sent Events.
 */
class SSE {
	/**
	 * @param {Object} res - the response.
	 */
    constructor(res) {
        console.log('Setting up SSE connection...');
        this.res = res;

        this.res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive'
        });
    }

	/**
	 * Sends data to the client.
	 * @param {number} id - message number.
	 * @param {Object} data - message to be sent.
	 */
    write(id, data) {
        this.res.write(`id: ${id}\n`);
        this.res.write(`data: ${data}\n\n`);
    }

	/**
	 * Ends connection.	 
	 */
    end() {
		console.log('Terminating connection.');
        this.res.write('event: close\n');
        this.res.write('id: -1\n');
        this.res.write('data: end\n\n');
        this.res.end();
    }
}

module.exports = SSE;
