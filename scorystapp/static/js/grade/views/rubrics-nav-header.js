// TODO: browserify
var RubricsNavHeaderView = IdempotentView.extend({
  template: _.template($('.rubrics-nav-header-template').html()),

  /* Initializes this header. Requires a QuestionPartAnswer model. */
  initialize: function(options) {
    this.constructor.__super__.initialize.apply(this, arguments);
    this.rubrics = options.rubrics;

    this.listenTo(this.model, 'change:is_graded change:points', this.render);
    this.listenTo(this.rubrics, 'change remove', function() {
      // points received for this answer may change when rubrics are modified,
      // so update the QuestionPartAnswer model
      this.model.fetch();
    });
  },

  render: function() {
    var questionPartAnswer = this.model.toJSON();
    this.$el.html(this.template(questionPartAnswer));
    return this;
  }
});
