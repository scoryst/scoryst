// TODO: browserify
var ExamPDFView = IdempotentView.extend({
  /* Key codes for keyboard shorcuts. */
  LEFT_ARROW_KEY_CODE: 37,
  RIGHT_ARROW_KEY_CODE: 39,
  LEFT_BRACKET_KEY_CODE: 219,
  RIGHT_BRACKET_KEY_CODE: 221,

  events: {
    'click .previous-page': 'goToPreviousPage',
    'click .next-page': 'goToNextPage'
  },

  // TODO: comments
  initialize: function(options) {
    this.constructor.__super__.initialize.apply(this, arguments);

    // if there's a next student button on this page, we should preload
    // the next/previous student
    var shouldPreloadStudent = false;
    if ($('.next-student').length > 0) {
      shouldPreloadStudent = true;
    }

    this.questionPartAnswers = options.questionPartAnswers;
    this.imageLoader = new ImageLoader(null, { preloadPage: true },
      { preloadStudent: shouldPreloadStudent, useQuestionPartNum: true });

    this.setActiveQuestionPartAnswer(this.model, 0);
    this.addRemoteEventListeners();

    this.annotations = options.annotations;
    this.renderAnnotations(this.annotations);
  },

  addRemoteEventListeners: function() {
    // mediator events
    var self = this;
    this.listenTo(Mediator, 'changeQuestionPartAnswer',
      function(questionPartAnswer, pageIndex) {
        pageIndex = pageIndex || 0;
        self.setActiveQuestionPartAnswer(questionPartAnswer, pageIndex);

        this.renderAnnotations(this.annotations);
      });

    // events from other elements
    this.listenToDOM($(window), 'keydown', this.handleShortcuts);
  },

  renderAnnotations: function(annotations) {
    var curPageNum = this.imageLoader.getCurPageNum();
    this.fetchAnnotations(this.model, curPageNum, function(annotations) {
      if (this.annotationView) {
        this.deregisterSubview(this.annotationView);
      }
      this.annotationView = new AnnotationView({
        el: this.$('.exam-canvas'),
        questionPartAnswer: this.model,
        annotations: annotations,
        curPageNumber: curPageNum
      });

      this.registerSubview(this.annotationView);
    });
  },

  fetchAnnotations: function(questionPartAnswer, curPageNum, callback) {
    // TODO: Understand what these parameters are doing.
    var annotations = new AnnotationCollection({
      questionPartAnswer: questionPartAnswer,
      examPageNumber: curPageNum,
    }, {
      questionPartAnswer: questionPartAnswer
      // curPageNum: curPageNum
    });

    var self = this;
    annotations.fetch({
      success: function() {
        _.bind(callback, self)(annotations);
      },

      error: function() {
        // TOOD: handle error
      }
    });
  },

  goToPreviousPage: function(event, skipCurrentPart) {
    // display the previous page in the current part if it exists
    if (this.activePageIndex > 0 && !skipCurrentPart) {
      this.setActiveQuestionPartAnswer(this.model, this.activePageIndex - 1);
      return;
    }

    // otherwise, look for the previous part:
    var curQuestionPart = this.model.get('question_part');
    var previousQuestionPartAnswer;

    if (curQuestionPart.part_number > 1) {
      // find the previous part in the current question
      previousQuestionPartAnswer = this.questionPartAnswers.filter(function(questionPartAnswer) {
        var questionPart = questionPartAnswer.get('question_part');
        return questionPart.question_number === curQuestionPart.question_number &&
          questionPart.part_number === curQuestionPart.part_number - 1;
      });

      previousQuestionPartAnswer = previousQuestionPartAnswer[0];
    } else {
      // if there is no previous part, find the last part in the previous question
      previousQuestionPartAnswer = this.questionPartAnswers.filter(function(questionPartAnswer) {
        var questionPart = questionPartAnswer.get('question_part');
        return questionPart.question_number === curQuestionPart.question_number - 1;
      });

      if (previousQuestionPartAnswer.length > 0) {
        // narrow down to last part
        previousQuestionPartAnswer = _.max(previousQuestionPartAnswer, function(questionPartAnswer) {
          return questionPartAnswer.get('question_part').part_number;
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
    this.renderAnnotations(this.annotations);
  },

  goToNextPage: function(event, skipCurrentPart) {
    // display the next page in the current part if it exists
    if (this.activePageIndex < this.activeQuestionPartAnswerPages.length - 1 &&
        !skipCurrentPart) {
      this.setActiveQuestionPartAnswer(this.model, this.activePageIndex + 1);
      return;
    }

    // otherwise, look for the next part:
    var curQuestionPart = this.model.get('question_part');

    // find the next part in the current question
    var nextQuestionPartAnswer = this.questionPartAnswers.filter(function(questionPartAnswer) {
      var questionPart = questionPartAnswer.get('question_part');
      return questionPart.question_number === curQuestionPart.question_number &&
        questionPart.part_number === curQuestionPart.part_number + 1;
    });

    nextQuestionPartAnswer = nextQuestionPartAnswer[0];

    // if that didn't work, find the next question
    if (!nextQuestionPartAnswer) {
      nextQuestionPartAnswer = this.questionPartAnswers.filter(function(questionPartAnswer) {
        var questionPart = questionPartAnswer.get('question_part');
        return questionPart.question_number === curQuestionPart.question_number + 1 &&
          questionPart.part_number === 1;
      });

      nextQuestionPartAnswer = nextQuestionPartAnswer[0];
    }

    if (nextQuestionPartAnswer) {
      Mediator.trigger('changeQuestionPartAnswer', nextQuestionPartAnswer, 0);
    } else {
      // if that didn't work, there is no next part, so do nothing
    }
  },

  setActiveQuestionPartAnswer: function(questionPartAnswer, pageIndex) {
    var questionPart = questionPartAnswer.get('question_part');

    // set instance variables associated with the active question part
    this.model = questionPartAnswer;

    // TODO: make pages a derived property
    this.activeQuestionPartAnswerPages = questionPartAnswer.get('pages').split(',');
    this.activeQuestionPartAnswerPages = this.activeQuestionPartAnswerPages.map(function(page) {
      return parseInt(page, 10);
    });

    // allow pythonic negative indexes for ease of use
    if (pageIndex < 0) {
      this.activePageIndex = this.activeQuestionPartAnswerPages.length + pageIndex;
    } else {
      this.activePageIndex = pageIndex;
    }

    // update displayed page
    var page = this.activeQuestionPartAnswerPages[this.activePageIndex];
    this.imageLoader.showPage(page, questionPart.question_number,
      questionPart.part_number);
  },

  handleShortcuts: function(event) {
    // ignore keys entered in an input/textarea
    var $target = $(event.target);
    if ($target.is('input') || $target.is('textarea')) {
      return;
    }

    switch (event.keyCode) {
      case this.LEFT_ARROW_KEY_CODE:
        this.goToPreviousPage(null, false);
        break;

      case this.RIGHT_ARROW_KEY_CODE:
        this.goToNextPage(null, false);
        break;

      case this.LEFT_BRACKET_KEY_CODE:
        this.goToPreviousPage(null, true);
        break;

      case this.RIGHT_BRACKET_KEY_CODE:
        this.goToNextPage(null, true);
        break;
    }
  }
});
