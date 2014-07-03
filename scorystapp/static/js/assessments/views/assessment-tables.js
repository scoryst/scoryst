var AssessmentTablesView = IdempotentView.extend({

  templates: {
    homeworkTableTemplate: _.template($('.homework-row-template').html()),
    examTableTemplate: _.template($('.exam-row-template').html())
  },

  initialize: function(options) {
    this.constructor.__super__.initialize.apply(this, arguments);

    this.assessments = options.assessments;
    this.render();
    this.addPopovers();
  },

  render: function() {
    // divide the assessments by type into different arrays
    var homeworks = [];
    var exams = [];

    this.assessments.forEach(function(assessment) {
      if (assessment.get('isExam')) {
        exams.push(assessment.toJSON());
      } else {
        homeworks.push(assessment.toJSON());
      }
    });

    var self = this;

    // fill in the homework table
    var $homeworkTable = this.$('.homework-table tbody');
    homeworks.forEach(function(homework) {
      $homeworkTable.append(self.templates.homeworkTableTemplate(homework));
    });

    // fill in the exams table
    var $examTable = this.$('.exam-table tbody');
    exams.forEach(function(exam) {
      $examTable.append(self.templates.examTableTemplate(exam));
    });
  },

  addPopovers: function() {
    // popover gives information when hovered about why deletion is not possible
    var actionsInfoPopoverText = 'Once students have been assigned to an assessment, ' +
      'that assessment can no longer be edited or deleted';

    var $actionsInfoPopover = this.$el.find('.info-popover.actions');
    $actionsInfoPopover.popover({ content: actionsInfoPopoverText });

    var submitInfoPopoverText = 'Submit assignment for a student.';
    var $submitInfoPopover = $('.info-popover.submit');
    $submitInfoPopover.popover({ content: submitInfoPopoverText });

    // create the popover to warn deletion from roster
    this.$('.delete').popoverConfirm();
  }
});
