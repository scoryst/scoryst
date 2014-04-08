var ExamCanvasGradeView = ExamCanvasBaseView.extend({
  LEFT_BRACKET_KEY_CODE: 219,
  RIGHT_BRACKET_KEY_CODE: 221,

  initialize: function(options) {
    this.constructor.__super__.initialize.apply(this, arguments);

    this.$previousPage = this.$el.find('.previous-page');
    this.$nextPage = this.$el.find('.next-page');
    this.$previousAnnotationInfoButton = this.$el.find('button.previous');
    this.$nextAnnotationInfoButton = this.$el.find('button.next');
    this.questionPartAnswers = options.questionPartAnswers;
    this.setQuestionPartAnswer(options.questionPartAnswer, 0);

    this.render();

    // custom events for going through info about annotations
    var self = this;
    this.listenToDOM(this.$el.find('.annotation-info-modal'), 'show.bs.modal', function() {
      var $allAnnotationInfo = self.$el.find('.annotation-info li');
      $allAnnotationInfo.hide();
      self.$currAnnotationInfo = $allAnnotationInfo.eq(0);
      self.$currAnnotationInfo.show();
      self.$nextAnnotationInfoButton.show();
      self.$previousAnnotationInfoButton.hide();
    });
    this.listenToDOM(this.$previousAnnotationInfoButton, 'click', this.goToPreviousAnnotationInfo);
    this.listenToDOM(this.$nextAnnotationInfoButton, 'click', this.goToNextAnnotationInfo);

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
      this.$previousPage.addClass('disabled');
    }

    // allow pythonic negative indexes, so -1 corresponds to the last element
    if (pageIndex < 0) {
      this.activePageIndex = this.pages.length + pageIndex;
    } else {
      this.activePageIndex = pageIndex;
    }
    this.curPageNum = this.pages[this.activePageIndex];

    // Check to see if either left or right arrows should be disabled
    this.$previousPage.removeClass('disabled');
    this.$nextPage.removeClass('disabled');
    this.disablePreviousPageIfNecessary();
    this.disableNextPageIfNecessary();
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
      this.$nextPage.removeClass('disabled');
      this.disablePreviousPageIfNecessary();
      this.curPageNum = this.pages[this.activePageIndex];
      this.showPage();
      this.trigger('changeExamPage', this.curPageNum, this.questionPartAnswer);
      return;
    }

    // otherwise, look for the previous part:
    var curQuestionPart = this.questionPartAnswer.get('questionPart');
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

  goToLogicalNextPage: function(skipCurrentPart) {
    // display the next page in the current part if it exists
    if (this.activePageIndex < this.pages.length - 1 && !skipCurrentPart) {
      this.activePageIndex += 1;
      this.$previousPage.removeClass('disabled');
      this.disableNextPageIfNecessary();
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
    var curQuestionPart = this.questionPartAnswer.get('questionPart');

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

    return nextQuestionPartAnswer;
  },

  disablePreviousPageIfNecessary: function() {
    var questionPart = this.questionPartAnswer.get('questionPart');
    if (this.activePageIndex === 0 && questionPart.questionNumber === 1 &&
        questionPart.partNumber === 1) {
      this.$previousPage.addClass('disabled');
    }
  },

  disableNextPageIfNecessary: function() {
    var nextQuestionPartAnswer = this.getNextQuestionPartAnswer();
    if (!nextQuestionPartAnswer && this.activePageIndex === this.pages.length - 1) {
      this.$nextPage.addClass('disabled');
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
        var questionPart = this.questionPartAnswer.get('questionPart');
        image.src = 'get-student-jpeg/' + i + '/' + questionPart.questionNumber +
          '/' + questionPart.partNumber + '/';
      }
    }
  },

  goToNextAnnotationInfo: function() {
    this.$currAnnotationInfo.hide();
    this.$currAnnotationInfo = this.$currAnnotationInfo.next();
    this.$currAnnotationInfo.show();
    if (this.$currAnnotationInfo.next().length === 0) {
      this.$nextAnnotationInfoButton.hide();
    }
    this.$previousAnnotationInfoButton.show();
  },

  goToPreviousAnnotationInfo: function() {
    this.$currAnnotationInfo.hide();
    this.$currAnnotationInfo = this.$currAnnotationInfo.prev();
    this.$currAnnotationInfo.show();
    if (this.$currAnnotationInfo.prev().length === 0) {
      this.$previousAnnotationInfoButton.hide();
    }
    this.$nextAnnotationInfoButton.show();
  }
});
