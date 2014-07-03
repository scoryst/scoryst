var AssessmentCanvasView = BaseAssessmentCanvasView.extend({
  fetchPagesCallback: function(pages) {
    this.pages = pages;
    this.pageIndex = 0;
    this.render();
    this.delegateEvents();
  },

  preloadStudentAssessments: function() {
    if (this.preloadOtherStudentAssessments) {
      for (var i = -this.preloadOtherStudentAssessments; i <= this.preloadOtherStudentAssessments; i++) {
        var image = new Image();
        image.src = 'get-student-jpeg/' + i + '/' + this.pages[this.pageIndex] + '/';
      }
    }
  }
});
