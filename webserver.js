'use strict';
const http = require("http");
const URL = require("url");
const util = require("util");
const EventEmitter = require("events").EventEmitter;
const logger = global.logger;
const AKP48 = global.AKP48;

function serverHandler(req, res) {
  var buffer = [];
  var bufferLength = 0;
  var failed = false, isForm = false;
  var remoteAddress = req.headers['x-forwarded-for'] || req.ip || req.socket.remoteAddress || req.socket.socket.remoteAddress;
  
  function add(chunk) {
    if (!chunk || failed) return;
    buffer.push(chunk);
    bufferLength += chunk.length;
  }
  
  function fail(n) {
    if (!failed) {
      failed = true;
      // Clear data
      buffer = [];
      bufferLength = 0;
    }
    return reply(n, res);
  }
  
  req.on("data", function (chunk) {
    add(chunk);
  });
  
  var self = this;
  req.on("end", function (chunk) {
    //logger.debug(JSON.stringify(req.headers));
    if (failed) return;
    add(chunk);
    
    logger.debug("Received %d bytes from %s", bufferLength, remoteAddress);
    
    if (req.headers['content-type'] === 'application/x-www-form-urlencoded') return logger.error("We received a form!");
    var data = Buffer.concat(buffer, bufferLength);
    
    // TODO: Verify webhooksignature headers['x-trello-webhook']
    
    data = JSON.parse(data);
    if (!data) {
      logger.error("received invalid data from %s, returning 400", remoteAddress);
      return reply(400, res);
    }
    
    // Reply before processing the events... Trello will try again if they don't get a reply
    reply(200, res);
    
    data.request = req;
    logger.debug(JSON.stringify(data.action));
    var data = data.action,
        action = data.type,
        board = data.data.board.name;
    //global.AKP48.emit("alert", [board, action].join("/"));
    self.emit("*", action, data); // Send to "generic" listeners
    self.emit(board, action, data); // Send to "board" listeners
    self.emit(action, data); // Send to "action" listeners
  });
  
  // Fail if the URL isn't correct
  if (!this.checkUrl(URL.parse(req.url, true))) {
    return fail(404);
  }
  
  // We must reply 200 on HEAD requests
  if (req.method === "HEAD") {
    return reply(200, res);
  }
  
  if (req.method !== 'POST') {
    return fail(405);
  }
  
  if (!req.headers.hasOwnProperty('x-trello-webhook')) {
    return fail(400);
  }
}

var webserver = function (options) {
  if (!(this instanceof webserver)) return new webserver(options);
  options = options || {};
  this.port = options.port || 12345;
  this.host = options.host || "0.0.0.0";
  this.path = options.path || "/trello/callback";
  
  this.server = http.createServer(serverHandler.bind(this));
  EventEmitter.call(this); // Initialize EventEmitter
};

util.inherits(webserver, EventEmitter);

webserver.prototype.checkUrl = function (url) {
  // Pathname is the same, or it starts with pathname
  return url.pathname === this.path || url.pathname.indexOf(this.path + "/") === 0;
}

webserver.prototype.listen = function (callback) {
  var self = this;
  if (!self.server) { // We've stopped listening at some point
    self.server = http.createServer(serverHandler.bind(self));
  }
  self.server.listen(self.port, self.host, function () {
    logger.debug("listening for trello webhooks on %s:%d", self.host, self.port);
    if (typeof callback !== 'function') return;
    callback();
  });
};

webserver.prototype.stop = function (callback) {
  var self = this;
  self.server.close(function () {
    logger.debug('stopped listening for trello webhooks');
    self.server = null;
    if (typeof callback !== 'function') return;
    callback();
  });
};

module.exports = webserver;

function reply(statusCode, res) {
  var message = { message: http.STATUS_CODES[statusCode].toLowerCase() };
  message.result = statusCode >= 400 ? 'error' : 'ok';
  message = JSON.stringify(message);
  var headers = {
    'Content-Type': 'application/json',
    'Content-Length': message.length
  };

  res.writeHead(statusCode, headers);
  res.end(message);
}
