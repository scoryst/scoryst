// TODO: browserify
var RubricsNavView = IdempotentView.extend({
  /* Key code for keyboard shortcuts. */
  A_KEY_CODE: 65,

  template: _.template($('.rubrics-nav-template').html()),
  events: {
    'click .toggle-edit': 'toggleEditing',
    'click .disable-edit': 'disableEditing',
    'click .add-rubric': 'addRubric'
  },

  /* Initializes this view. Must be given a DOM element container,
   * a QuestionPartAnswer model, and a list of rubrics. */
  initialize: function(options) {
    this.constructor.__super__.initialize.apply(this, arguments);
    this.rubrics = options.rubrics;

    this.listenToDOM($(window), 'keyup', this.handleShortcuts);
  },

  /* Renders the rubrics navigation. */
  render: function() {
    // deregister any rubric subviews that were added during the last render
    this.deregisterSubview();

    this.$el.html(this.template(this.model.toJSON()));
    var $ol = this.$('ol');

    var self = this;
    var selectedRubrics = this.model.get('rubrics');

    // add header
    var rubricsNavHeader = new RubricsNavHeaderView({
      model: this.model,
      el: this.$('.rubrics-nav-header'),
      rubrics: this.rubrics
    }).render();
    this.registerSubview(rubricsNavHeader);

    // add a view for each rubric
    this.rubrics.each(function(rubric) {
      var rubricView = new RubricView({
        model: rubric,
        questionPartAnswer: self.model,
        editingEnabled: self.$el.hasClass('editing')
      });

      $ol.append(rubricView.render().$el);
      self.registerSubview(rubricView);
    });

    // add custom points
    var customPointsView = new CustomPointsView({ model: this.model });
    $ol.append(customPointsView.render().$el);
    this.registerSubview(customPointsView);

    // add commenting
    var commentView = new CommentView({
      model: this.model,
      el: this.$('.comment-container')
    }).render();
    this.registerSubview(commentView);

    window.resizeNav();
    return this;
  },

  /* Handle A, B, ..., Z keyboard shortcuts for selecting rubrics. */
  handleShortcuts: function(event) {
    // ignore keys entered in an input/textarea
    var $target = $(event.target);
    if ($target.is('input') || $target.is('textarea')) {
      return;
    }

    // trigger click event on the rubric that corresponds to the letter clicked
    var index = event.keyCode - this.A_KEY_CODE;
    if (index >= 0) {
      this.$('li').eq(index).click();
    }
  },

  /* Toggle editing mode for the rubrics navigation. */
  toggleEditing: function(event) {
    event.preventDefault();

    if (this.$el.hasClass('editing')) {
      this.disableEditing();
    } else {
      this.enableEditing();
    }

    resizeNav();
  },

  /* Enable editing mode for the rubrics navigation. */
  enableEditing: function(event) {
    Mediator.trigger('enableEditing');
    this.$el.addClass('editing');
  },

  /* Disable editing mode for the rubrics navigation. */
  disableEditing: function(event) {
    Mediator.trigger('disableEditing');
    this.$el.removeClass('editing');
  },

  /* Adds a rubric with example text to the navigation. */
  addRubric: function(event) {
    var rubric = new RubricModel({
      question_part: this.model.get('question_part').id,
      description: 'Rubric description',
      points: 1
    });

    this.rubrics.add(rubric);

    var self = this;
    rubric.save({}, {
      success: function() {
        var rubricView = new RubricView({
          model: rubric,
          questionPartAnswer: self.model,
          editingEnabled: self.$el.hasClass('editing')
        });

        // add new rubric view before custom points
        self.$el.find('ol li').last().before(rubricView.render().$el);
        self.registerSubview(rubricView);
        rubricView.edit();
      },

      wait: true
    });
  }
});
