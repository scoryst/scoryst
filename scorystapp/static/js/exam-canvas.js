// TODO: browserify
// This is a general exam canvas; goToLogicalPreviousPage and goToLogicalNextPage
// behave as expected, going to the page of the exam one before and one after
// the current page, respectively. Nothing happens if the user attempts to go
// before the first page or after the last page.
//
// To use this view, 2 options can be passed in:
// preloadOtherStudentExams: # of student exam jpegs to preload in each
//     direction for the next/previous student exams
// preloadCurExam: # of current exam jpegs to preload in each direction
//
// If any option is undefined, the preloading will not occur for that option.
var ExamCanvasView = ExamCanvasBaseView.extend({
  initialize: function(options) {
    this.constructor.__super__.initialize.apply(this, arguments);

    this.curPageNum = 1;

    this.$previousPage = this.$el.find('.previous-page');
    this.$nextPage = this.$el.find('.next-page');

    this.$previousPage.addClass('disabled');
    this.undelegateEvents();

    var self = this;
    this.setTotalNumPages(function(totalNumPages) {
      self.totalNumPages = totalNumPages;
      self.delegateEvents();
      self.render();
    });
  },

  goToLogicalPreviousPage: function() {
    if (this.curPageNum > 1) {
      this.curPageNum -= 1;
      this.$nextPage.removeClass('disabled');
      if (this.curPageNum === 1) {
        this.$previousPage.addClass('disabled');
      }
      this.trigger('changeExamPage', this.curPageNum);
      this.showPage();
    }
  },

  goToLogicalNextPage: function() {
    if (this.curPageNum < this.totalNumPages) {
      this.curPageNum += 1;
      this.$previousPage.removeClass('disabled');
      if (this.curPageNum === this.totalNumPages) {
        this.$nextPage.addClass('disabled');
      }
      this.trigger('changeExamPage', this.curPageNum);
      this.showPage();
    }
  },

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

  // callback takes the number of total pages in the exam
  setTotalNumPages: function(callback) {
    var self = this;
    $.ajax({
      url: 'get-exam-page-count/',
      dataType: 'text'
    }).done(function(data) {
      callback(parseInt(data, 10));
    });
  },

  getTotalNumPages: function() {
    return self.totalNumPages;
  }

});
