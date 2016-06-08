// Add/Remove/View webhooks
function Command() {
  this.names = ["webhook", "hook"];
  this.perms = ["trello.admin", "trello.webhook", "AKP48.op"];
}

Command.prototype.process = function(context, app) {
  var trello = app.trello; // trello.get|post|put|del(uri, [query], callback)
  var sendMessage = app._AKP48.sendMessage;
  var args = context.args;
  if (!args.length) {
    if (!app.config.token) return;
    return trello.get(`tokens/${app.config.token}/webhooks`, handleHook("Error while retreiving existing webhooks", function (data) {
      // TODO: Update message
      sendMessage(JSON.stringify(data), context);
    }));
  }
  
  switch(args[0].toLowerCase()) {
    case 'url':
    case 'callback':
      if (args.length !== 3) {
        return sendMessage(`Command syntax: ${args[0]} <webhook id> <url>`, context);
      }
      return trello.post(`webhooks/${args[1]}/callbackURL`, {value: args[2]}, handleHook("Error while modifying webhook callbackURL", function (data) {
        // TODO: Update message
        sendMessage(JSON.stringify(data), context);
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
    sendMessage(`Created Trello Webhook (${data.id})`, context);
  });
  
  function handleHook(onError, onData) {
    if (!(onError && onData))) {
      throw new Error("handleHook requires at least one parameter!");
    } else if (!onData && typeof onError !== 'function') {
      throw new Error("handleHook requires a function to handle data!");
    } else {
      onData = onError;
      onError = "Error while handling webhook.";
    }
    
    return function (err, data) {
      if (err) {
        if (typeof onError === 'function') {
          return onError(err);
        } else {
          sendMessage(onError, context);
          return global.logger.error(onError, err);
        }
      }
      onData(data);
    }
  }
};

module.exports = Command;
