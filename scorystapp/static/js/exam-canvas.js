// TODO: browserify
// This is a basic exam canvas view. Currently, it handles navigation
// (responding to mouse clicks and left/right arrow keyboard shortcuts).
// Clicking the left arrow on the exam canvas or pressing the left arrow key
// goes to the previous page (i.e. where the page number is one less than the
// current page), if any. Clicking the right arrow or pressing the right arrow
// key similarly goes to the next page.
//
// To add the exam canvas base view, you must call render after creating it.
//
// If you wish to extend this view, keep the following in mind:
// 1. The view must trigger the event 'changeExamPage' every time the current
// page is changed.
// 2. Add/remove the class "disabled" to the .previous-page and .next-page
// panels when it is impossible go to to the previous or next pages.
var ExamCanvasView = IdempotentView.extend({
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

    this.$examCanvas = this.$el.find('.exam-canvas');
    this.$previousPage = this.$el.find('.previous-page');
    this.$nextPage = this.$el.find('.next-page');
    this.$examImage = this.$examCanvas.find('.exam-image');
    if (this.$examImage.length === 0) {
      this.$examImage = $('<img class="exam-image" alt="Exam" />').appendTo(this.$examCanvas);
    }

    this.preloadOtherStudentExams = options.preloadOtherStudentExams;
    this.preloadCurExam = options.preloadCurExam;
    this.millisecondsBeforeRetrying = 2000;
    this.curPageNum = 1;

    // get the number of pages the exam has
    var self = this;
    this.fetchTotalNumPages(function(totalNumPages) {
      self.totalNumPages = totalNumPages;
      self.delegateEvents();
    });

    // resize canvas after the image loads or canvas has not yet been resized
    this.$examImage.load(function() {
      if (this.src.indexOf(self.LOADING_ICON) === -1 ||
          self.$examCanvas.height() !== self.$previousPage.height()) {
        $(window).resize();
        var canvasHeight = self.$examCanvas.height();
        self.$previousPage.height(canvasHeight);
        self.$nextPage.height(canvasHeight);
      }
    });

    // if loading the image failed, try to load it again after some time (wait 2
    // seconds, then 4, 8, 16, 32 which is max) while showing loading icon
    this.$examImage.error(function() {
      this.src = self.LOADING_ICON;
      window.setTimeout(function() {
        self.showPage();
      }, self.millisecondsBeforeRetrying);

      // cap exponential backoff time to 32
      if (self.millisecondsBeforeRetrying < 32) {
        self.millisecondsBeforeRetrying *= 2;        
      }
    });

    // events from other elements
    this.listenToDOM($(window), 'keydown', this.handleShortcuts);
  },

  render: function() {
    this.showPage();
    this.createZoomLens();
    this.updateExamArrows();
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
    // updates the exam canvas to show the image corresponding to the current
    // page number
    this.$examImage.attr('src', 'get-exam-jpeg/' + this.curPageNum + '/');
    this.preloadImages();
  },

  createZoomLens: function() {
    var zoomLensView = new ZoomLensView({
      curPageNum: this.curPageNum,
      el: '.exam-canvas'
    });
    this.registerSubview(zoomLensView);
    // zoom lens should know when the exam page changes, so that it will load
    // the correct page
    zoomLensView.listenTo(this, 'changeExamPage', zoomLensView.changeExamPage);
  },

  getCurPageNum: function() {
    return this.curPageNum;
  },

  // handles the user clicking on the left arrow or using the keyboard
  // shortcut to navigate to the previous page
  goToPreviousPage: function() {
    if (this.curPageNum > 1) {
      this.curPageNum -= 1;
      this.trigger('changeExamPage', this.curPageNum);
      this.updateExamArrows();
      this.showPage();
    }
  },

  // handles the user clicking on the left arrow or using the keyboard
  // shortcut to navigate to the next page
  goToNextPage: function() {
    if (this.curPageNum < this.totalNumPages) {
      this.curPageNum += 1;
      this.trigger('changeExamPage', this.curPageNum);
      this.updateExamArrows();
      this.showPage();
    }
  },

  // callback takes the number of total pages in the exam
  fetchTotalNumPages: function(callback) {
    $.ajax({
      url: 'get-exam-page-count/'
    }).done(function(data) {
      callback(parseInt(data, 10));
    });
  },

  getTotalNumPages: function() {
    return self.totalNumPages;
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
        var image = new Image();
        image.src = 'get-student-jpeg/' + i + '/' + this.curPageNum + '/';
      }
    }
  },

  updateExamArrows: function() {
    // first disable both arrows
    this.$nextPage.removeClass('disabled');
    this.$previousPage.removeClass('disabled');

    // next, check if any need to be disabled. note that it  isn't possible for
    // arrows to "flicker" since this function is called only when the current page
    // number has changed. thus, if either arrow should now be disabled, they
    // would not have been disabled previously.
    if (this.curPageNum === 1) {
      this.$previousPage.addClass('disabled');
    } else if (this.curPageNum === this.totalNumPages) {
      this.$nextPage.addClass('disabled');
    }
  }
});
