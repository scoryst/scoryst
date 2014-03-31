// TODO: browserify
var ExamNavView = IdempotentView.extend({
  template: _.template($('.exam-nav-template').html()),
  events: {
    'click a': 'triggerChangeQuestionPart',
    'click .toggle-exam-nav': 'toggleExamNav'
  },

  initialize: function(options) {
    this.constructor.__super__.initialize.apply(this, arguments);
    this.questionPartAnswers = options.questionPartAnswers;

    this.listenTo(Mediator, 'changeQuestionPartAnswer',
      this.changeQuestionPartAnswer);

    var self = this;
    this.questionPartAnswers.each(function(questionPartAnswer) {
      // re-render when any answer changes
      self.listenTo(questionPartAnswer, 'change', self.render);
    });
  },

  /* Renders the question navigation. */
  render: function() {
    // TODO: camel case and underscore discrepancy is really annoying; fix!
    var questionPartAnswers = this.questionPartAnswers.toJSON();
    var activeQuestionPartAnswer = this.model.toJSON();
    var lastQuestionNum = -1;

    // total exam statistics
    var isExamGraded = true;
    var examMaxPoints = 0;
    var examPoints = 0;

    questionPartAnswers.forEach(function(questionPartAnswer) {
      var questionPart = questionPartAnswer.questionPart;

      // mark question separators
      if (questionPart.questionNumber !== lastQuestionNum) {
        lastQuestionNum = questionPart.questionNumber;
        questionPart.startsNewQuestion = true;
      }

      // mark active question part answer
      if (questionPartAnswer.id === activeQuestionPartAnswer.id) {
        questionPartAnswer.active = true;
      }

      // compute overall exam statistics
      // TODO: change this to isGraded once Catherine is done
      isExamGraded = isExamGraded && questionPartAnswer.isGraded;
      examMaxPoints += questionPart.maxPoints;

      if (questionPartAnswer.isGraded) {
        examPoints += questionPartAnswer.points;
      }
    });

    var templateData = {
      isExamGraded: isExamGraded,
      examMaxPoints: examMaxPoints,
      examPoints: examPoints,
      activeQuestionPartAnswer: activeQuestionPartAnswer,
      questionPartAnswers: questionPartAnswers
    };
    this.$el.html(this.template(templateData));

    window.resizeNav();
    return this;
  },

  /* Triggers the changeQuestionPartAnswer event when a part is clicked. */
  triggerChangeQuestionPart: function(event) {
    event.preventDefault();

    var questionPartAnswerId = $(event.currentTarget).
      attr('data-question-part-answer');
    questionPartAnswerId = parseInt(questionPartAnswerId, 10);

    Mediator.trigger('changeQuestionPartAnswer', this.questionPartAnswers.
      get(questionPartAnswerId));
  },

  /* Changes the active question part answer. */
  changeQuestionPartAnswer: function(questionPartAnswer) {
    this.model = questionPartAnswer;
    this.render();
  },

  /* Toggles the visibility of the exam navigation. */
  toggleExamNav: function() {
    this.$el.toggleClass('nav-hidden');
  }
});
