var ExamCanvasGradeView = ExamCanvasView.extend({
  CIRCLE_RADIUS: 10,  // specified in style.css as radius of annotation

  initialize: function(options) {
    this.constructor.__super__.initialize.apply(this, arguments);

    this.$examImage = this.$examCanvas.find('.exam-image');
    this.$previousPage = this.$el.find('.previous-page');
    this.$nextPage = this.$el.find('.next-page');
    this.$previousAnnotationInfoButton = this.$el.find('button.previous');
    this.$nextAnnotationInfoButton = this.$el.find('button.next');
    this.questionPartAnswer = options.questionPartAnswer;

    var self = this;
    this.fetchPages(function(pages) {
      self.pages = pages;
      self.setPageIndexFromQuestionPartAnswer(self.questionPartAnswer);
      self.render();
      self.delegateEvents();
    });

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
    this.listenToDOM(this.$examImage, 'click', this.createAnnotation);

    // keep track of annotations on the page
    this.annotationViews = [];

    // mediator events
    this.listenTo(Mediator, 'changeQuestionPartAnswer',
      function(questionPartAnswer) {
        this.setPageIndexFromQuestionPartAnswer(questionPartAnswer);
        this.showPage();
        this.trigger('changeExamPage', this.pages[this.pageIndex]);
        this.updateExamArrows();
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
        if (this.pageIndex + i < this.pages.length - 1 && this.pageIndex + i > 0) {
          var pageToPreload = this.pages[this.pageIndex + i];
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
  },

  // handles the user clicking on the left arrow or using the keyboard
  // shortcut to navigate to the previous page
  goToPreviousPage: function() {
    if (this.pageIndex > 0) {
      this.pageIndex -= 1;
      this.trigger('changeExamPage', this.pages[this.pageIndex]);
      this.updateExamArrows();
      this.showPage();
    }
  },

  // handles the user clicking on the right arrow or using the keyboard
  // shortcut to navigate to the next page
  goToNextPage: function() {
    if (this.pageIndex < this.pages.length - 1) {
      this.pageIndex += 1;
      this.trigger('changeExamPage', this.pages[this.pageIndex]);
      this.updateExamArrows();
      this.showPage();
    }
  },

  fetchPages: function(callback) {
    $.ajax({
      url: 'get-non-blank-pages/'
    }).done(function(pages) {
      callback(pages);
    });
  },

  getCurPageNum: function() {
    return this.pages[this.pageIndex];
  },

  showPage: function() {
    // updates the exam canvas to show the image corresponding to the current
    // page number
    this.$examImage.attr('src', 'get-exam-jpeg/' + this.pages[this.pageIndex] + '/');
    this.renderAnnotations();
    this.preloadImages();
  },

  setPageIndexFromQuestionPartAnswer: function(questionPartAnswer) {
    var firstPageStr = questionPartAnswer.get('pages').split(',')[0];
    var firstPage = parseInt(firstPageStr, 10);
    // If we are not already showing the required page
    if (this.pages[this.pageIndex] !== firstPage) {
      // get the index in pages of the page to be shown
      this.pageIndex = this.pages.indexOf(firstPage);
      if (this.pageIndex === -1) {
        // If the page isn't in `this.pages`, set it to 0
        // TODO: Think about this more carefully
        this.pageIndex = 0;
      }
    }
  },

  updateExamArrows: function() {
    this.$nextPage.removeClass('disabled');
    this.$previousPage.removeClass('disabled');

    if (this.pageIndex === 0) {
      this.$previousPage.addClass('disabled');
    } else if (this.pageIndex === this.pages.length - 1) {
      this.$nextPage.addClass('disabled');
    }
  },

  renderAnnotations: function() {
    // before rendering, remove all the old views.
    var self = this;
    this.annotationViews.forEach(function(annotationView) {
      self.deregisterSubview(annotationView);
    });

    var curPageNum = this.getCurPageNum();
    this.annotationViews = [];
    this.fetchAnnotations(curPageNum, function(annotations) {
      self.annotations = annotations;
      annotations.forEach(function(annotation) {
        var annotationView = new AnnotationView({ model: annotation });

        self.$el.children('.exam-canvas').prepend(annotationView.render().$el);
        self.registerSubview(annotationView);

        self.annotationViews.push(annotationView)
      });
    });
  },

  createAnnotation: function(event) {
    if (Utils.IS_STUDENT_VIEW) {
      return;
    }
    var $target = $(event.target);

    // getting the X and Y relative to exam PDF
    var examPDFX = event.offsetX;
    var examPDFY = event.offsetY;

    // check to ensure that the circle is within the canvas
    var minX = this.CIRCLE_RADIUS;
    if (examPDFX < minX || examPDFY < this.CIRCLE_RADIUS ||
        examPDFX > this.$el.width() - minX ||
        examPDFY > this.$el.height() - this.CIRCLE_RADIUS) {
      return;
    }

    // go through all annotations, and if any have never been saved,
    // remove them from the canvas
    var comment;
    for (var i = 0; i < this.annotationViews.length; i++) {
      var annotationView = this.annotationViews[i];
      // returns the comment in the unsaved comment; if the comment is unsaved,
      // or if the view has been previously saved, return undefined
      var commentIfUnsaved = annotationView.deleteIfUnsaved();
      if (commentIfUnsaved) {
        comment = commentIfUnsaved;
      }
    }

    var annotationModal = new AnnotationModel({
      examPageNumber: this.getCurPageNum(),
      offsetLeft: examPDFX - this.CIRCLE_RADIUS,
      offsetTop: examPDFY - this.CIRCLE_RADIUS
    });

    this.annotations.add(annotationModal);

    var annotationView = new AnnotationView({
      model: annotationModal,
      unsavedComment: commentIfUnsaved
    });

    this.annotationViews.push(annotationView);

    var $annotation = annotationView.render().$el;
    this.$el.children('.exam-canvas').prepend($annotation);
    $annotation.find('textarea').focus();
    this.registerSubview(annotationView);
  },

  fetchAnnotations: function(curPageNum, callback) {
    var annotations = new AnnotationCollection({}, {
      examPageNumber: curPageNum
    });

    annotations.fetch({
      success: function() {
        callback(annotations);
      }
    });
  }
});
