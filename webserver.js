'use strict';
const http = require("http");
const url = require("url");
const util = require("util");
const EventEmitter = require("events").EventEmitter;
const logger = global.logger;

function serverHandler(req, res) {
  // We must reply 200 on HEAD requests
  if (req.method === "HEAD") {
    return reply(200, res);
  }
  
  var url = Url.parse(req.url, true);
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
  
  req.on("end", function (chunk) {
    if (failed) return;
    add(chunk);
    
    logger.debug("Received %d bytes from %s", bufferLength, remoteAddress);
    
    if (req.headers['content-type'] === 'application/x-www-form-urlencoded') return logger.debug("We received a form!");
    var data = Buffer.concat(buffer, bufferLength);
    
    // TODO: Verify webhooksignature headers['x-trello-webhook']
    
    data = JSON.parse(data);
    
  });
  
  logger.debug(req.method, req.url, remoteAddress);
  
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
};

util.inherits(webserver, EventEmitter);

webserver.prototype.checkUrl = function (url) {
  logger.silly(url);
  // Pathname is the same, or it starts with pathname
  return url.pathname === this.path || url.pathname.indexOf(this.path) === 0;
}

webserver.prototype.listen = function (callback) {
  this.server.listen(this.port, this.host, function () {
    if (typeof callback !== 'function') return;
    callback();
  });
};

module.exports = webserver;
