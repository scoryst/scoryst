var MainView = IdempotentView.extend({
  template: _.template($('.exam-pill-template').html()),

  events: {
    'click a.exam': 'changeExam',
  },

  initialize: function(options) {
    this.constructor.__super__.initialize.apply(this, arguments);
    this.exams = new ExamCollection();

    var self = this;

    this.exams.fetch({
      success: function() {
        var $examNav = $('.exam-nav');
        var exams = self.exams.toJSON();
        exams.forEach(function(exam, index) {
          var templateData = {
            exam: exam,
            last: index == self.exams.length - 1
          }
          $examNav.append(self.template(templateData));
        });

        // By default, we show the last exam
        var examID = exams[exams.length - 1].id;
        self.renderStudentsNav(examID);
        self.updateExamOptions(examID);
      }
    });
  },

  changeExam: function(event) {
    event.preventDefault();
    var $target = $(event.target);
    var examID = $target.data('exam-id');

    $target.parents('ul').children('li').removeClass('active');
    // Remove any previous views
    this.deregisterSubview();
    this.renderStudentsNav(examID);
    $target.parents('li').addClass('active');

    this.updateExamOptions(examID);
  },

  renderStudentsNav: function(examID) {
    var studentsNavView = new StudentsNavView({ el: this.$('.students') });
    studentsNavView.render(examID);
    this.registerSubview(studentsNavView);
  },

  updateExamOptions: function(examID) {
    // Update export exam link
    $('.export-csv').attr('href', examID + '/csv/');

    if (this.popover) {
      this.popover.unbindPopoverConfirm();
    }

    // Create release popover
    this.popover = $('.release-grades').popoverConfirm({
      placement: 'right',
      text: 'Once you release grades, students with graded exams who have not' +
        ' been previously notified will receive an email and be able to view their scores.',
      confirmText: 'Release',
      confirm: function() {
        $.ajax({
          url: examID + '/release/'
        }).done(function() {
          $('.error').hide();
          $('.success').fadeIn();
        }).fail(function() {
          $('.success').hide();
          $('.error').fadeIn();
        });
      }
    });
  }
});

$(function() {
  var mainView = new MainView({ el: $('.grade-overview') });
});
