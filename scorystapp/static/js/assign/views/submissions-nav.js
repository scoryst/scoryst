// TODO: browserify
var SubmissionsNavView = IdempotentView.extend({
  templates: {
    submissionsTemplate: _.template(this.$('.submissions-template').html()),
    filteringTemplate: _.template(this.$('.submissions-filtering-template').html())
  },

  events: {
    'change [type="checkbox"]': 'checkboxFilter',
    'click .submission': 'changeSubmission',
  },

  initialize: function() {
    this.constructor.__super__.initialize.apply(this, arguments);

    this.$studentsScroll = this.$('.students-scroll');
    this.SCROLLBAR_HEIGHT = 500;
    this.renderScrollbar();

    this.isShowAssignedChecked = true;
    this.isShowUnassignedChecked = true;

    this.handleBackButton();
    var currentPath = window.location.pathname;

    // Fetch the basePath for easy change of URLs when the user goes to another student
    var searchStr = currentPath.replace(/^(.*\/)[^\/]*\/$/, '$1');
    this.basePath = currentPath.substr(0, searchStr.length);
    var curSubmissionId = parseInt(currentPath.replace(/^.*\/([^\/]*)\/$/, '$1'));

    this.submissions = new SubmissionCollection();

    this.assessmentCanvasView = new AssessmentCanvasView({
      el: '.assessment',
      preloadOtherStudentAssessments: 0,
      preloadCurAssessment: 0
    });

    var self = this;

    // Fetches all the submissions, sets currentSubmission appropriately and
    // then calls renderSubmissions
    this.submissions.fetch({
      success: function() {
        self.currentSubmission = self.submissions.filter(function(submission) {
          return submission.id === curSubmissionId;
        })[0];
        self.renderSubmissions();
      }
    });
  },

  renderSubmissions: function() {
    var $submissions = this.$('.submissions');
    var currentSubmission = this.currentSubmission.toJSON();

    var submissions = this.applyFilters();

    $submissions.html(this.templates.submissionsTemplate({
      submissions: submissions,
      curSubmissionId: currentSubmission.id
    }));

    Mediator.trigger('changeSubmissionName', currentSubmission.name || '');
    this.resizeScrollbar();
  },

  checkboxFilter: function() {
    this.isShowAssignedChecked = $('.show-assigned').is(':checked');
    this.isShowUnassignedChecked = $('.show-unassigned').is(':checked');
    this.renderSubmissions();

    // Select first submission under the new filtering rules
    if (this.$('.active').length === 0) {
      this.$('.submission').eq(0).click();
    }
  },

  renderFilters: function(numAssigned, numUnassigned) {
    var $filtering = this.$('.filtering');

    $filtering.html(this.templates.filteringTemplate({
      isShowAssignedChecked: this.isShowAssignedChecked,
      isShowUnassignedChecked: this.isShowUnassignedChecked,

      numAssigned: numAssigned,
      numUnassigned: numUnassigned
    }));
  },

  // Returns `submissions` that match the user's filter.
  applyFilters: function() {
    var submissions = this.submissions.toJSON();
    var numAssigned = 0;
    var numUnassigned = 0;
    var self = this;

    var filteredSubmissions = submissions.filter(function(submission) {
      if (submission.courseUser) {
        numAssigned++;
        if (self.isShowAssignedChecked) {
          return true;
        }
      } else {
        numUnassigned++;
        if (self.isShowUnassignedChecked) {
          return true;
        }
      }
      return false;
    });
    self.renderFilters(numAssigned, numUnassigned);
    return filteredSubmissions;
  },

  changeSubmission: function(event) {
    event.preventDefault();
    var $currentTarget = $(event.currentTarget);

    $currentTarget.parents('ul').children('li').removeClass('active');
    $currentTarget.parents('li').addClass('active');

    var submissionId = $currentTarget.data('submission-id');
    var self = this;

    // Find the new submission, set it to current and display it
    this.submissions.forEach(function(submission) {
      if (submission.id === submissionId) {
        var submissionObject = submission.toJSON();
        self.showSubmission(submissionObject);
        self.currentSubmission = submission;
      }
    });
  },

  assignSubmissionToStudent: function(courseUser) {
    var unassignedId;
    var currentSubmission = this.currentSubmission.toJSON();

    // If this submission was previously assigned to some other student,
    // that student no longer has any exams assigned to him, so we set the
    // unassignedId to his id and return it to the parent view
    if (currentSubmission.courseUser != courseUser) {
      unassignedId = currentSubmission.courseUser;
    }
    var self = this;
    // Save the current submission with the correct `courseUser`
    this.currentSubmission.save({
      courseUser: courseUser
    }, {
      success: function() {
        // 1. User is filtering by unassigned. Submission is assigned so no element
        // is active once we render, so it needs to be done before self.renderSubmissions()
        if (self.isShowUnassignedChecked && !self.isShowAssignedChecked) {
          self.$('.active').next().find('a').click();
        }
        self.renderSubmissions();

        // 2. User is filtering by assigned. Submission 1 was assigned to X and Submission 2
        // was assigned to Y. User assigns Submission 1 to Y, now Submission 2 becomes
        // unassigned so it needs to be done after self.renderSubmissions()
        if (!self.isShowUnassignedChecked || self.isShowAssignedChecked) {
          self.$('.active').next().find('a').click();
        }
      },
      wait: true
    });

    // The current student may have been previously assigned a submission
    // We loop through all the exams, and see if he was previously assigned
    // If so, we remove that assignment
    this.submissions.forEach(function(submission) {
      var submissionObject = submission.toJSON();
      if (submission.id !== currentSubmission.id && submissionObject.courseUser == courseUser) {
        submission.save({
          courseUser: null
        }, {
          success: function() {
            self.renderSubmissions();
          },
          wait: true
        });
      }
    });

    this.$studentsScroll.customScrollbar('scrollTo',
      'a[data-submission-id="' + currentSubmission.id + '"]');

    return unassignedId;
  },

  showSubmission: function(submission) {
    var newPath = this.basePath + submission.id + '/';
    // update URL with history API; fall back to standard redirect
    if (window.history) {
      window.history.pushState(this.currentSubmission.toJSON(), null, newPath);
      // The URL has changed, so image loader will show the new exam
      this.assessmentCanvasView.showPage();
      Mediator.trigger('changeSubmissionName', submission.name || '');
    } else {
      window.location.pathname = newPath;
    }
  },

  renderScrollbar: function() {
    this.$studentsScroll.css('height', this.SCROLLBAR_HEIGHT + 'px');
    this.$studentsScroll.customScrollbar();
  },

  resizeScrollbar: function() {
    this.$studentsScroll.customScrollbar('resize');
  },

  // To make the back button work, we need to :
  // 1. Set active class for the correct submission
  // 2. Show the submission
  // 3. Have currentSubmission updated
  // 4. Trigger the mediator
  handleBackButton: function() {
    var self = this;
    // Makes the back button work by handling the popstate event.
    this.listenToDOM($(window), 'popstate', function(event) {
      var prevSubmission = event.originalEvent.state;
      if (!prevSubmission) {
        return;
      }
      self.currentSubmission = self.submissions.filter(function(submission) {
        return submission.id === prevSubmission.id;
      })[0];
      self.renderSubmissions();
      self.assessmentCanvasView.showPage();
    });
  }
});
