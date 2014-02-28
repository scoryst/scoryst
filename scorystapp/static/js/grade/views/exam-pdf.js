// TODO: browserify
var ExamPDFView = IdempotentView.extend({
  /* Key codes for keyboard shorcuts. */
  LEFT_ARROW_KEY_CODE: 37,
  RIGHT_ARROW_KEY_CODE: 39,
  LEFT_BRACKET_KEY_CODE: 219,
  RIGHT_BRACKET_KEY_CODE: 221,

  CIRCLE_RADIUS: 10,  // Specified in style.css as radius of annotation

  events: {
    'click .previous-page': 'goToPreviousPage',
    'click .next-page': 'goToNextPage',
    'click': 'createAnnotation'
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
  },

  addRemoteEventListeners: function() {
    // mediator events
    var self = this;
    this.listenTo(Mediator, 'changeQuestionPartAnswer',
      function(questionPartAnswer, pageIndex) {
        pageIndex = pageIndex || 0;
        self.setActiveQuestionPartAnswer(questionPartAnswer, pageIndex);
      });

    // events from other elements
    this.listenToDOM($(window), 'keydown', this.handleShortcuts);
  },

  renderAnnotations: function() {
    // Before rendering, remove all the old views.
    this.deregisterSubview();

    var curPageNum = this.curPageNum;  // TODO: Figure out correct page number.
    var self = this;
    this.fetchAnnotations(this.model, curPageNum, function(annotations) {
      this.annotations = annotations;
      annotations.forEach(function(annotation) {
        var annotationView = new AnnotationView({
          // el: self.$('.exam-canvas'),
          questionPartAnswer: self.model,
          model: annotation,
          curPageNumber: curPageNum
        });

        self.$el.append(annotationView.render().$el);
        self.registerSubview(annotationView);
      });
    });
  },

  createAnnotation: function(event) {
    var $target = $(event.target);
    if (!$target.is('.exam-canvas') && !$target.is('img')) {
      return;
    }

    // Getting the X and Y relative to exam PDF
    var parentOffset = this.$el.offset();
    var examPDFX = event.pageX - parentOffset.left;
    var examPDFY = event.pageY - parentOffset.top;

    // Check to ensure that the circle is within the canvas
    var minX = this.CIRCLE_RADIUS * 2 + this.$el.find('.previous-page').width();
    if (examPDFX < minX || examPDFY < this.CIRCLE_RADIUS ||
      examPDFX > this.$el.width() - minX ||
      examPDFY > this.$el.height() - this.CIRCLE_RADIUS) {
      return;
    }

    // Compute the offset to store
    var leftOffset = examPDFX - this.CIRCLE_RADIUS * 2;
    var topOffset = examPDFY - this.CIRCLE_RADIUS;
    var annotation = new AnnotationModel({
      question_part_answer: this.model.id,
      exam_page_number: this.curPageNum,
      left_offset: leftOffset,
      top_offset: topOffset
    });

    this.annotations.add(annotation);

    // Save, and add the annotation to the canvas.
    var self = this;
    annotation.save({}, {
      success: function() {
        var annotationView = new AnnotationView({
          model: annotation,
        });

        var annotationEl = annotationView.render().$el;
        self.$el.append(annotationEl);
        annotationEl.find('textarea').focus();
        self.registerSubview(annotationView);
      }
    });
  },

  fetchAnnotations: function(questionPartAnswer, curPageNum, callback) {
    var annotations = new AnnotationCollection({}, {
      questionPartAnswer: questionPartAnswer,
      examPageNumber: curPageNum
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
    this.curPageNum = page;  // keep track of curPageNum for annotations.
    this.imageLoader.showPage(page, questionPart.question_number,
      questionPart.part_number);

    this.renderAnnotations();
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
