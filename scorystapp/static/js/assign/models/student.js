var StudentModel = Backbone.Model.extend({});

var StudentCollection = Backbone.Collection.extend({
  model: StudentModel,
  url: function() {
    return window.location.href + 'students/';
  },

  sync: function(method, model, options) {
    options = options || {};
    if (method !== 'read') {
      throw 'Can only read the list of students.';
    }

    return Backbone.sync.apply(this, arguments);
  }
});
