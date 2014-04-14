var AnnotationModel = Backbone.Model.extend({
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
    options.beforeSend = Utils.beforeSendCSRFHandler;

    return Backbone.sync.apply(this, arguments);
  }
});

var AnnotationCollection = Backbone.Collection.extend({
  model: AnnotationModel,

  initialize: function(models, options) {
    this.examPageNumber = options.examPageNumber;
  },

  url: function() {
    return window.location.href + 'exam-page/' + this.examPageNumber + '/annotation/';
  },

  sync: function(method, model, options) {
    option = options || {};
    options.beforeSend = Utils.beforeSendCSRFHandler;

    if (method !== 'read' && method !== 'create') {
      throw 'Can only read or create the list of annotations.';
    }

    return Backbone.sync.apply(this, arguments);
  }
});
