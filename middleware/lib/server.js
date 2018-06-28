/* server related tasks */
// Dependencies
var http = require('http');
var https = require('https');
var url = require('url');
var StringDecoder = require('string_decoder').StringDecoder;
var config = require('./config');
var fs = require('fs');
var handlers = require('./handlers');
var helpers = require('./helpers');
var path = require('path');

//instantiate the server module object;

var server = {
    'httpServer' : http.createServer(function(req, res) {
        server.unifiedServer(req, res);
    }),
    'httpsServerOptions' : {
        'key': fs.readFileSync(path.join(__dirname,'/../https/key.pem')),
        'cert': fs.readFileSync(path.join(__dirname,'/../https/cert.pem'))
      },
    'httpsServer' : https.createServer(this.httpsServerOptions, function(req, res) {
        server.unifiedServer(req, res);
    }),
    'init' : function() {
        //start the http server
        server.httpServer.listen(config.httpPort, function() {
            console.log('The server is listening on port ' + config.httpPort + ' in ' + config.envName + ' now');
        });

        //start the https server
        server.httpsServer.listen(config.httpsPort, function() {
            console.log('The server is listening on port '+ config.httpsPort + ' in ' + config.envName + ' now');
         });
    }, 
    'unifiedServer' : function(req, res) {
        var parsedUrl = url.parse(req.url, true);
        //get the path 
        var path = parsedUrl.pathname;
        var trimmedPath = path.replace(/^\/+|\/+$/g, '');
        // Get the query string 
        var queryStringObject = parsedUrl.query;
        //get the method 
        var method = req.method.toLowerCase();

        //get the headers as an object 
        var headers = req.headers;
        //get the payload, if any 

        var decoder = new StringDecoder('utf-8');
        var buffer = '';
    
        req.on('data', function(data) {
            buffer += decoder.write(data);
        });

        req.on('end', function() {
            buffer += decoder.end();

            //choose 
            var chosenHandler = typeof(server.router[trimmedPath]) !== 'undefined' ? server.router[trimmedPath] : handlers.notFound;
        
            //construct the data object to send to the handler 
            var data = {
                'trimmedPath' : trimmedPath,
                'queryStringObject' : queryStringObject,
                'method' : method,
                'headers' : headers,
                'payload' : helpers.parseJSONToObject(buffer)
            };

            //rounte the request to the handler specified in the

            chosenHandler(data, function(statusCode, payload){
                statusCode = typeof(statusCode) == 'number' ? statusCode : 200;
                payload = typeof(payload) == 'object' ? payload : {};
                var payloadString = JSON.stringify(payload);
                res.setHeader('Content-Type', 'application/json');
                res.writeHead(statusCode);
                res.end(payloadString);

                console.log('Returning this response ', statusCode, payloadString);
            });
        });

    },
    'router' : {
        'ping' : handlers.ping,
        'users' : handlers.users,
        'tokens' : handlers.tokens,
        'checks' : handlers.checks
    }

};



module.exports = server;