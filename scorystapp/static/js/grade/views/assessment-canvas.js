var AssessmentCanvasGradeView = AssessmentCanvasView.extend({
  CIRCLE_RADIUS: 10,  // specified in style.css as radius of annotation
  BLUR_TIME: 100,

  template: _.template($('.annotation-info-template').html()),

  events: {
    'blur textarea': 'deleteBlankAnnotations'
  },

  initialize: function(options) {
    this.constructor.__super__.initialize.apply(this, arguments);

    this.$assessmentImage = this.$assessmentCanvas.find('.assessment-image');
    this.$previousPage = this.$el.find('.previous-page');
    this.$nextPage = this.$el.find('.next-page');
    this.$annotationInfoModal = this.$el.find('.annotation-info-modal');
    this.response = options.response;

    // keep track of the last time any textarea (from an annotation) was blurred
    this.blurTimestamp = (new Date).getTime();
    var self = this;
    // if a blur occurs and it is from a textarea with a comment in it, keep
    // track of the new blur timestamp
    this.$el.get(0).addEventListener('blur', function(event) {
      var $target = $(event.target);
      if ($target.is('textarea') && $.trim($target.val()).length > 0) {
        self.blurTimestamp = (new Date).getTime();
      }
    }, true);

    var self = this;
    this.fetchPages(function(pages) {
      self.pages = pages;
      self.setPageIndexFromResponse(self.response);
      self.render();
      self.delegateEvents();
    });

    // custom events for going through info about annotations
    var self = this;
    this.listenToDOM(this.$annotationInfoModal, 'show.bs.modal', function() {
      self.$annotationInfoModal.html(self.template());
      self.$previousAnnotationInfoButton = self.$el.find('button.previous');
      self.$nextAnnotationInfoButton = self.$el.find('button.next');


      var $allAnnotationInfo = self.$el.find('.annotation-info li');
      $allAnnotationInfo.hide();
      self.$currAnnotationInfo = $allAnnotationInfo.eq(0);
      self.$currAnnotationInfo.show();
      self.$nextAnnotationInfoButton.show();
      self.$previousAnnotationInfoButton.hide();

      self.listenToDOM(self.$previousAnnotationInfoButton, 'click', self.goToPreviousAnnotationInfo);
      self.listenToDOM(self.$nextAnnotationInfoButton, 'click', self.goToNextAnnotationInfo);
    });
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

  setPageIndexFromResponse: function(response) {
    var oldPageIndex = this.pageIndex;
    var firstPageStr = response.get('pages').split(',')[0];
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

    return oldPageIndex !== this.pageIndex;
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
    this.deregisterSubview();

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

    // if a textarea (i.e. annotation) was blurred sometime very recently, then
    // most likely this event was fired because the user was blurring the other
    // annotation; therefore, ignore
    if ((new Date()).getTime() - this.blurTimestamp <= this.BLUR_TIME) {
      return;
    }

    this.deleteBlankAnnotations();

    var annotationModal = new AnnotationModel({
      assessmentPageNumber: this.getCurPageNum(),
      offsetLeft: assessmentPDFX - this.CIRCLE_RADIUS,
      offsetTop: assessmentPDFY - this.CIRCLE_RADIUS
    });

    this.annotations.add(annotationModal);

    var annotationView = new AnnotationView({
      model: annotationModal
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
  },

  deleteBlankAnnotations: function() {
    // go through all annotations, and if any have never been saved & there is
    // nothing written in the textarea, remove them from the canvas.
    var self = this;
    this.annotationViews.forEach(function(annotationView) {
      // only try to delete if its a view that has never been saved before;
      // otherwise, let the view handle it
      if (annotationView.model.isNew()) {
        // returns the comment in the unsaved comment; if the comment is unsaved,
        // or if the view has been previously saved, return undefined
        var didDelete = annotationView.deleteIfBlank();
        if (didDelete) {
          self.deregisterSubview(annotationView);
        }
      }
    });
  }
});
