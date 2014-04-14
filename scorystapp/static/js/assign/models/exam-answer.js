var ExamAnswerModel = Backbone.Model.extend({
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
      // we only allow reading/updating a single instance
      throw 'Can only read or update exam answers.';
    }

    options.beforeSend = Utils.beforeSendCSRFHandler;
    return Backbone.sync.apply(this, arguments);
  }
});

var ExamAnswerCollection = Backbone.Collection.extend({
  model: ExamAnswerModel,

  url: function() {
    return window.location.href + 'exam-answers/';
  },

  sync: function(method, model, options) {
    option = options || {};
    options.beforeSend = Utils.beforeSendCSRFHandler;

    if (method !== 'read') {
      throw 'Can only read the list of examAnswers.';
    }

    return Backbone.sync.apply(this, arguments);
  }
});
