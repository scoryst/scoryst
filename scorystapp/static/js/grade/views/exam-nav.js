// TODO: browserify
var ExamNavView = IdempotentView.extend({
  LEFT_BRACKET_KEY_CODE: 219,
  RIGHT_BRACKET_KEY_CODE: 221,

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

    // events from other elements
    this.listenToDOM($(window), 'keydown', this.handleShortcuts);
  },

  /* Renders the question navigation. */
  render: function() {
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

  handleShortcuts: function(event) {
    switch (event.keyCode) {
      case this.LEFT_BRACKET_KEY_CODE:
        this.goToPreviousQuestionPart();
        break;

      case this.RIGHT_BRACKET_KEY_CODE:
        this.goToNextQuestionPart();
        break;
    }
  },

  goToPreviousQuestionPart: function() {
    var curQuestionPart = this.model.get('questionPart');
    var previousQuestionPartAnswer;

    if (curQuestionPart.partNumber > 1) {
      // find the previous part in the current question
      previousQuestionPartAnswer = this.questionPartAnswers.filter(function(questionPartAnswer) {
        var questionPart = questionPartAnswer.get('questionPart');
        return questionPart.questionNumber === curQuestionPart.questionNumber &&
          questionPart.partNumber === curQuestionPart.partNumber - 1;
      });

      previousQuestionPartAnswer = previousQuestionPartAnswer[0];
    } else {
      // if there is no previous part, find the last part in the previous question
      previousQuestionPartAnswer = this.questionPartAnswers.filter(function(questionPartAnswer) {
        var questionPart = questionPartAnswer.get('questionPart');
        return questionPart.questionNumber === curQuestionPart.questionNumber - 1;
      });

      if (previousQuestionPartAnswer.length > 0) {
        // narrow down to last part
        previousQuestionPartAnswer = _.max(previousQuestionPartAnswer, function(questionPartAnswer) {
          return questionPartAnswer.get('questionPart').partNumber;
        });
      } else {
        // no previous question
        previousQuestionPartAnswer = null;
      }
    }

    if (previousQuestionPartAnswer) {
      Mediator.trigger('changeQuestionPartAnswer', previousQuestionPartAnswer, -1);
    } else {
      // if that didn't work, there is no previous part, so do nothing
    }
  },

  goToNextQuestionPart: function() {
    var curQuestionPart = this.model.get('questionPart');

    // find the next part in the current question
    var nextQuestionPartAnswer = this.questionPartAnswers.filter(function(questionPartAnswer) {
      var questionPart = questionPartAnswer.get('questionPart');
      return questionPart.questionNumber === curQuestionPart.questionNumber &&
        questionPart.partNumber === curQuestionPart.partNumber + 1;
    });

    nextQuestionPartAnswer = nextQuestionPartAnswer[0];

    // if that didn't work, find the next question
    if (!nextQuestionPartAnswer) {
      nextQuestionPartAnswer = this.questionPartAnswers.filter(function(questionPartAnswer) {
        var questionPart = questionPartAnswer.get('questionPart');
        return questionPart.questionNumber === curQuestionPart.questionNumber + 1 &&
          questionPart.partNumber === 1;
      });

      nextQuestionPartAnswer = nextQuestionPartAnswer[0];
    }

    if (nextQuestionPartAnswer) {
      Mediator.trigger('changeQuestionPartAnswer', nextQuestionPartAnswer, 0);
    } else {
      // if that didn't work, there is no next part, so do nothing
    }
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
