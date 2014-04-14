var ExamCanvasGradeView = ExamCanvasView.extend({
  initialize: function(options) {
    this.constructor.__super__.initialize.apply(this, arguments);

    this.$previousPage = this.$el.find('.previous-page');
    this.$nextPage = this.$el.find('.next-page');
    this.$previousAnnotationInfoButton = this.$el.find('button.previous');
    this.$nextAnnotationInfoButton = this.$el.find('button.next');
    this.questionPartAnswer = options.questionPartAnswer;
    // if there are no pages associated with this question part answer, will be
    // NaN and no image will load
    var firstPageStr = this.questionPartAnswer.get('pages').split(',')[0];
    this.curPageNum = parseInt(firstPageStr, 10);

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
      function(questionPartAnswer) {
        var firstPageStr = questionPartAnswer.get('pages').split(',')[0];
        var firstPage = parseInt(firstPageStr, 10);
        if (this.curPageNum !== firstPage) {
          this.curPageNum = firstPage;
          this.showPage();
          this.trigger('changeExamPage', this.curPageNum);          
          this.updateExamArrows();
        }
      }
    );
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
  },

  // handles preloading images for faster navigation through different jpegs
  preloadImages: function() {
    if (this.preloadCurExam) {
      for (var i = -this.preloadCurExam; i <= this.preloadCurExam; i++) {
        // preload pages before and after, corresponding to the current student
        var pageToPreload = this.curPageNum + i;
        if (pageToPreload >= 1 && pageToPreload <= this.totalNumPages) {
          var image = new Image();
          image.src = 'get-exam-jpeg/' + pageToPreload + '/';
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
  }
});
