var ExamAnswerPageCollection = Backbone.Collection.extend({
  url: function() {
    return window.location.pathname + 'exam-answer-pages/' +
      this.examId;
  },

  setExamId: function(examId) {
    // keep track of the exam ID to retrieve unmapped pages for
    this.examId = examId;
  }
});

var UploadView = Backbone.View.extend({
  REFRESH_DURATION: 3000,
  template: _.template($('.progress-template').html()),

  initialize: function(options) {
    this.examAnswerPages = new ExamAnswerPageCollection();
    this.$exam = this.$('#id_exam_name');
    this.$uploadProgress = this.$('.upload-progress');

    var examId = parseInt(this.$exam.val(), 10);
    this.examAnswerPages.setExamId(examId);

    // fetch exam answer pages and call render
    var self = this;
    this.examAnswerPages.fetch({
      success: function() {
        self.render();
      }
    });
  },

  render: function() {
    // compute statistics for number of pages uploaded
    var numPages = this.examAnswerPages.length;
    var numUploaded = 0;

    this.examAnswerPages.each(function(page) {
      if (page.isUploaded) {
        numUploaded++;
      }
    });

    // update progress
    this.$uploadProgress.html(this.template({
      numPages: numPages,
      numUploaded: numUploaded,
      percentUploaded: numUploaded * 100 / numPages
    }));

    this.refreshTimeout = setTimeout(_.bind(this.render, this),
      this.REFRESH_DURATION);
  }


  // TODO: set exam
});


$(function() {
  new UploadView({ el: $('.upload') });
});
