// TODO: browserify
var StudentsNavView = IdempotentView.extend({
  templates: {
    studentTemplate: _.template($('.student-template').html()),
    filteringTemplate: _.template($('.student-filtering-template').html()),
  },

  events: {
    'click [type="checkbox"]': 'checkboxFilter',
    'change .questions-filter': 'questionsFilter',
    'click a.name': 'changeStudent',
    'keyup .search': 'searchForStudents'
  },

  initialize: function(options) {
    this.constructor.__super__.initialize.apply(this, arguments);
    this.$studentScroll = $('.students-scroll');
    this.SCROLLBAR_HEIGHT = 500;
    this.renderScrollbar();
    this.previousSearchValue = '';
  },

  render: function(assessmentID) {
    this.assessmentID = assessmentID;

    var courseUsersGraded = new CourseUserGradedCollection();
    courseUsersGraded.setAssessment(this.assessmentID);

    this.studentSummaryView = new StudentSummaryView({ el: '.student-summary' });
    this.registerSubview(this.studentSummaryView);

    var self = this;
    courseUsersGraded.fetch({
      success: function() {
        self.courseUsersGraded = courseUsersGraded.toJSON();

        // By default, selectedOptionValue is 0, implying the entire assessment
        // as opposed to a particular question
        self.selectedOptionValue = 0;
        self.isGradedChecked = true;
        self.isUngradedChecked = true;
        self.isUnmappedChecked = false;

        self.renderFilters();
        self.renderStudentsList();
      },
      error: function() {
        // TODO: Log error message.
      }
    });
  },

  checkboxFilter: function(event) {
    this.isGradedChecked = $('.graded').is(':checked');
    this.isUngradedChecked = $('.ungraded').is(':checked');
    this.isUnmappedChecked = $('.unmapped').is(':checked');
    this.renderStudentsList();
  },

  // User chose a new question to filter by
  questionsFilter: function(event) {
    this.selectedOptionValue = parseInt($('.questions-filter').val(), 10);
    this.renderFilters();
    this.renderStudentsList();
  },

  renderFilters: function() {
    var numGraded = 0;
    var numUngraded = 0;
    var numUnmapped = 0;

    var self = this;
    self.courseUsersGraded.forEach(function(courseUserGraded) {
      var curQuestion = courseUserGraded.questionsInfo[self.selectedOptionValue];
      if (!courseUserGraded.isMapped) {
        numUnmapped++;
      } else if (curQuestion.isGraded) {
        numGraded++;
      } else {
        numUngraded++;
      }
    });

    var $filtering = $('.filtering');
    $filtering.html(self.templates.filteringTemplate({
      isGradedChecked: self.isGradedChecked,
      isUngradedChecked: self.isUngradedChecked,
      isUnmappedChecked: self.isUnmappedChecked,

      numGraded: numGraded,
      numUngraded: numUngraded,
      numUnmapped: numUnmapped,

      selectedOptionValue: self.selectedOptionValue,
      numQuestions: self.courseUsersGraded[0].questionsInfo.length
    }));
  },

  renderStudentsList: function() {
    var $courseUsers = $('.course-users');
    // Get rid of what was already there
    $courseUsers.html('');

    var courseUsersToDisplay = this.applyFilters();
    var self = this;
    courseUsersToDisplay.forEach(function(courseUserToDisplay, index) {
      // Display them
      $courseUsers.append(self.templates.studentTemplate({
        courseUserInfo: courseUserToDisplay,
        index: index
      }));
    });
    // Show the first course user
    if (courseUsersToDisplay.length > 0) {
      this.studentSummaryView.render(this.assessmentID, courseUsersToDisplay[0].courseUser);
    }
    this.updateScrollbar();
  },

  // Only returns students to whom the filters applied
  applyFilters: function() {
    var courseUsersToDisplay = [];

    var self = this;
    this.courseUsersGraded.forEach(function(courseUserGraded) {
      var curQuestion = courseUserGraded.questionsInfo[self.selectedOptionValue];

      if ((curQuestion.isGraded && self.isGradedChecked) ||
          (!curQuestion.isGraded && courseUserGraded.isMapped && self.isUngradedChecked) ||
          (!courseUserGraded.isMapped && self.isUnmappedChecked)) {

        courseUsersToDisplay.push({
          courseUser: courseUserGraded,
          selectedOptionValue: self.selectedOptionValue
        });
      }
    });

    return courseUsersToDisplay;
  },

  // Changes the student associated with studentSummaryView
  changeStudent: function(event) {
    event.preventDefault();
    var $target = $(event.target);

    $target.parents('ul').children('li').removeClass('active');
    $target.parents('li').addClass('active');

    var courseUserID = $target.data('course-user-id');

    for (var i = 0; i < this.courseUsersGraded.length; i++) {
      if (this.courseUsersGraded[i].id === courseUserID) {
        // Render the chosen student's assessment summary
        this.studentSummaryView.render(this.assessmentID, this.courseUsersGraded[i]);
        break;
      }
    }
  },

  // Only displays student names in the nav who match the search query
  searchForStudents: function(event) {
    var $studentSearch = this.$('.search');
    var searchValue = $studentSearch.val().toLowerCase();

    if (this.previousSearchValue === searchValue) return;

    // hide students that don't match search text; show students that do
    this.$el.find('ul').find('li').each(function() {
      var $li = $(this);
      var text = $li.find('a').text();

      if (text.toLowerCase().indexOf(searchValue) === -1) {
        $li.hide();
      } else {
        $li.show();
      }
    });

    this.previousSearchValue = searchValue;
    this.updateScrollbar();
  },

  renderScrollbar: function() {
    this.$studentScroll.css('height', this.SCROLLBAR_HEIGHT + 'px');
    this.$studentScroll.customScrollbar();
  },

  updateScrollbar: function() {
    this.$studentScroll.customScrollbar('resize');
  }
});
