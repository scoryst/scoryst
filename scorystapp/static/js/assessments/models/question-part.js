// TODO: browserify
var QuestionPartModel = Backbone.Model.extend({
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
    // only read is necessary because all of the creation/deletes are done
    // purely from the backend
    if (method !== 'read') {
      throw 'Can only read question parts.';
    }

    return Backbone.sync.apply(this, arguments);
  }
});

var QuestionPartCollection = Backbone.Collection.extend({
  model: QuestionPartModel,
  url: function() {
    return window.location.pathname + 'question-part/';
  },

  sync: function(method, model, options) {
    options = options || {};
    if (method !== 'read') {
      throw 'Can only read the list of question parts.';
    }

    return Backbone.sync.apply(this, arguments);
  }
});
