// TODO: browserify
var CustomPointsView = IdempotentView.extend({
  tagName: 'li',
  className: 'custom-points',

  template: _.template($('.custom-points-template').html()),
  events: {
    'click': 'focusOrDeselect',
    'keydown input': 'updateCustomPoints'
  },

  /* Initializes the custom points field. Requires a QuestionPartAnswer model. */
  initialize: function(options) {
    this.constructor.__super__.initialize.apply(this, arguments);
    this.enableUpdate = true;
    this.listenTo(this.model, 'change:customPoints', this.render);

    this.listenTo(Mediator, 'enableEditing', this.enableEditing);
    this.listenTo(Mediator, 'disableEditing', this.disableEditing);
  },

  /* Renders the custom points field in a new li element. */
  render: function() {
    var questionPartAnswer = this.model.toJSON();
    if (_.isNumber(questionPartAnswer.customPoints)) {
      this.$el.addClass('selected');
    } else {
      this.$el.removeClass('selected');
    }

    this.$el.html(this.template(questionPartAnswer));

    // disable input while editing
    if (!this.enableUpdate) {
      this.$('input').prop('disabled', 'true');
    }

    return this;
  },

  /* Don't allow user to update custom points when in editing mode. */
  enableEditing: function(event) {
    this.enableUpdate = false;
    this.render();
  },

  disableEditing: function(event) {
    this.enableUpdate = true;
    this.render();
  },

  /* If the custom points field is already selected, deselect it. Otherwise,
   * focus the input. */
  focusOrDeselect: function() {
    if (!this.enableUpdate) {
      return;
    }

    var $target = $(event.target);

    if (this.$el.hasClass('selected')) {
      // don't deselect custom points if the input was clicked
      if (!$target.is('input')) {
        this.model.save({ customPoints: null }, { wait: true });
      }
    } else {
      // custom points is not selected and was just clicked; focus input
      this.$('.custom-points').focus();
    }
  },

  /* Updates the question part answer's custom points field. This function is
   * debounced, so it's only called once the input stops arriving. */
  updateCustomPoints: _.debounce(function(event) {
    if (!this.enableUpdate) {
      return;
    }

    var customPoints = parseFloat($(event.currentTarget).val(), 10);
    var newModelProperties;

    this.model.save({
      // only set a valid number of custom points
      customPoints: isNaN(customPoints) ? null : customPoints
    }, { wait: true });
  }, 1000)
});
