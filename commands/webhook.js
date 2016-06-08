// Add/Remove/View webhooks
function Command() {
  this.names = ["webhook", "hook"];
  this.perms = ["trello.admin", "trello.webhook", "AKP48.op"];
}

Command.prototype.process = function(context, app) {
  // What if we want to edit a webhook? Too freaking bad
  var trello = app.trello; // trello.get|post|put|del(uri, [query], callback)
  var sendMessage = app._AKP48.sendMessage;
  var model, desc;
  var args = context.args;
  if (!args.length) {
    if (!app.config.token) return;
    return trello.get(`tokens/${app.config.token}/webhooks`, function (err, data) {
      if (err) {
        return global.logger.error("Error while retreiving existing webhooks", err);
      }
      sendMessage(JSON.stringify(data), context); // TODO: Update message
    });
  }
  
  switch(args[0].toLowerCase()) {
    case 'url':
    case 'callback':
      if (args.length !== 3) {
        return sendMessage(`Command syntax: ${args[0]} <webhook id> <url>`, context);
      }
      return trello.post(`webhooks/${args[1]}/callbackURL`, {value: args[2]}, function (err, data) {
        if (err) {
          // TODO: send error response
          return global.logger.error("Error while modifying webhook callbackURL", err);
        }
        sendMessage(JSON.stringify(data), context); // TODO: Update message
      });
  }
  
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
  trello.post("webhooks", tArgs, function (err, data) {
    if (err) {
      return global.logger.error("Error while adding webhook", err);
    }
    global.logger.info(JSON.stringify(data));
    // data.idModel: Model listening to
    // data.callbackURL: URL responding to
    sendMessage(`Created Trello Webhook (${data.id})`, context);
  });
};

module.exports = Command;
