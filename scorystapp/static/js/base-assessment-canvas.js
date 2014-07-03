// TODO: browserify
// This is a virtual assessment canvas view. Currently, it handles navigation
// (responding to mouse clicks and left/right arrow keyboard shortcuts).
// Clicking the left arrow on the assessment canvas or pressing the left arrow key
// goes to the previous page (i.e. where the page number is one less than the
// current page), if any. Clicking the right arrow or pressing the right arrow
// key similarly goes to the next page.
//
// To extend the assessment canvas base view, you must finish implementing
// `fetchPagesCallback` and `preloadStudentAssessments`.
//
// Also, keep in mind that the view must trigger the event 'changeAssessmentPage'
// every time the current page is changed.
var BaseAssessmentCanvasView = IdempotentView.extend({
  // key codes for keyboard shorcuts
  LEFT_ARROW_KEY_CODE: 37,
  RIGHT_ARROW_KEY_CODE: 39,
  LOADING_ICON: '/static/img/loading_big.gif',

  events: {
    'click .previous-page': 'goToPreviousPage',
    'click .next-page': 'goToNextPage',
  },

  initialize: function(options) {
    IdempotentView.prototype.initialize.apply(this, arguments);

    this.$assessmentCanvas = this.$el.find('.assessment-canvas');
    this.$previousPage = this.$el.find('.previous-page');
    this.$nextPage = this.$el.find('.next-page');
    this.$assessmentImage = this.$assessmentCanvas.find('.assessment-image');
    if (this.$assessmentImage.length === 0) {
      this.$assessmentImage = $('<img>', { class: 'assessment-image', alt: 'assessment' })
        .appendTo(this.$assessmentCanvas);
    }

    this.preloadOtherStudentAssessments = options.preloadOtherStudentAssessments;
    this.preloadCurAssessment = options.preloadCurAssessment;

    // get the number of pages the assessment has
    this.fetchPages(_.bind(this.fetchPagesCallback, this));

    var self = this;

    // resize canvas after the image loads
    this.$assessmentImage.load(function() {
      if (self.$assessmentCanvas.height() !== self.$previousPage.height()) {
        $(window).resize();
        var canvasHeight = self.$assessmentCanvas.height();
        self.$previousPage.height(canvasHeight);
        self.$nextPage.height(canvasHeight);
      }
    });

    // if loading the image failed, show the loading error gif
    this.$assessmentImage.error(function() {
      this.src = self.LOADING_ICON;
    });

    // events from other elements
    this.listenToDOM($(window), 'keydown', this.handleShortcuts);
  },

  render: function() {
    this.showPage();
    this.createZoomLens();
    this.updateAssessmentArrows();
    this.preloadImages();
  },

  handleShortcuts: function(event) {
    // ignore keys entered in an input/textarea
    var $target = $(event.target);
    if ($target.is('input') || $target.is('textarea')) {
      return;
    }

    switch (event.keyCode) {
      case this.LEFT_ARROW_KEY_CODE:
        event.preventDefault();
        this.goToPreviousPage();
        break;

      case this.RIGHT_ARROW_KEY_CODE:
        event.preventDefault();
        this.goToNextPage();
        break;
    }
  },

  showPage: function() {
    // update canvas to show the image corresponding to the current page number
    this.$assessmentImage.attr('src', 'get-assessment-jpeg/' + this.pages[this.pageIndex] + '/');
    this.trigger('changeAssessmentPage', this.pages[this.pageIndex]);
    this.preloadImages();
  },

  createZoomLens: function() {
    var zoomLensView = new ZoomLensView({
      curPageNum: this.getCurPageNum(),
      el: '.assessment-canvas'
    });
    this.registerSubview(zoomLensView);
    // zoom lens should know when the assessment page changes, so that it will load
    // the correct page
    zoomLensView.listenTo(this, 'changeAssessmentPage', zoomLensView.changeAssessmentPage);
  },

  getCurPageNum: function() {
    return this.pages[this.pageIndex];
  },

  // handles the user clicking on the left arrow or using the keyboard shortcut
  // to navigate to the previous page
  goToPreviousPage: function() {
    if (this.pageIndex > 0) {
      this.pageIndex -= 1;
      this.updateAssessmentArrows();
      this.showPage();
    }
  },

  // handles the user clicking on the right arrow or using the keyboard
  // shortcut to navigate to the next page
  goToNextPage: function() {
    if (this.pageIndex < this.pages.length - 1) {
      this.pageIndex += 1;
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

  fetchPagesCallback: function(pages) {
    console.log('ERROR: fetchPagesCallback is not overwritten');
  },

  getMaxPageNumber: function() {
    return Math.max.apply(Math, this.pages);
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

    this.preloadStudentAssessments();
  },

  preloadStudentAssessments: function() {
    console.log('ERROR: preloadStudentAssessments is not overwritten');
  },

  updateAssessmentArrows: function() {
    // first disable both arrows
    this.$nextPage.removeClass('disabled');
    this.$previousPage.removeClass('disabled');

    if (this.pageIndex === 0) {
      this.$previousPage.addClass('disabled');
    } else if (this.pageIndex === this.pages.length - 1) {
      this.$nextPage.addClass('disabled');
    }
  }
});
