/**
 * This code is a direct port of the version from PhantomJS, in order to have this script available in CasperJS as well
 * 
 * Note: 
 *  1) Developer can require 'fs' in order to write the har to file system directly
 *     This example only directly output the har object into the console
 * 
 *  2) Developer can easily modify the code so that it can parse a list of urls or the urls from your Casper tests
 *
 *  3) With the capability of CasperJS, this script could add web performance testing into Casper ( This script only is an example for proof of concept )
 *  
 *
 * Email: iroy2000 [at] gmail.com
 */

// make sure toISOString is available in Date object
if (!Date.prototype.toISOString) {
    Date.prototype.toISOString = function () {
        function pad(n) { return n < 10 ? '0' + n : n; }
        function ms(n) { return n < 10 ? '00'+ n : n < 100 ? '0' + n : n }
        return this.getFullYear() + '-' +
            pad(this.getMonth() + 1) + '-' +
            pad(this.getDate()) + 'T' +
            pad(this.getHours()) + ':' +
            pad(this.getMinutes()) + ':' +
            pad(this.getSeconds()) + '.' +
            ms(this.getMilliseconds()) + 'Z';
    }
}

/*
    creatHAR - create a har format object based on the parameter 
    @param  {String} address 
    @param  {String} title 
    @param  {String} startTime
    @param  {Array}  resources
    @return {Object} | JSON object for HAR viewer 
 */
function createHAR(address, title, startTime, resources)
{
    var entries = [];

    resources.forEach(function (resource) {
        var request = resource.request,
            startReply = resource.startReply,
            endReply = resource.endReply;

        if (!request || !startReply || !endReply) {
            return;
        }

        // Exclude Data URI from HAR file because
        // they aren't included in specification
        if (request.url.match(/(^data:image\/.*)/i)) {
            return;
    }

        entries.push({
            startedDateTime: request.time.toISOString(),
            time: endReply.time - request.time,
            request: {
                method: request.method,
                url: request.url,
                httpVersion: "HTTP/1.1",
                cookies: [],
                headers: request.headers,
                queryString: [],
                headersSize: -1,
                bodySize: -1
            },
            response: {
                status: endReply.status,
                statusText: endReply.statusText,
                httpVersion: "HTTP/1.1",
                cookies: [],
                headers: endReply.headers,
                redirectURL: "",
                headersSize: -1,
                bodySize: startReply.bodySize,
                content: {
                    size: startReply.bodySize,
                    mimeType: endReply.contentType
                }
            },
            cache: {},
            timings: {
                blocked: 0,
                dns: -1,
                connect: -1,
                send: 0,
                wait: startReply.time - request.time,
                receive: endReply.time - startReply.time,
                ssl: -1
            },
            pageref: address
        });
    });

    return {
        log: {
            version: '1.2',
            creator: {
                name: "PhantomJS",
                version: phantom.version.major + '.' + phantom.version.minor +
                    '.' + phantom.version.patch
            },
            pages: [{
                startedDateTime: startTime.toISOString(),
                id: address,
                title: title,
                pageTimings: {
                    onLoad: casper.endTime - casper.startTime
                }
            }],
            entries: entries
        }
    };
};

// Note - developer can require 'fs' in order to write the har to file system directly
// This example only directly output the har object into the console
var casper = require('casper').create({
        //verbose: true,
        //logLevel: 'debug',
        onError: function(self, m) { // Any "error" level message will be written
            console.log('FATAL:' + m); // on the console output and PhantomJS will
            self.exit(); // terminate
        }
    }), 
    resources = []; // holds a list of resources of a particular page



if (casper.cli.args.length < 1) {
    console.log('Usage: netsniff.js <some URL>');
    casper.exit();
} else {
    var address = casper.cli.args[0];
    
    // we keep track of when page start 
    casper.on('load.started', function() {
        this.startTime = new Date();
    });
    
    // we keep track of when a resource is requested
    casper.on('resource.requested', function(req) {
        resources[req.id] = {
            request: req,
            startReply: null,
            endReply: null
        };
    });

    // we keep track of when a resource is received
    casper.on('resource.received', function(res) {
        if (res.stage === 'start') {
            resources[res.id].startReply = res;
        }
        if (res.stage === 'end') {
            resources[res.id].endReply = res;
        }    
    });
    
    casper.start(address, function() {
        this.endTime = new Date();
        var title = this.evaluate(function () {
            return document.title;
        });
        har = createHAR(address, title, casper.startTime, resources);
        console.log(JSON.stringify(har, undefined, 4));
        this.exit();    
    });
}

casper.run();
