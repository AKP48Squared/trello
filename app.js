'use strict';
const color = require('irc-colors');
const logger = global.logger;
logger.info("Loading Trello");
const PLUGIN_NAME = "Trello"; // Set this
const PLUGIN = global.AKP48.pluginTypes.MessageHandler; // [BackgroundTask, MessageHandler, ServerConnector]
logger.info("Loading webserver");
const Trello = require("node-trello");
const Web = require("./webserver");
logger.info("Loaded webserver");

class app extends PLUGIN {
  constructor(AKP48, _config) {
    super(PLUGIN_NAME, AKP48, _config);
    if (!this._config) {
      this._config = {
        key: "", // Required
        token: "", // Optional
        url: "", // Required if you don't use a host, must point to server
        board: "", // Default board to use
        list: "", // Default list to use
        port: "", // Defaults to 12345
        host: "", // Defaults to 0.0.0.0
        path: "", // Defaults to /trello/callback
      };
      this.saveConfig();
    }
    this.config = this._config;
    var url = this.config.url || this.config.host; // Fallback to host if URL not set
    if (!this.config.key) throw Error("Trello Key required");
    if (!url) throw Error("Trello url/host required, must point to your server (can be your IP)");
    this.listener = new Web({
      port: this.config.port,
      host: this.config.host,
      path: this.config.path,
    });
    this.callback = url + ":" + (this.config.port || "12345") + this.listener.path;
    this.listener.listen();
    this.trello = new Trello(this.config.key, this.config.token);
    
    var request = this.trello.request.bind(this.trello);
    this.trello.request = function (method, uri, args, callback) {
      request(method, "/1/"+uri, args, callback);
    };
    var self = this;
    require('./commands').then(function(res) {
      self.commands = res;
    }, function(err) {
      throw err;
    });
    
    function alert(data) {
      data.link = data.link ? " https://trello.com/"+data.link:"";
      data.action = data.action ? " "+data.action:"";
      AKP48.emit("alert", `Trello[${data.board}] ${data.user}${data.action}: ${data.msg}${data.link}`);
    }
    
    this.listener.on("createCard", function(res) {
      alert({
        board : [color.bold(res.data.board.name), res.data.list.name].join("/"),
        user  : res.memberCreator.fullName,
        msg   : res.data.card.name,
        link  : `c/${res.data.card.shortLink}`,
        action: "created card",
      });
    }).on("commentCard", function(res) {
      alert({
        board : [color.bold(res.data.board.name), res.data.card.name].join("/"),
        user  : res.memberCreator.fullName,
        msg   : res.data.text,
        link  : `c/${res.data.card.shortLink}/#comment-${res.id}`,
        action: "commented",
      });
    }).on("updateCard", function(res) {
      if (!(res.data.old)) return; // This is a malformed event
      var list = res.data.list ? res.data.list.name : "",
          card = res.data.card ? res.data.card.name : "",
          old = res.data.old,
          msg, action;
      if (old.hasOwnProperty("closed")) { // Archived
        if (old.closed) { // Moved out of archive
          msg = "from archive";
        } else { // Moved to archive
          msg = "to archive";
        }
        action = "moved card";
      } else if (res.data.card && res.data.card.closed) { // Don't send a message if we're editing an archived card
        return;
      } else if (old.idList) { // Moved
         msg = `from "${res.data.listBefore.name}" to "${res.data.listAfter.name}"`;
         action = "moved card";
      } else if (old.name) { // Renamed
        msg = `"${old.name}" to "${card}"`;
        action = "renamed card";
        card = null;
      } else if (old.hasOwnProperty("desc")) { // Description modified
        if (!old.desc) {
          msg = "Added description";
        } else if (!res.data.card.desc) {
          msg = "Removed description";
        } else {
          msg = "Modified description";
        }
      }
      if (msg) alert({
        board : [color.bold(res.data.board.name), card].filter((e) => e).join("/"), // Filter out empty elements
        user  : res.memberCreator.fullName,
        msg   : msg,
        link  : res.data.card.shortLink?`c/${res.data.card.shortLink}`:"",
        action: action,
      });
    }).on("deleteCard", function(res) {
      alert({
        board : color.bold(res.data.board.name),
        user  : res.memberCreator.fullName,
        msg   : res.data.card.name || `#${res.data.card.idShort}`,
        action: "deleted card",
      });
    });
  }
}

app.prototype.handleCommand = function(message, context, resolve) {
  logger.info("Received command");
  var args = message.split(" ");
  var command = args.shift();
  if ("trello" === command.toLowerCase()) {
    command = args.shift(); // The command is the next word
  }
  if (!command) return logger.info("No command?!");
  context.text = args.join(" "); // Update the text
  context.args = args; // Add args
  for (var key of Object.keys(this.commands)) {
    logger.silly(`Checking ${key} command for ${command}.`);
    var cmd = this.commands[key];
    if (!cmd.process) continue; // Why work if we can't run?
    if (!cmd.names.includes(command.toLowerCase())) continue;
    if (cmd.perms && cmd.perms.length) {
      if (!context.permissions || !Array.isArray(context.permissions)) {
        logger.debug(`Command ${command} requires permissions and none were found.`);
        continue;
      }
      if (!Array.isArray(cmd.perms)) cmd.perms = [cmd.perms]; // Make it an array
      var block = true;
      for (var i = 0; i < cmd.perms.length; i++) {
        if (context.permissions.includes(cmd.perms[i])) {
          block = false;
          break;
        }
      }
      if (block) {
        logger.debug(`Command ${command} requires permissions and none were found.`);
        continue;
      }
    }
    // Passed all checks, run the command
    cmd.process(context, this);
  }
};

app.prototype.unload = function () {
  this.listener.stop();
};

module.exports = app;
