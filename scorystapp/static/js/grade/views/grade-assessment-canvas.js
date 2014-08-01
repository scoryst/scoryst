var GradeAssessmentCanvasView = BaseAssessmentCanvasView.extend({
  CIRCLE_RADIUS: 10,  // specified in style.css as radius of annotation
  BLUR_TIME: 100,
  MATHJAX_LATEX_URL: 'https://cdn.mathjax.org/mathjax/latest/MathJax.js?config=TeX-AMS_HTML',
  // the following constants are used for `localStorage.lastChosenToolbarOption`
  FREEFORM_ANNOTATION_SET: 'freeform-annotation-set',
  ERASE_SET: 'erase-set',
  TEXT_ANNOTATION_SET: 'text-annotations-set',
  NONE_SET: 'none-set',

  events: function() {
    // extends the parent view's events
    return _.extend({}, this.constructor.__super__.events, {
      'blur textarea': 'deleteBlankAnnotations',
      'mousedown .annotation': 'handleSendAnnotationToFrontEvent',
      'click .enable-zoom': 'handleToolbarClick',
      'click .set-freeform-annotations': 'handleToolbarClick',
      'click .set-erase': 'handleToolbarClick',
      'click .set-text-annotations': 'handleToolbarClick',
    });
  },

  initialize: function(options) {
    this.constructor.__super__.initialize.apply(this, arguments);

    this.mathjaxIsLoaded = false;
    this.$assessmentImage = this.$assessmentCanvas.find('.assessment-image');
    this.$previousPage = this.$('.previous-page');
    this.$nextPage = this.$('.next-page');
    this.$annotationInfoModal = this.$('.annotation-info-modal');

    this.$enableZoom = this.$('.enable-zoom');
    this.$setFreeformAnnotations = this.$('.set-freeform-annotations');
    this.$setTextAnnotations = this.$('.set-text-annotations');
    this.$setErase = this.$('.set-erase');
    this.$freeformAnnotationsCanvas = this.$('.freeform-annotations-canvas');
    this.$toolbarButtons = this.$('.toolbar button');

    this.textAnnotationsMode = false;

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
        self.$curAnnotationInfo = $allAnnotationInfo.eq(0);
        self.$curAnnotationInfo.show();
        self.$nextAnnotationInfoButton.show();
        self.$previousAnnotationInfoButton.hide();

        self.listenToDOM(self.$previousAnnotationInfoButton, 'click', self.goToPreviousAnnotationInfo);
        self.listenToDOM(self.$nextAnnotationInfoButton, 'click', self.goToNextAnnotationInfo);
      });
      this.listenToDOM(this.$freeformAnnotationsCanvas, 'click', this.createAnnotation);
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

    this.$setFreeformAnnotations.tooltip();
    this.$setErase.tooltip();
    this.$setTextAnnotations.tooltip();
    this.$('.view-help').tooltip();
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

  render: function() {
    this.constructor.__super__.render.apply(this, arguments);

    // set the toolbar with `localStorage` settings
    if (localStorage && localStorage.lastChosenToolbarOption) {
      switch (localStorage.lastChosenToolbarOption) {
        case this.FREEFORM_ANNOTATION_SET:
          this.$setFreeformAnnotations.addClass('active');
          this.freeformCanvasView.enableDraw();
          break;
        case this.ERASE_SET:
          this.$setErase.addClass('active');
          this.freeformCanvasView.enableErase();
          break;
        case this.TEXT_ANNOTATION_SET:
          this.$setTextAnnotations.addClass('active');
          this.textAnnotationsMode = true;
          break;
      }
    }

    // by default the text annotation option is set; check if that's the case
    if (!this.$toolbarButtons.hasClass('active')) {
      this.$setTextAnnotations.addClass('active');
      this.textAnnotationsMode = true;
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
    this.$curAnnotationInfo.hide();
    this.$curAnnotationInfo = this.$curAnnotationInfo.next();
    this.$curAnnotationInfo.show();
    if (this.$curAnnotationInfo.next().length === 0) {
      this.$nextAnnotationInfoButton.hide();
    }
    this.$previousAnnotationInfoButton.show();
  },

  goToPreviousAnnotationInfo: function() {
    this.$curAnnotationInfo.hide();
    this.$curAnnotationInfo = this.$curAnnotationInfo.prev();
    this.$curAnnotationInfo.show();
    if (this.$curAnnotationInfo.prev().length === 0) {
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

    if (!this.freeformCanvasView) {
      this.freeformCanvasView = new FreeformCanvasView({
        el: '.freeform-annotations-canvas',
        assessmentPageNumber: this.getCurPageNum()
      });
      this.registerSubview(this.freeformCanvasView);
      this.freeformCanvasView.listenTo(this, 'changeAssessmentPage', this.freeformCanvasView.render)
    }

    if (this.getCurPageNum()) {
      this.freeformCanvasView.render(this.getCurPageNum());
    }
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
        // it's possible that the `fetchAnnotations` callback is called after
        // the view is deregistered. in that case, do not render annotations.
        // this case would happen when the user is navigating very quickly.
        // note that this variable is created and set in `IdempotentView`.
        if (self.sideEffectsRemoved) {
          return;
        }

        var annotationView = new AnnotationView({
          model: annotation,
          mathjaxIsLoaded: self.mathjaxIsLoaded
        });

        shouldLoadMathjax = shouldLoadMathjax || annotation.get('renderLatex');

        self.$el.children('.assessment-canvas').prepend(annotationView.render().$el);
        self.registerSubview(annotationView);

        self.annotationViews.push(annotationView);
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
    if (Utils.IS_STUDENT_VIEW || !this.textAnnotationsMode) {
      return;
    }
    var $target = $(event.target);
    event.preventDefault();

    // getting the X and Y relative to assessment PDF
    var offset = this.$freeformAnnotationsCanvas.offset();
    // Firefox does not have `offsetX` or `offsetY` defined for the event object,
    // hence why we use `pageX`, `pageY`, and offset if they fail
    var assessmentPDFX = (event.offsetX === undefined ? event.pageX - offset.left : event.offsetX);
    var assessmentPDFY = (event.offsetY === undefined ? event.pageY - offset.top : event.offsetY);

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
    this.sendAnnotationToFront($annotation);

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

  sendAnnotationToFront: function($annotation) {
    // first remove the `annotation-front` class from all annotations
    this.annotationViews.forEach(function(annotationView) {
      annotationView.removeAnnotationFrontClass();
    });

    $annotation.addClass('annotation-front');
  },

  handleSendAnnotationToFrontEvent: function(event) {
    var $annotation = $(event.currentTarget);
    this.sendAnnotationToFront($annotation);
  },

  // the `annotationView` parameter is not necessary; if it is not passed in,
  // render all of the annotation views
  loadMathjax: function(annotationView) {
    // load Mathjax once
    if (!this.mathjaxIsLoaded) {
      this.mathjaxIsLoaded = true;
      var self = this;
      $.getScript(this.MATHJAX_LATEX_URL, function() {
        MathJax.Hub.Config({ tex2jax: { inlineMath: [['$','$'], ['\\(','\\)']] } });
        self.renderLatexForAnnotations(annotationView);
      });
    } else {
      this.renderLatexForAnnotations(annotationView);
    }
  },

  renderLatexForAnnotations: function(annotationView) {
    if (annotationView && annotationView.shouldRenderLatex()) {
      annotationView.renderLatex();
    } else {
      this.annotationViews.forEach(function(annotationView) {
        if (annotationView.shouldRenderLatex()) {
          annotationView.renderLatex();
        }
      });
    }
  },

  // updates the toolbar UI and actions that the user can do (e.g. text annotations),
  // and if `localStorage` exists, sets `localStorage.lastChosenToolbarOption`
  handleToolbarClick: function(event) {
    var $toolbarOption = $(event.currentTarget);
    var lastChosenToolbarOption = this.NONE_SET;

    // update the toolbar active class: if the toolbar option clicked is not
    // active, set as active and remove active class from other options; if it
    // is active, set as inactive
    if ($toolbarOption.hasClass('active')) {
      this.$toolbarButtons.removeClass('active');
    } else {
      this.$toolbarButtons.removeClass('active');
      $toolbarOption.addClass('active');
    }

    // change the functionality to match the toolbar option selection
    var zoomLensIsEnabled = this.$enableZoom.hasClass('active');
    if (zoomLensIsEnabled) {
      this.zoomLensView.enableZoom();
    } else {
      this.zoomLensView.disableZoom();
    }

    var eraseIsEnabled = this.$setErase.hasClass('active');
    if (eraseIsEnabled) {
      this.freeformCanvasView.enableErase();
      lastChosenToolbarOption = this.ERASE_SET;
    } else {
      this.freeformCanvasView.disableErase();
    }

    var textAnnotationsIsEnabled = this.$setTextAnnotations.hasClass('active');
    this.textAnnotationsMode = textAnnotationsIsEnabled;
    if (textAnnotationsIsEnabled) {
      lastChosenToolbarOption = this.TEXT_ANNOTATION_SET;
    }

    var freeformAnnotationsIsEnabled = this.$setFreeformAnnotations.hasClass('active');
    if (freeformAnnotationsIsEnabled) {
      this.freeformCanvasView.enableDraw();
      lastChosenToolbarOption = this.FREEFORM_ANNOTATION_SET;
    } else {
      this.freeformCanvasView.disableDraw();
    }

    if (localStorage) {
      localStorage.lastChosenToolbarOption = lastChosenToolbarOption;
    }
  }
});
