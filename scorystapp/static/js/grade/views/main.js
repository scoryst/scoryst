var MainView = IdempotentView.extend({
  initialize: function(options) {
    this.constructor.__super__.initialize.apply(this, arguments);
    this.questionPartAnswers = new QuestionPartAnswerCollection();

    this.$examNav = this.$('.exam-nav');
    this.$rubricsNav = this.$('.rubrics-nav');

    var self = this;
    this.questionPartAnswers.fetch({
      success: function() {
        var questionPartAnswer = self.questionPartAnswers.filter(
          function(questionPartAnswer) {
            var questionPart = questionPartAnswer.get('question_part');

            // find the question part that matches the given active question/part numbers
            return questionPart.question_number === options.activeQuestionNumber &&
              questionPart.part_number === options.activePartNumber;
          })[0];

        // default to first question part answer
        if (!questionPartAnswer) {
          questionPartAnswer = self.questionPartAnswers.at(0);
        }

        self.renderExamPDF(questionPartAnswer);
        self.renderStudentNav();

        self.renderExamNav(questionPartAnswer);
        self.renderRubricsNav(questionPartAnswer);
        self.addMediatorListeners();
      },

      error: function() {
        // TODO: handle error
      }
    });
  },

  addMediatorListeners: function() {
    var self = this;
    // update rubrics nav whenever question part changes
    this.listenTo(Mediator, 'changeQuestionPartAnswer', function(questionPartAnswer) {
      self.renderRubricsNav(questionPartAnswer);
    });
  },

  renderExamPDF: function(questionPartAnswer) {
    var examPDFView = new ExamPDFView({
      el: this.$('.exam'),
      model: questionPartAnswer,
      questionPartAnswers: this.questionPartAnswers
    });

    this.registerSubview(examPDFView);
  },

  renderStudentNav: function() {
    var studentNavView = new StudentNavView({ el: this.$('.student-nav') });
    this.registerSubview(studentNavView);
  },

  renderExamNav: function(questionPartAnswer) {
    var examNav = new ExamNavView({
      el: this.$examNav,
      model: questionPartAnswer,
      questionPartAnswers: this.questionPartAnswers
    }).render();

    this.registerSubview(examNav);
  },

  renderRubricsNav: function(questionPartAnswer) {
    this.fetchRubrics(questionPartAnswer, function(rubrics) {
      if (this.rubricsNavView) {
        // get rid of old view if one exists
        this.deregisterSubview(this.rubricsNavView);
      }

      this.rubricsNavView = new RubricsNavView({
        el: this.$rubricsNav,
        model: questionPartAnswer,
        rubrics: rubrics
      }).render();

      this.registerSubview(this.rubricsNavView);
    });
  },

  fetchQuestionPartAnswer: function(questionPart, callback) {
    var questionPartAnswer = new QuestionPartAnswerModel({
      'question_part': { id: questionPart.get('id') }
    });

    var self = this;
    questionPartAnswer.fetch({
      success: function() {
        _.bind(callback, self)(questionPartAnswer);
      },

      error: function() {
        // TODO: handle error
      }
    });
  },

  fetchRubrics: function(questionPartAnswer, callback) {
    var rubrics = new RubricCollection({}, {
      questionPartAnswer: questionPartAnswer
    });

    var self = this;
    rubrics.fetch({
      success: function() {
        _.bind(callback, self)(rubrics);
      },

      error: function() {
        // TODO: handle error
      }
    });
  }
});

$(function() {
  // TODO: the active question/part numbers are global to all exams (midterm,
  // final, etc), when they should be local to the current exam. nevertheless,
  // making them local is annoying, and having invalid question/part numbers
  // just defaults back to the first question/part, so I think this is fine
  var activeQuestionNumber = $.cookie('activeQuestionNumber') || 1;
  var activePartNumber = $.cookie('activePartNumber') || 1;

  /* Keep track of the active question/part number. */
  Mediator.on('changeQuestionPartAnswer', function(questionPartAnswer) {
    var questionPart = questionPartAnswer.get('question_part');
    activeQuestionNumber = questionPart.question_number;
    activePartNumber = questionPart.part_number;

    $.cookie('activeQuestionNumber', activeQuestionNumber, { path: '/' });
    $.cookie('activePartNumber', activePartNumber, { path: '/' });
  });

  var $grade = $('.grade');
  var mainView = new MainView({
    el: $grade,
    activeQuestionNumber: activeQuestionNumber,
    activePartNumber: activePartNumber
  });

  /* Change student by re-rendering main view. */
  Mediator.on('changeStudent', function() {
    mainView.removeSideEffects();

    mainView = new MainView({
      el: $grade,
      activeQuestionNumber: activeQuestionNumber,
      activePartNumber: 1
    });

    activePartNumber = 1;
    $.cookie('activePartNumber', activePartNumber, { path: '/' });
  });
});
