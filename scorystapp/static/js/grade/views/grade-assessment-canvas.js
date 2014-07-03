var GradeAssessmentCanvasView = BaseAssessmentCanvasView.extend({
  CIRCLE_RADIUS: 10,  // specified in style.css as radius of annotation
  BLUR_TIME: 100,
  MATHJAX_LATEX_URL: 'https://cdn.mathjax.org/mathjax/latest/MathJax.js?config=TeX-AMS_HTML',

  events: function() {
    // extends the parent view's events
    return _.extend({}, this.constructor.__super__.events, {
      'blur textarea': 'deleteBlankAnnotations',
      'mousedown .annotation': 'sendAnnotationToFront'
    });
  },

  initialize: function(options) {
    this.constructor.__super__.initialize.apply(this, arguments);

    this.mathjaxIsLoaded = false;
    this.$assessmentImage = this.$assessmentCanvas.find('.assessment-image');
    this.$previousPage = this.$('.previous-page');
    this.$nextPage = this.$('.next-page');
    this.$annotationInfoModal = this.$('.annotation-info-modal');
    this.response = options.response;

    // keep track of the last time any textarea (from an annotation) was blurred
    this.lastTextareaBlur = new Date().getTime();
    var self = this;
    // if a blur occurs and it is from a textarea with a comment in it, keep
    // track of the textarea blur time; do this by getting the HTMLElement from
    // the textarea and listening to the blur event
    this.$el.get(0).addEventListener('blur', function(event) {
      var $target = $(event.target);
      if ($target.is('textarea') && $.trim($target.val()).length > 0) {
        self.lastTextareaBlur = new Date().getTime();
      }
    }, true);

    // custom events for going through info about annotations (for instructors)
    if (!Utils.IS_STUDENT_VIEW) {
      this.listenToDOM(this.$annotationInfoModal, 'show.bs.modal', function() {
        var annotationInfo = _.template($('.annotation-info-template').html());
        self.$annotationInfoModal.html(annotationInfo);
        self.$previousAnnotationInfoButton = self.$('button.previous');
        self.$nextAnnotationInfoButton = self.$('button.next');

        var $allAnnotationInfo = self.$('.annotation-info li');
        $allAnnotationInfo.hide();
        self.$currAnnotationInfo = $allAnnotationInfo.eq(0);
        self.$currAnnotationInfo.show();
        self.$nextAnnotationInfoButton.show();
        self.$previousAnnotationInfoButton.hide();

        self.listenToDOM(self.$previousAnnotationInfoButton, 'click', self.goToPreviousAnnotationInfo);
        self.listenToDOM(self.$nextAnnotationInfoButton, 'click', self.goToNextAnnotationInfo);
      });
      this.listenToDOM(this.$assessmentImage, 'click', this.createAnnotation);
    }

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

  // this function is called from the base assessment view
  fetchPagesCallback: function(pages) {
    this.pages = pages;

    var self = this;

    function renderView() {
      self.render();
      self.delegateEvents();
    }

    if (!this.response.get('pages')) {
      // the response hasn't been mapped, so we don't know the first page to
      // display. hence, get the closest page to this response
      this.getClosestPage(this.response, function(page) {
        self.setCurrentPage(page);
        renderView();
      });
    } else {
      this.setPageIndexFromResponse(this.response);
      renderView();
    }
  },

  // this function is called from the base view
  preloadStudentAssessments: function() {
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

  // gets the page that is closest to the given student's response
  getClosestPage: function(response, callback) {
    var questionNumber = response.get('questionPart').questionNumber;
    $.ajax({
      url: 'get-closest-page/' + questionNumber + '/'
    }).done(function(page) {
      callback(parseInt(page, 10));
    });
  },

  setCurrentPage: function(page) {
    var index = this.pages.indexOf(page);
    if (index === -1) {
      // page couldn't be found; default to first page of submission
      index = 0;
    }

    this.pageIndex = index;
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

  getCurPageNum: function() {
    return this.pages[this.pageIndex];
  },

  showPage: function() {
    this.constructor.__super__.showPage.apply(this, arguments);
    this.renderAnnotations();
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
    // if we are not already showing the required page
    if (this.pages[this.pageIndex] !== firstPage) {
      this.setCurrentPage(firstPage);
    }

    return oldPageIndex !== this.pageIndex;
  },

  renderAnnotations: function() {
    // before rendering, remove all the old views.
    var self = this;
    this.annotationViews.forEach(function(annotationView) {
      self.deregisterSubview(annotationView);
    });

    var curPageNum = this.getCurPageNum();
    var shouldLoadMathjax = false;
    this.annotationViews = [];

    this.fetchAnnotations(curPageNum, function(annotations) {
      self.annotations = annotations;
      annotations.forEach(function(annotation) {
        var annotationView = new AnnotationView({
          model: annotation,
          mathjaxIsLoaded: self.mathjaxIsLoaded
        });

        shouldLoadMathjax = shouldLoadMathjax || annotation.get('renderLatex');

        self.$el.children('.assessment-canvas').prepend(annotationView.render().$el);
        self.registerSubview(annotationView);

        self.annotationViews.push(annotationView)
      });

      if (shouldLoadMathjax && Utils.IS_STUDENT_VIEW) {
        self.loadMathjax();
      } else {
        self.annotationViews.forEach(function(annotationView) {
          self.listenTo(annotationView, 'loadMathjax', self.loadMathjax);
        });
      }
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
    // most likely this event was fired because the user likely wanted to blur
    // a different annotation. ignore the event, and don't create a new annotation
    if (new Date().getTime() - this.lastTextareaBlur <= this.BLUR_TIME) {
      return;
    }

    this.deleteBlankAnnotations();

    var annotationModel = new AnnotationModel({
      assessmentPageNumber: this.getCurPageNum(),
      offsetLeft: assessmentPDFX - this.CIRCLE_RADIUS,
      offsetTop: assessmentPDFY - this.CIRCLE_RADIUS
    });

    this.annotations.add(annotationModel);

    var annotationView = new AnnotationView({
      model: annotationModel,
      mathjaxIsLoaded: this.mathjaxIsLoaded
    });

    this.annotationViews.push(annotationView);

    var $annotation = annotationView.render().$el;
    this.$el.children('.assessment-canvas').prepend($annotation);
    $annotation.find('textarea').focus();
    this.registerSubview(annotationView);

    // listen if any of the annotation views loads mathjax (should only be
    // loaded once)
    this.listenTo(annotationView, 'loadMathjax', this.loadMathjax);
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
    // remove annotations that haven't been saved and have nothing in their textarea
    var self = this;
    this.annotationViews.forEach(function(annotationView) {
      // only try to delete if it's a view that has never been saved before;
      // otherwise, let the view handle it
      if (annotationView.model.isNew()) {
        var didDelete = annotationView.deleteIfBlank();
        if (didDelete) {
          self.deregisterSubview(annotationView);
        }
      }
    });
  },

  sendAnnotationToFront: function(event) {
    // first remove the `annotation-front` class to all annotations
    this.annotationViews.forEach(function(annotationView) {
      annotationView.removeAnnotationFrontClass();
    });

    var $annotation = $(event.currentTarget);
    $annotation.addClass('annotation-front');
  },

  // the `annotationView` parameter is not necessary; if it is not passed in,
  // render all of the annotation views
  loadMathjax: function(annotationView) {
    var self = this;

    function renderAnnotations() {
      if (annotationView) {
        annotationView.renderLatex();
      } else {
        self.annotationViews.forEach(function(annotationView) {
          annotationView.renderLatex();
        });
      }
    }

    // load Mathjax once
    if (!this.mathjaxIsLoaded) {
      this.mathjaxIsLoaded = true;
      $.getScript(this.MATHJAX_LATEX_URL, function() {
        MathJax.Hub.Config({ tex2jax: { inlineMath: [['$','$'], ['\\(','\\)']] } });
        renderAnnotations(annotationView);
      });
    } else {
      renderAnnotations(annotationView)
    }
  }
});
