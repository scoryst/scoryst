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
    options.beforeSend = ModelUtils.beforeSendCSRFHandler;

    return Backbone.sync.apply(this, arguments);
  }
});

var AnnotationCollection = Backbone.Collection.extend({
  model: AnnotationModel,

  initialize: function(models, options) {
    this.questionPartAnswer = options.questionPartAnswer.id;
    this.examPageNumber = options.examPageNumber;  /* TODO: Change. */
  },

  url: function() {
    return window.location.href + 'question-part-answer/' + this.questionPartAnswer +
      '/exam-page/' + this.examPageNumber + '/annotation/';
  },

  sync: function(method, model, options) {
    option = options || {};
    options.beforeSend = ModelUtils.beforeSendCSRFHandler;

    if (method !== 'read' && method !== 'create') {
      // We only allow reading the list of annotations
      throw 'Can only read or create the list of annotations.';
    }

    return Backbone.sync.apply(this, arguments);
  }
});
