var colors = require("irc-colors");

// Add/Remove/View webhooks
function Command() {
  this.names = ["webhook", "hook"];
  this.perms = ["trello.admin", "trello.webhook", "AKP48.op"];
}

Command.prototype.process = function(context, app) {
  var trello = app.trello; // trello.get|post|put|del(uri, [query], callback)
  var sendMessage = function (message) {
    app._AKP48.sendMessage(message, context)
  };
  var args = context.args;
  if (!args.length) {
    if (!app.config.token) return;
    return trello.get(`tokens/${app.config.token}/webhooks`, handleHook("Error while retreiving existing webhooks", function (data) {
      data.forEach(function(hook) {
        // TODO: include hook.idModel
        // TODO: use /types/{idModel} to get type then do an active lookup
        sendMessage(`Trello Webhook [${hook.active ? colors.green(hook.id) : colors.red(hook.id)}]: ${hook.description || "No description"}`);
      });
    }));
  }
  
  switch(args[0].toLowerCase()) {
    case 'url':
    case 'callback':
      if (args.length !== 3) {
        return sendMessage(`Command syntax: ${args[0]} <webhook id> <url>`);
      }
      return trello.put(`webhooks/${args[1]}/callbackURL`, {value: args[2]}, handleHook("Error while modifying webhook callbackURL", function (data) {
        global.logger.debug(JSON.stringify(data));
        sendMessage("Modified callbackURL");
      }));
    case 'description':
    case 'desc':
      if (args.length < 3) {
        return sendMessage(`Command syntax: ${args[0]} <webhook id> <description>`, context);
      }
      return trello.put(`webhooks/${args[1]}/description`, {value: args.splice(2).join(" ")}, handleHook(function (data) {
        global.logger.debug(JSON.stringify(data));
        sendMessage("Modified description");
      }));
  }
  
  var model, desc;
  if (args.length === 1) { // We only have a model
    model = args[0];
  } else if (args.length >= 2) { // We have a model and description
    model = args.shift();
    desc = args.join(" ");
  }
  
  var tArgs = {
    idModel: model,
    callbackURL: app.callback,
  };
  if (desc) tArgs.description = desc;
  trello.post("webhooks", tArgs, handleHook("Error while adding webhook", function (data) {
    // data.id: Webhook id
    // data.description: webhook description
    // data.idModel: Model listening to
    // data.callbackURL: URL responding to
    // data.active: on/off
    sendMessage(`Created Trello Webhook (${data.id})`);
  }));
  
  function handleHook(onError, onData) {
    if (!(onError || onData)) {
      throw new Error("handleHook requires at least one parameter!");
    } else if (!onData) {
      if (typeof onError !== 'function') {
        throw new Error("handleHook requires a function to handle data!");
      }
      onData = onError;
      onError = "Error while handling webhook.";
    }
    return function onHook(err, data) {
      if (err) {
        if (typeof onError === 'function') {
          return onError(err);
        } else {
          sendMessage(onError);
          return global.logger.error(onError, err);
        }
      }
      onData(data);
    };
  }
};

module.exports = Command;
