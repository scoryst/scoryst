// TODO: browserify
var AssessmentModel = Backbone.Model.extend({
  url: function() {
    return this.collection.url() + this.get('id') + '/';
  },

  sync: function(method, model, options) {
    options = options || {};
    // only read is necessary because all of the creation/edits/deletes are
    // done purely from the backend
    if (method !== 'read') {
      throw 'Can only read assessments.';
    }

    return Backbone.sync.apply(this, arguments);
  }
});

var AssessmentCollection = Backbone.Collection.extend({
  model: AssessmentModel,

  url: function() {
    return window.location.pathname + 'assessment/';
  },

  sync: function(method, model, options) {
    options = options || {};
    if (method !== 'read') {
      throw 'Can only read the list of assessments.';
    }

    return Backbone.sync.apply(this, arguments);
  }
});
