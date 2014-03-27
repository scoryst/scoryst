// TODO: browserify
// This is a general exam canvas view where goToPreviousPage and goToNextPage
// behave as expected, going to the page of the exam one before and one after
// the current page, respectively. Nothing happens if the user attempts to go
// before the first page or after the last page.
//
// To use this view, 3 options must be passed in:
// preloadNumber: For each of the options below, the number of jpegs to attempt
//     to preload in one direction. 
// preloadOtherStudentExams: true if the next/previous student exams should be
//     preloaded and false otherwise
// preloadCurExam: true if the next and previous pages of the current exam
//     should be preloaded and false otherwise
var ExamCanvasView = ExamCanvasBaseView.extend({
  initialize: function(options) {
    this.constructor.__super__.initialize.apply(this, arguments);

    this.setTotalNumPages();
    this.curPageNum = 1;

    this.preloadNumber = options.preloadNumber;
    this.preloadOtherStudentExams = options.preloadOtherStudentExams;
    this.preloadCurExam = options.preloadCurExam;

    this.render();
  },

  goToPreviousPage: function() {
    if (this.curPageNum > 1) {
      this.curPageNum -= 1;
      this.trigger('changeExamPage', this.curPageNum);
      this.showPage();
    }
  },

  goToNextPage: function() {
    if (this.curPageNum < this.totalNumPages) {
      this.curPageNum += 1;
      this.trigger('changeExamPage', this.curPageNum);
      this.showPage();
    }
  },

  preloadImages: function() {
    if (this.preloadCurExam) {
      for (var i = -this.preloadNumber; i <= this.preloadNumber; i++) {
        // preload pages before and after, corresponding to the current student
        var pageToPreload = this.curPageNum + i;
        if (pageToPreload >= 1 && pageToPreload <= this.totalNumPages) {
          var image = new Image();
          image.src = 'get-exam-jpeg/' + pageToPreload + '/';
        }
      }
    }

    if (this.preloadOtherStudentExams) {
      for (var i = -this.preloadNumber; i <= this.preloadNumber; i++) {
        var image = new Image();
        image.src = 'get-student-jpeg/' + i + '/' + this.curPageNum + '/';
      }
    }
  },

  setTotalNumPages: function() {
    var self = this;
    $.ajax({
      url: 'get-exam-page-count/',
      dataType: 'text',
      async: false
    }).done(function(data) {
      self.totalNumPages = parseInt(data, 10);
    });
  },

  totalNumPages: function() {
    return self.totalNumPages;
  }

});
