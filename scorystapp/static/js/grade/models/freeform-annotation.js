var FreeformAnnotationModel = Backbone.Model.extend({
  initialize: function(options) {
    this.assessmentPageNumber = options.assessmentPageNumber;
    console.log(this.assessmentPageNumber);
  },

  url: function() {
    return window.location.href + 'assessment-page/' + this.assessmentPageNumber + '/freeform-annotation/';
  },

  sync: function(method, model, options) {
    options = options || {};
    options.beforeSend = Utils.beforeSendCSRFHandler;

    return Backbone.sync.apply(this, arguments);
  }
});
