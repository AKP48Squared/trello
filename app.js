'use strict';
const PLUGIN_NAME = "Trello"; // Set this
const PLUGIN = global.AKP48.pluginTypes.MessageHandler; // [BackgroundTask, MessageHandler, ServerConnector]
const Trello = require("node-trello");
const Web = require("./webserver");
const logger = global.logger;

class app extends PLUGIN {
  constructor(AKP48, _config) {
    super(PLUGIN_NAME, AKP48, _config);
    if (!_config) {
      _config = {
        key: "", // Required
        token: "", // Optional
        board: "", // Default board to use
        list: "", // Default list to use
        port: "", // Defaults to 12345
        host: "", // Defaults to 0.0.0.0
        path: "", // Defaults to trello/callback
      };
    }
    this.config = _config;
    this.saveConfig();
    if (!this.config.key) throw Error("Trello Key required");
    if (!this.config.board) throw Error("Trello Board required");
    this.listener = new Web({
      port: this.config.port,
      host: this.config.host,
    });
    this.trello = new Trello(this.config.key, this.config.token);
    
    require('./commands').then(function(res) {
      self.commands = res;
    }, function(err){
      throw Error(err);
    });
  }
}

app.prototype.saveConfig = function () {
  this._AKP48.saveConfig(this.config, this._pluginName);
};

app.prototype.handleCommand = function(message, context, resolve) {
  if (!context.isCmd) return;
  var args = message.split(" ");
  var command = args.shift();
  if ("trello" === command.toLowerCase()) {
    command = args.shift(); // The command is the next word
  }
  if (!command) return;
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

module.exports = app;