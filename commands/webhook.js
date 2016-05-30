// Add/Remove/View webhooks
function Command() {
  this.names = ["webhook", "hook"];
  this.perms = ["trello.admin", "trello.webhook", "AKP48.op"];
}

Command.prototype.process = function(context, app) {
  // What if we want to edit a webhook? Too freaking bad
  var trello = app.trello; // trello.get|post|put|del(uri, [query], callback)
  var model, desc;
  var args = context.args;
  if (!args.length) { // We should be storing webhooks and returning the ids of webhooks that have been created
    return;
  } else if (args.length === 1) { // We only have a model
    model = args[0];
  } else if (args.length >= 2) { // We have a model and description
    model = args.shift();
    desc = args.join(" ");
  }
  
  var tArgs = {
    idModel: model,
    callbackURL: app.callback,
  };
  if (desc) tArgs.desc = desc;
  trello.post("webhooks", tArgs, function (err, data) {
    if (err) {
      return global.logger.error("Error while adding webhook", err);
    }
    global.logger.info(JSON.stringify(data));
    app._AKP48.sendMessage(JSON.stringify(data), context);
  });
};

module.exports = Command;
