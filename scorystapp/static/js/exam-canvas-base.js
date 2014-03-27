// TODO: browserify
// This is an "abstract" view that should be extended with the following methods:
// goToPreviousPage, goToNextPage, preloadImages. Further, the view must trigger
// the event 'changeExamPage' every time the current page is changed.
// Other methods can be added as needed.
var ExamCanvasBaseView = IdempotentView.extend({
  // key codes for keyboard shorcuts
  LEFT_ARROW_KEY_CODE: 37,
  RIGHT_ARROW_KEY_CODE: 39,
  LEFT_BRACKET_KEY_CODE: 219,
  RIGHT_BRACKET_KEY_CODE: 221,

  events: {
    'click .previous-page': 'goToPreviousPage',
    'click .next-page': 'goToNextPage',
  },

  initialize: function(options) {
    IdempotentView.prototype.initialize.apply(this, arguments);

    this.loadingIcon = '/static/img/loading_big.gif';
    this.millisecondsBeforeRetrying = 2000;
    this.loadImage();

    // events from other elements
    this.listenToDOM($(window), 'keydown', this.handleShortcuts);
  },

  render: function() {
    this.showPage();
    this.createZoomLens();
    this.preloadImages();
  },

  loadImage: function() {
    var self = this;
    this.$el.find('.exam-image').load(function() {
      // only resize if the image loaded and resize has not been previously called
      if (this.src.indexOf(self.loadingIcon) < 0 || !self.resized) {
        self.resized = true;
        $(window).resize();
        var canvasHeight = self.$el.find('.exam-canvas').height();
        self.$el.find('.previous-page').height(canvasHeight);
        self.$el.find('.next-page').height(canvasHeight);
      }
    });

    this.$el.find('.exam-image').error(function() {
      this.src = self.loadingIcon;

      // when loading the image failed, try to load it after amount of time; first
      // wait 2 seconds, then 4, then 8, etc.
      window.setTimeout(function() {
        self.showPage();
      }, self.millisecondsBeforeRetrying);

      self.millisecondsBeforeRetrying *= 2;
    });
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
        this.goToPreviousPage(false);
        break;

      case this.RIGHT_ARROW_KEY_CODE:
        event.preventDefault();
        this.goToNextPage(false);
        break;

      case this.LEFT_BRACKET_KEY_CODE:
        this.goToPreviousPage(true);
        break;

      case this.RIGHT_BRACKET_KEY_CODE:
        this.goToNextPage(true);
        break;
    }
  },

  showPage: function() {
    this.resized = false;
    this.$el.find('.exam-image').attr('src', 'get-exam-jpeg/' + this.curPageNum + '/');
    this.preloadImages();
  },

  createZoomLens: function() {
    var zoomLensView = new ZoomLensView({
      curPageNum: this.curPageNum,
      questionPartAnswer: self.model,
      el: '.exam-canvas'
    });
    this.registerSubview(zoomLensView);
    zoomLensView.listenTo(this, 'changeExamPage', zoomLensView.changeExamPage)
  },

  getCurPageNum: function() {
    return this.curPageNum;
  },

  preloadImages: function() {
    // handles preloading images for faster navigation through different jpegs
    //
    // currently does nothing; override this method
  },

  goToPreviousPage: function() {
    // handles the user clicking on the left arrow or using the keyboard
    // shortcut to navigate to the logical "previous" page
    //
    // currently does nothing; override this method
  },

  goToNextPage: function() {
    // handles the user clicking on the left arrow or using the keyboard
    // shortcut to navigate to the logical "next" page
    //
    // currently does nothing; override this method
  }
});
