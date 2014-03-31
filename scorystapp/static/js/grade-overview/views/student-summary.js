// TODO: browserify
var StudentSummaryView = IdempotentView.extend({
  templates: {
    studentHeadingTemplate: _.template($('.student-heading-template').html()),
    studentSummaryTemplate: _.template($('.student-summary-template').html()),
    noExamTemplate: _.template($('.no-exam-template').html()),
    notReleasedTemplate: _.template($('.not-released-template').html())
  },

  events: {
    'click a.toggle': 'togglePartDetails',
    'click button.grade': 'goToGradePage'
  },

  render: function(examID, courseUserGraded) {
    // We store this to retrieve the examAnswerId needed to go to the grade page
    this.courseUserGraded = courseUserGraded;

    this.questionPartAnswers = new QuestionPartAnswerCollection();
    // Since our current URL doesn't have the examID or the courseUserID, we
    // pass those along to the questionPartAnswers collection
    this.questionPartAnswers.setExam(examID);
    this.questionPartAnswers.setCourseUserID(courseUserGraded.id);

    var $studentSummaryHeader = $('.student-summary-header');
    $studentSummaryHeader.html(
      this.templates.studentHeadingTemplate({ name: courseUserGraded.fullName })
    );

    var $studentSummaryTable = $('.student-summary-table');
    var self = this;
    this.questionPartAnswers.fetch({
      success: function() {
        var questionPartAnswers = self.questionPartAnswers.toJSON();

        if (questionPartAnswers[0].noMappedExam) {
          $studentSummaryTable.html(self.templates.noExamTemplate());
        } else if (questionPartAnswers[0].notReleased) {
          // Not released. Note that notReleased will always return undefined
          // if a TA/instructor is seeing this
          $studentSummaryTable.html(self.templates.notReleasedTemplate());
        } else {
          self.studentSummary = self.questionPartAnswers.aggregateQuestions();
          var studentSummaryHTML = self.templates.studentSummaryTemplate(self.studentSummary);
          $studentSummaryTable.html(studentSummaryHTML);
        }
      },
      error: function() {
        // TODO: Log error message.
      }
    });
  },

  // Used to expand/contract a question to show details of its parts
  togglePartDetails: function(event) {
    event.preventDefault();
    var $currentTarget = $(event.currentTarget);
    var questionNum = parseInt($currentTarget.parents('tr').attr('data-question'), 10);
    this.$el.find('tr.question-part[data-question=' + questionNum + ']').toggle();
    $currentTarget.parents('tr').find('a.toggle').toggle();
  },

  goToGradePage: function(event) {
    var $currentTarget = $(event.currentTarget);

    var questionNumber = parseInt($currentTarget.parents('tr').attr('data-question'), 10);
    var partNumber = parseInt($currentTarget.parents('tr').attr('data-part'), 10);

    // set active question/part number for grade page
    $.cookie('activeQuestionNumber', questionNumber, { expires: 1, path: '/' });
    $.cookie('activePartNumber', partNumber, { expires: 1, path: '/' });

    window.location = this.courseUserGraded.examAnswerId;
  }
});
