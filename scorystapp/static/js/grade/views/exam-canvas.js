var ExamCanvasGradeView = ExamCanvasBaseView.extend({
  LEFT_BRACKET_KEY_CODE: 219,
  RIGHT_BRACKET_KEY_CODE: 221,

  initialize: function(options) {
    this.constructor.__super__.initialize.apply(this, arguments);
    this.questionPartAnswers = options.questionPartAnswers;
    this.setQuestionPartAnswer(options.questionPartAnswer, 0);

    this.render();

    // mediator events
    this.listenTo(Mediator, 'changeQuestionPartAnswer',
      function(questionPartAnswer, pageIndex) {
        pageIndex = pageIndex || 0;
        this.setQuestionPartAnswer(questionPartAnswer, pageIndex);
        this.showPage();
        this.trigger('changeExamPage', this.curPageNum, questionPartAnswer);
      }
    );
  },

  setQuestionPartAnswer: function(questionPartAnswer, pageIndex) {
    this.questionPartAnswer = questionPartAnswer;
    this.pages = this.questionPartAnswer.get('pages').split(',');
    this.pages = this.pages.map(function(page) {
      return parseInt(page, 10);
    });

    // if not set before (when view is being initialized)
    if (!this.curPageNum) {
      this.curPageNum = this.pages[0];
      this.activePageIndex = 0;
      this.$el.find('.previous-page').addClass('disabled');
    }

    // allow pythonic negative indexes, so -1 corresponds to the last element
    if (pageIndex < 0) {
      this.activePageIndex = this.pages.length + pageIndex;
    } else {
      this.activePageIndex = pageIndex;
    }
    this.curPageNum = this.pages[this.activePageIndex];

    // Check to see if either left or right arrows should be disabled
    this.$el.find('.previous-page').removeClass('disabled');
    this.$el.find('.next-page').removeClass('disabled');
    this.checkDisablingPreviousPage();
    this.checkDisablingNextPage();
  },

  handleShortcuts: function(event) {
    this.constructor.__super__.handleShortcuts.apply(this, arguments);

    switch (event.keyCode) {
      case this.LEFT_BRACKET_KEY_CODE:
        this.goToLogicalPreviousPage(true);
        break;

      case this.RIGHT_BRACKET_KEY_CODE:
        this.goToLogicalNextPage(true);
        break;
    }
  },

  goToLogicalPreviousPage: function(skipCurrentPart) {
    // display the previous page in the current part if it exists
    if (this.activePageIndex > 0 && !skipCurrentPart) {
      this.activePageIndex -= 1;
      this.$el.find('.next-page').removeClass('disabled');
      this.checkDisablingPreviousPage();
      this.curPageNum = this.pages[this.activePageIndex];
      this.showPage();
      this.trigger('changeExamPage', this.curPageNum, this.questionPartAnswer);
      return;
    }

    // otherwise, look for the previous part:
    var curQuestionPart = this.questionPartAnswer.get('question_part');
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
  },

  goToLogicalNextPage: function(skipCurrentPart) {
    // display the next page in the current part if it exists
    if (this.activePageIndex < this.pages.length - 1 && !skipCurrentPart) {
      this.activePageIndex += 1;
      this.$el.find('.previous-page').removeClass('disabled');
      this.checkDisablingNextPage();
      this.curPageNum = this.pages[this.activePageIndex];
      this.showPage();
      this.trigger('changeExamPage', this.curPageNum, this.questionPartAnswer);
      return;
    }

    // otherwise, look for the next part:
    var nextQuestionPartAnswer = this.getNextQuestionPartAnswer();

    if (nextQuestionPartAnswer) {
      Mediator.trigger('changeQuestionPartAnswer', nextQuestionPartAnswer, 0);
    } else {
      // if that didn't work, there is no next part, so do nothing
    }
  },

  getNextQuestionPartAnswer: function() {
    var curQuestionPart = this.questionPartAnswer.get('question_part');

    // find the next part in the current question
    var nextQuestionPartAnswer = this.questionPartAnswers.filter(function(questionPartAnswer) {
      var questionPart = questionPartAnswer.get('question_part');
      return questionPart.question_number === curQuestionPart.question_number &&
        questionPart.part_number === curQuestionPart.part_number + 1;
    });

    var nextQuestionPartAnswer = nextQuestionPartAnswer[0];

    // if that didn't work, find the next question
    if (!nextQuestionPartAnswer) {
      nextQuestionPartAnswer = this.questionPartAnswers.filter(function(questionPartAnswer) {
        var questionPart = questionPartAnswer.get('question_part');
        return questionPart.question_number === curQuestionPart.question_number + 1 &&
          questionPart.part_number === 1;
      });

      return nextQuestionPartAnswer[0];
    }

    return nextQuestionPartAnswer;
  },

  checkDisablingPreviousPage: function() {
    var questionPart = this.questionPartAnswer.get('question_part');
    if (this.activePageIndex === 0 && questionPart.question_number === 1 &&
        questionPart.part_number === 1) {
      this.$el.find('.previous-page').addClass('disabled');
    }
  },

  checkDisablingNextPage: function() {
    var nextQuestionPartAnswer = this.getNextQuestionPartAnswer();
    if (!nextQuestionPartAnswer && this.activePageIndex === this.pages.length - 1) {
      this.$el.find('.next-page').addClass('disabled');
    }
  },

  preloadImages: function() {
    if (this.preloadCurExam) {
      for (var i = -this.preloadCurExam; i <= this.preloadCurExam; i++) {
        // preload pages before and after, corresponding to the current student
        var pageIndexToPreload = this.activePageIndex + i;
        // the page index must be a correct array index
        if (pageIndexToPreload >= 0 && pageIndexToPreload < this.pages.length) {
          var image = new Image();
          image.src = 'get-exam-jpeg/' + this.pages[pageIndexToPreload];
        }
      }
    }

    if (this.preloadOtherStudentExams) {
      for (var i = -this.preloadOtherStudentExams; i <= this.preloadOtherStudentExams; i++) {
        // preload page of previous and next students
        var image = new Image();
        var questionPart = this.questionPartAnswer.get('question_part');
        image.src = 'get-student-jpeg/' + i + '/' + questionPart.question_number +
          '/' + questionPart.part_number + '/';
      }
    }
  }
});
