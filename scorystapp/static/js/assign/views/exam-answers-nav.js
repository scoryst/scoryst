// TODO: browserify
var ExamAnswersNavView = IdempotentView.extend({
  templates: {
    examAnswersTemplate: _.template(this.$('.exam-answers-template').html()),
    filteringTemplate: _.template(this.$('.exam-answers-filtering-template').html())
  },

  events: {
    'change [type="checkbox"]': 'checkboxFilter',
    'click .exam-answer': 'changeExamAnswer',
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
    var curExamAnswerId = parseInt(currentPath.replace(/^.*\/([^\/]*)\/$/, '$1'));

    this.examAnswers = new ExamAnswerCollection();

    this.examCanvasView = new ExamCanvasView({
      el: '.exam',
      preloadOtherStudentExams: 0,
      preloadCurExam: 0
    });

    var self = this;

    // Fetches all the exam answers, sets currentExamAnswer appropriately and
    // then calls renderExamAnswers
    this.examAnswers.fetch({
      success: function() {
        self.currentExamAnswer = self.examAnswers.filter(function(examAnswer) {
          return examAnswer.id === curExamAnswerId;
        })[0];
        self.renderExamAnswers();
      }
    });
  },

  renderExamAnswers: function() {
    var $examAnswers = this.$('.exam-answers');
    var currentExamAnswer = this.currentExamAnswer.toJSON();

    var examAnswers = this.applyFilters();

    $examAnswers.html(this.templates.examAnswersTemplate({
      examAnswers: examAnswers,
      curExamAnswerId: currentExamAnswer.id
    }));

    Mediator.trigger('changeExamAnswerName', currentExamAnswer.name || '');
    this.resizeScrollbar();
  },

  checkboxFilter: function() {
    this.isShowAssignedChecked = $('.show-assigned').is(':checked');
    this.isShowUnassignedChecked = $('.show-unassigned').is(':checked');
    this.renderExamAnswers();

    // Select first exam answer under the new filtering rules
    if (this.$('.active').length === 0) {
      this.$('.exam-answer').eq(0).click();
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

  // Returns `examAnswers` that match the user's filter.
  applyFilters: function() {
    var examAnswers = this.examAnswers.toJSON();
    var numAssigned = 0;
    var numUnassigned = 0;
    var self = this;

    var filteredExamAnswers = examAnswers.filter(function(examAnswer) {
      if (examAnswer.courseUser) {
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
    return filteredExamAnswers;
  },

  changeExamAnswer: function(event) {
    event.preventDefault();
    var $currentTarget = $(event.currentTarget);

    $currentTarget.parents('ul').children('li').removeClass('active');
    $currentTarget.parents('li').addClass('active');

    var examAnswerId = $currentTarget.data('exam-answer-id');
    var self = this;

    // Find the new examAnswer, set it to current and display it
    this.examAnswers.forEach(function(examAnswer) {
      if (examAnswer.id === examAnswerId) {
        var examAnswerObject = examAnswer.toJSON();
        self.showExamAnswer(examAnswerObject);
        self.currentExamAnswer = examAnswer;
      }
    });
  },

  assignExamAnswerToStudent: function(courseUser) {
    var unassignedId;
    var currentExamAnswer = this.currentExamAnswer.toJSON();

    // If this examAnswer was previously assigned to some other student,
    // that student no longer has any exams assigned to him, so we set the
    // unassignedId to his id and return it to the parent view
    if (currentExamAnswer.courseUser != courseUser) {
      unassignedId = currentExamAnswer.courseUser;
    }
    var self = this;
    // Save the current exam answer with the correct `courseUser`
    this.currentExamAnswer.save({
      courseUser: courseUser
    }, {
      success: function() {
        // 1. User is filtering by unassigned. ExamAnswer is assigned so no element
        // is active once we render, so it needs to be done before self.renderExamAnswers()
        if (self.isShowUnassignedChecked && !self.isShowAssignedChecked) {
          self.$('.active').next().find('a').click();
        }
        self.renderExamAnswers();

        // 2. User is filtering by assigned. ExamAnswer 1 was assigned to X and ExamAnswer 2
        // was assigned to Y. User assigns ExamAnswer 1 to Y, now ExamAnswer 2 becomes
        // unassigned so it needs to be done after self.renderExamAnswers()
        if (!self.isShowUnassignedChecked || self.isShowAssignedChecked) {
          self.$('.active').next().find('a').click();
        }
      },
      wait: true
    });

    // The current student may have been previously assigned an exam answer
    // We loop through all the exams, and see if he was previously assigned
    // If so, we remove that assignment
    this.examAnswers.forEach(function(examAnswer) {
      var examAnswerObject = examAnswer.toJSON();
      if (examAnswer.id !== currentExamAnswer.id && examAnswerObject.courseUser == courseUser) {
        examAnswer.save({
          courseUser: null
        }, {
          success: function() {
            self.renderExamAnswers();
          },
          wait: true
        });
      }
    });

    this.$studentsScroll.customScrollbar('scrollTo',
      'a[data-exam-answer-id="' + currentExamAnswer.id + '"]');

    return unassignedId;
  },

  showExamAnswer: function(examAnswer) {
    var newPath = this.basePath + examAnswer.id + '/';
    // update URL with history API; fall back to standard redirect
    if (window.history) {
      window.history.pushState(this.currentExamAnswer.toJSON(), null, newPath);
      // The URL has changed, so image loader will show the new exam
      this.examCanvasView.showPage();
      Mediator.trigger('changeExamAnswerName', examAnswer.name || '');
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
  // 1. Set active class for the correct exam answer
  // 2. Show the exam answer
  // 3. Have currentExamAnswer updated
  // 4. Trigger the mediator
  handleBackButton: function() {
    var self = this;
    // Makes the back button work by handling the popstate event.
    this.listenToDOM($(window), 'popstate', function(event) {
      var prevExamAnswer = event.originalEvent.state;
      if (!prevExamAnswer) {
        return;
      }
      self.currentExamAnswer = self.examAnswers.filter(function(examAnswer) {
        return examAnswer.id === prevExamAnswer.id;
      })[0];
      self.renderExamAnswers();
      self.examCanvasView.showPage();
    });
  }
});
