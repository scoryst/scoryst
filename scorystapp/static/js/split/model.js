// TODO: browserify
var SplitPageModel = Backbone.Model.extend({
  url: function() {
    var id = this.get('id');
    var collectionURL = this.collection.url();

    if (id) {
      return collectionURL + id + '/';
    } else {
      return collectionURL;
    }
  },

  sync: function(method, model, options) {
    options = options || {};

    if (method !== 'read' && method !== 'update') {
     // we only allow reading/updating pages
     throw 'Can only read or update pages.';
    }

    options.beforeSend = Utils.beforeSendCSRFHandler;
    return Backbone.sync.apply(this, arguments);
  }
});

var SplitPageCollection = Backbone.Collection.extend({
  model: SplitPageModel,
  url: function() {
    return window.location.href + 'pages/';
  }
});
