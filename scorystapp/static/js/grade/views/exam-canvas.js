var ExamCanvasView = ExamCanvasBaseView.extend({
  PREFETCH_NUMBER: 1,  // number of pages ahead to prefetch

  initialize: function(options) {
    this.constructor.__super__.initialize.apply(this, arguments);
    this.questionPartAnswers = options.questionPartAnswers;
    this.setQuestionPartAnswer(options.questionPartAnswer, 0);

    this.render();

    // mediator events
    var self = this;
    this.listenTo(Mediator, 'changeQuestionPartAnswer',
      function(questionPartAnswer, pageIndex) {
        self.setQuestionPartAnswer(questionPartAnswer, pageIndex);
        this.showPage();
        this.trigger('changeExamPage', this.curPageNum, questionPartAnswer);
        this.preloadImages();
      }
    );

    this.listenTo(this, 'changeExamPage', function() { this.preloadImages(); });
  },

  setQuestionPartAnswer: function(questionPartAnswer, pageIndex) {
    this.questionPartAnswer = questionPartAnswer;
    this.pages = this.questionPartAnswer.get('pages').split(',');
    this.pages = this.pages.map(function(page) {
      return parseInt(page, 10);
    });

    // if not set before (when view is being initialized)
    if (this.curPageNum === undefined) {
      this.curPageNum = this.pages[0];
      this.activePageIndex = 0;
    }

    // allow pythonic negative indexes for ease of use
    if (pageIndex < 0) {
      this.activePageIndex = this.pages.length + pageIndex;
    } else {
      this.activePageIndex = 0;
    }
    this.curPageNum = this.pages[this.activePageIndex];

    if (this.activePageIndex < 0) {
      this.activePageIndex = 0;
    } else if (this.activePageIndex >= this.pages.length) {
      this.activePageIndex = this.pages.length - 1;
    }
  },

  goToPreviousPage: function(skipCurrentPart) {
    this.constructor.__super__.goToPreviousPage.apply(this, arguments);
    // display the previous page in the current part if it exists
    if (this.activePageIndex > 0 && !skipCurrentPart) {
      this.activePageIndex -= 1;
      this.curPageNum = this.pages[this.activePageIndex];
      this.showPage();
      this.trigger('changeExamPage', this.curPageNum, this.questionPartAnswer);  // TODO: Move to image handler base
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

  goToNextPage: function(event, skipCurrentPart) {
    this.constructor.__super__.goToNextPage.apply(this, arguments);
    // display the next page in the current part if it exists
    if (this.activePageIndex < this.pages.length - 1 && !skipCurrentPart) {
      this.activePageIndex += 1;
      this.curPageNum = this.pages[this.activePageIndex];
      this.showPage();
      this.trigger('changeExamPage', this.curPageNum, this.questionPartAnswer);  // TODO: Move to image handler base
      return;
    }

    // otherwise, look for the next part:
    var curQuestionPart = this.questionPartAnswer.get('question_part');

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

  preloadImages: function() {
    for (var i = -this.PREFETCH_NUMBER; i <= this.PREFETCH_NUMBER; i++) {
      // preload pages before and after, corresponding to the current student
      var pageIndexToPreload = this.activePageIndex + i;
      if (pageIndexToPreload >= 0 && pageIndexToPreload < this.pages.length) {
        var image = new Image();
        image.src = 'get-exam-jpeg/' + this.pages[pageIndexToPreload];
      }

      // preload page of previous and next students
      var image = new Image();
      var questionPart = this.questionPartAnswer.get('question_part');
      image.src = 'get-student-jpeg/' + i + '/' + questionPart.question_number +
        '/' + questionPart.part_number + '/';
    }
  }

});
