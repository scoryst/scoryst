var AssessmentCanvasGradeView = AssessmentCanvasView.extend({
  CIRCLE_RADIUS: 10,  // specified in style.css as radius of annotation

  initialize: function(options) {
    this.constructor.__super__.initialize.apply(this, arguments);

    this.$assessmentImage = this.$assessmentCanvas.find('.assessment-image');
    this.$previousPage = this.$el.find('.previous-page');
    this.$nextPage = this.$el.find('.next-page');
    this.$previousAnnotationInfoButton = this.$el.find('button.previous');
    this.$nextAnnotationInfoButton = this.$el.find('button.next');
    this.response = options.response;

    var self = this;
    this.fetchPages(function(pages) {
      self.pages = pages;

      function renderView() {
        self.render();
        self.delegateEvents();
      }

      if (!self.response.pages) {
        // the response hasn't been mapped, so we don't know the first page to
        // display. hence, get the effective first page
        self.getEffectivePage(self.response, function(page) {
          self.setCurrentPage(page);
          renderView();
        });
      } else {
        self.setPageIndexFromResponse(self.response);
        renderView();
      }
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
    this.listenToDOM(this.$assessmentImage, 'click', this.createAnnotation);

    // keep track of annotations on the page
    this.annotationViews = [];

    // mediator events
    this.listenTo(Mediator, 'changeResponse',
      function(response) {
        var pageIndexChanged = this.setPageIndexFromResponse(response);
        if (!pageIndexChanged) {
          return;
        }
        this.showPage();
        this.trigger('changeAssessmentPage', this.pages[this.pageIndex]);
        this.updateAssessmentArrows();
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
    if (this.preloadCurAssessment) {
      for (var i = -this.preloadCurAssessment; i <= this.preloadCurAssessment; i++) {
        // preload pages before and after, corresponding to the current student
        if (this.pageIndex + i < this.pages.length - 1 && this.pageIndex + i > 0) {
          var pageToPreload = this.pages[this.pageIndex + i];
          var image = new Image();
          image.src = 'get-assessment-jpeg/' + pageToPreload + '/';
        }
      }
    }

    if (this.preloadOtherStudentAssessments) {
      for (var i = -this.preloadOtherStudentAssessments; i <= this.preloadOtherStudentAssessments; i++) {
        // preload page of previous and next students
        var image = new Image();
        var questionPart = this.response.get('questionPart');
        image.src = 'get-student-jpeg/' + i + '/' +
          questionPart.questionNumber + '/';
      }
    }
  },

  // handles the user clicking on the left arrow or using the keyboard
  // shortcut to navigate to the previous page
  goToPreviousPage: function() {
    if (this.pageIndex > 0) {
      this.pageIndex -= 1;
      this.trigger('changeAssessmentPage', this.pages[this.pageIndex]);
      this.updateAssessmentArrows();
      this.showPage();
    }
  },

  // handles the user clicking on the right arrow or using the keyboard
  // shortcut to navigate to the next page
  goToNextPage: function() {
    if (this.pageIndex < this.pages.length - 1) {
      this.pageIndex += 1;
      this.trigger('changeAssessmentPage', this.pages[this.pageIndex]);
      this.updateAssessmentArrows();
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
    // updates the assessment canvas to show the image corresponding to the current
    // page number
    this.$assessmentImage.attr('src', 'get-assessment-jpeg/' + this.pages[this.pageIndex] + '/');
    this.renderAnnotations();
    this.preloadImages();
  },

  /* Gets the effective first page to display for the given response.
   * 'Effective' here is defined by the server. */
  getEffectivePage: function(response, callback) {
    var questionNumber = response.get('questionPart').questionNumber;
    $.ajax({
      url: 'get-effective-page/' + questionNumber + '/'
    }).done(function(page) {
      callback(parseInt(page, 10));
    });
  },

  setPageIndexFromResponse: function(response) {
    var oldPageIndex = this.pageIndex;
    var responsePages = response.get('pages');

    if (!responsePages) {
      // either student didn't map assessment or had no answer;
      // if no page is set, default to 0. else, stay with the old page
      if (!this.pageIndex) {
        this.pageIndex = 0;
      }
      return false;
    }

    var firstPageStr = responsePages.split(',')[0];
    var firstPage = parseInt(firstPageStr, 10);
    // If we are not already showing the required page
    if (this.pages[this.pageIndex] !== firstPage) {
      this.setCurrentPage(firstPage);
    }

    return oldPageIndex !== this.pageIndex;
  },

  setCurrentPage: function(page) {
    var index = this.pages.indexOf(page);
    if (index === -1) {
      // page couldn't be found; default to first page of submission
      index = 0;
    }

    this.pageIndex = index;
  },

  updateAssessmentArrows: function() {
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

        self.$el.children('.assessment-canvas').prepend(annotationView.render().$el);
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

    // getting the X and Y relative to assessment PDF
    var assessmentPDFX = event.offsetX;
    var assessmentPDFY = event.offsetY;

    // check to ensure that the circle is within the canvas
    var minX = this.CIRCLE_RADIUS;
    if (assessmentPDFX < minX || assessmentPDFY < this.CIRCLE_RADIUS ||
        assessmentPDFX > this.$el.width() - minX ||
        assessmentPDFY > this.$el.height() - this.CIRCLE_RADIUS) {
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
      assessmentPageNumber: this.getCurPageNum(),
      offsetLeft: assessmentPDFX - this.CIRCLE_RADIUS,
      offsetTop: assessmentPDFY - this.CIRCLE_RADIUS
    });

    this.annotations.add(annotationModal);

    var annotationView = new AnnotationView({
      model: annotationModal,
      unsavedComment: commentIfUnsaved
    });

    this.annotationViews.push(annotationView);

    var $annotation = annotationView.render().$el;
    this.$el.children('.assessment-canvas').prepend($annotation);
    $annotation.find('textarea').focus();
    this.registerSubview(annotationView);
  },

  fetchAnnotations: function(curPageNum, callback) {
    var annotations = new AnnotationCollection({}, {
      assessmentPageNumber: curPageNum
    });

    annotations.fetch({
      success: function() {
        callback(annotations);
      }
    });
  }
});
