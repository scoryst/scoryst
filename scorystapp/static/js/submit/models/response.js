// TODO: browserify
var ResponseModel = Backbone.Model.extend({
  url: function() {
    return this.collection.url() + this.get('id') + '/';
  },

  sync: function(method, model, options) {
    options = options || {};
    options.beforeSend = Utils.beforeSendCSRFHandler;

    // can only update responses
    if (method !== 'update') {
      throw "Can only update a response.";
    }

    return Backbone.sync.apply(this, arguments);
  }
});

var ResponseCollection = Backbone.Collection.extend({
  model: ResponseModel,
  url: function() {
    return window.location.pathname + 'response/';
  },

  sync: function(method, model, options) {
    options = options || {};
    if (method !== 'read') {
      // we only allow reading the list of question parts
      throw 'Can only read the list of responses.';
    }

    return Backbone.sync.apply(this, arguments);
  }
});
