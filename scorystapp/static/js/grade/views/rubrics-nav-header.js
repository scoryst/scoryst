// TODO: browserify
var RubricsNavHeaderView = IdempotentView.extend({
  template: _.template($('.rubrics-nav-header-template').html()),

  /* Initializes this header. Requires a Response model. */
  initialize: function(options) {
    this.constructor.__super__.initialize.apply(this, arguments);
    this.rubrics = options.rubrics;

    this.listenTo(this.model, 'change:graded change:points', this.render);
    this.listenTo(this.rubrics, 'change remove', function() {
      // points received for this answer may change when rubrics are modified,
      // so update the Response model
      this.model.fetch();
    });
  },

  render: function() {
    var response = this.model.toJSON();
    this.$el.html(this.template(response));
    return this;
  }
});
