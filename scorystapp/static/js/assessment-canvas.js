var AssessmentCanvasView = BaseAssessmentCanvasView.extend({
  events: function() {
    // extends the parent view's events
    return _.extend({}, this.constructor.__super__.events, {
      'click .enable-zoom': 'handleZoomClick'
    });
  },

  fetchPagesCallback: function(pages) {
    this.pages = pages;
    this.pageIndex = 0;
    this.render();
    this.delegateEvents();

    if (localStorage && localStorage.zoomLensEnabled === 'true') {
      this.$('.enable-zoom').addClass('active');
    }
  },

  preloadStudentAssessments: function() {
    if (this.preloadOtherStudentAssessments) {
      for (var i = -this.preloadOtherStudentAssessments; i <= this.preloadOtherStudentAssessments; i++) {
        var image = new Image();
        image.src = 'get-student-jpeg/' + i + '/' + this.pages[this.pageIndex] + '/';
      }
    }
  },

  handleZoomClick: function(event) {
    var $zoomLensButton = $(event.currentTarget);

    // if the clicked toolbar option is already action, remove active class
    if ($zoomLensButton.hasClass('active')) {
      $zoomLensButton.removeClass('active');
      this.zoomLensView.disableZoom();
    } else {
      $zoomLensButton.addClass('active');
      this.zoomLensView.enableZoom();
    }
  }
});
