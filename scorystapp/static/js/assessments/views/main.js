var MainView = IdempotentView.extend({

  initialize: function(options) {
    this.constructor.__super__.initialize.apply(this, arguments);

    this.assessments = new AssessmentCollection();
    // an `assessmentId` means that the user is editing an existing assessment
    this.assessmentId = parseInt(this.$('form').attr('data-assessment-id'), 10);

    var self = this;
    this.assessments.fetch({
      success: function() {
        self.renderAssessmentsTable();

        // user is editing an existing assessment
        if (self.assessmentId) {
          self.assessment = self.assessments.findWhere({ id: self.assessmentId });

          self.renderAssessmentsForm(self.assessment);
        }

        // user is creating a new assessment
        else {
          self.renderAssessmentsForm();
        }
      }
    });
  },

  renderAssessmentsTable: function() {
    var assessmentsTableView = new AssessmentTablesView({
      el: this.$('.assessments-tables'),
      assessments: this.assessments
    });

    this.registerSubview(assessmentsTableView);
  },

  renderAssessmentsForm: function(assessment) {
    var assessmentsForm = new AssessmentFormView({
      el: this.$('.assessment-form'),
      assessment: assessment,
      timezoneString: this.$('.timezone-string').html()
    });

    this.registerSubview(assessmentsForm);
  }

});

$(function() {
  var mainView = new MainView({
    el: $('.assessments')
  });
});
