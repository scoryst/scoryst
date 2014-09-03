var AssessmentFormView = IdempotentView.extend({
  PAGES_REGEX: /^\d+\s*(,\s*\d+\s*)*$/,
  INTEGER_REGEX: /^\d+$/,
  FLOAT_REGEX: /^\d+(\.\d+)?$|^\.\d+$/,
  BLANK_STRING_REGEX: /^\s*$/,
  UTC_PST_OFFSET: 7 * 60000,

  events: {
    'change input[name="assessment_type"]:checked': 'showHomeworkOrExam',
    'keydown .num-questions': 'updateNumQuestions',
    'click button.submit': 'submit',
    'click .show-file-upload': 'showFileUpload',
    'change .soft-deadline': 'softDeadlineChanged'
  },

  templates: {
    questionFormTemplate: _.template($('.question-form-template').html()),
    partFormTemplate: _.template($('.part-form-template').html())
  },

  initialize: function(options) {
    this.constructor.__super__.initialize.apply(this, arguments);

    // this would be undefined if the user is not editing an assessment
    this.assessment = options.assessment;
    this.isExam = false;
    this.timezoneString = options.timezoneString;

    this.$homeworkFields = this.$('.homework-fields');
    this.$examFields = this.$('.exam-fields');
    this.$nameField = this.$('#id_name');
    this.$numQuestionsField = this.$('.num-questions');
    this.$numQuestionsError = this.$('.num-questions-error');
    this.$questionsForm = this.$('.questions-form');
    this.$softDeadlineFormGroup = this.$('.soft-deadline');
    this.$hardDeadlineFormGroup = this.$('.hard-deadline');

    // popover gives information what soft/hard deadline is
    var deadlinePopoverText = 'Soft deadline is the last day students can submit their homework ' +
    'without penalty. Hard deadline is the last day Scoryst will accept submissions. If the ' +
    'homework is submitted after the soft deadline, we record the number of days (rounded up) ' +
    'that the homework was late.';
    var $deadlinePopover = this.$el.find('.deadline-popover');
    $deadlinePopover.popover({ content: deadlinePopoverText });

    var icons = {
      time: "fa fa-clock-o",
      date: "fa fa-calendar",
      up: "fa fa-arrow-up",
      down: "fa fa-arrow-down"
    };

    this.$softDeadlineFormGroup.datetimepicker({ icons: icons });
    this.$hardDeadlineFormGroup.datetimepicker({ icons: icons });

    // if editing an assessment, populate the fields with the saved values
    if (this.assessment) {
      this.isFullyEditable = this.assessment.get('isFullyEditable');

      this.questionParts = new QuestionPartCollection();
      var self = this;
      this.questionParts.fetch({
        success: function() {
          self.populateFields();

          // debounce the num parts, points, and pages inputs. this is required
          // because otherwise updates do not necessarily show if the user
          // enters in values in different inputs very quickly.
          self.$('.num-parts').each(function(i, numParts) {
            $(numParts).on('keydown', _.bind(_.debounce(self.updateNumParts, 500), self));
          });

          self.$('.points').each(function(i, points) {
            $(points).on('keydown', _.bind(_.debounce(self.validatePoints, 500), self));
          });

          self.$('.pages').each(function(i, points) {
            $(points).on('keydown', _.bind(_.debounce(self.validatePages, 500), self));
          });

          if (!self.isFullyEditable) {
            self.showPartialEditing();
          }
        }
      });
    } else {
      // the exam PDF and solutions PDF inputs are hidden initially because they
      // are not shown when editing an assessment and a PDF has been uploaded;
      // if not editing, show all file inputs
      this.$('input[type="file"]').show();
    }

    this.addGradeTypePopover();
    window.resizeNav();
  },

  softDeadlineChanged: function(event) {
    // When the soft deadline is changed, update the hard deadline to the same value
    var softDeadlineDate = this.$softDeadlineFormGroup.find('input').val();
    this.$hardDeadlineFormGroup.find('input').val(softDeadlineDate);
  },

  showHomeworkOrExam: function(event) {
    $currentTarget = $(event.currentTarget);
    if ($currentTarget.val() === 'homework') {
      this.showHomeworkFields();
    } else {
      this.showExamFields();
    }
  },

  showHomeworkFields: function() {
    this.$questionsForm.html('');
    this.$numQuestionsField.val('');

    this.isExam = false;
    this.$homeworkFields.show();
    this.$examFields.hide();
    this.$nameField.attr('placeholder', 'Problem Set 1');
  },

  showExamFields: function() {
    this.$questionsForm.html('');
    this.$numQuestionsField.val('');

    this.isExam = true;
    this.$homeworkFields.hide();
    this.$examFields.show();
    this.$nameField.attr('placeholder', 'Midterm Exam');
  },

  addGradeTypePopover: function() {
    var infoPopoverText = 'If grading down, assessments have perfect scores' +
      ' initially, and each rubric deducts points from the total score. If' +
      ' grading up, assessments have 0 points awarded initially, and each rubric' +
      ' awards points to the total score.';

    var $infoPopover = this.$('.info-popover');
    $infoPopover.popover({ content: infoPopoverText });
  },

  updateNumQuestions: _.debounce(function(event) {
    // validate the number that the user entered
    var numQuestionsStr = this.$numQuestionsField.val();
    var numQuestions = parseInt(numQuestionsStr, 10);
    if (!this.INTEGER_REGEX.test(numQuestionsStr) || numQuestions <= 0) {
      this.$numQuestionsError.show();
      return;
    }

    this.$numQuestionsError.hide();

    // now, add question fields to match the number of questions entered
    var curNumQuestions = this.$questionsForm.find('.question').length;

    // if number of parts has increased, add the difference
    for (var i = curNumQuestions; i < numQuestions; i++) {
      var $newQuestion = $(this.templates.questionFormTemplate({ questionNum: i + 1 }));
      this.$questionsForm.append($newQuestion);
      //
      $newQuestion.find('.num-parts').on('keydown',
        _.bind(_.debounce(this.updateNumParts, 500), this));
    }

    // if number of questions has decreased, remove the difference
    for (var i = curNumQuestions; i > numQuestions; i--) {
      this.$questionsForm.find('.question').last().remove();
    }

    window.resizeNav();
  }, 500),

  updateNumParts: function(event) {
    var $numPartsField = $(event.currentTarget);

    // validate the number of parts that the user entered
    var numPartsStr = $numPartsField.val();
    var numParts = parseInt(numPartsStr, 10);
    if (!this.INTEGER_REGEX.test(numPartsStr) || numParts <= 0) {
      $numPartsField.siblings('.num-parts-error').show();
      return;
    }

    $numPartsField.siblings('.num-parts-error').hide();

    // now, add the point (and pages, if exam) fields to match the number of parts entered
    var curNumParts = $numPartsField.siblings('.parts-form').find('.part').length;

    // if number of parts has increased, add the difference
    for (var i = curNumParts; i < numParts; i++) {
      var $partForm = $(this.templates.partFormTemplate({
        partNum: i + 1,
        isExam: this.isExam
      }));
      $numPartsField.siblings('.parts-form').append($partForm);

      // find the new input fields to validation events
      $partForm.find('.points').on('keydown',
        _.bind(_.debounce(this.validatePoints, 500), this));
      if (this.isExam) {
        $partForm.find('.pages').on('keydown',
          _.bind(_.debounce(this.validatePages, 500), this));
      }
    }

    // if number of parts has decreased, remove the difference
    for (var i = curNumParts; i > numParts; i--) {
      $numPartsField.siblings('.parts-form').find('.part').last().remove();
    }

    window.resizeNav();
  },

  validatePoints: function(event) {
    var $pointsField = $(event.currentTarget);

    var pointsStr = $pointsField.val();
    var points = parseFloat(pointsStr);
    if (!this.FLOAT_REGEX.test(pointsStr) || points < 0) {
      $pointsField.siblings('.points-error').show();
    } else {
      $pointsField.siblings('.points-error').hide();
    }
  },

  validateFields: function() {
    var passedValidation = true;

    // validate that a name that is not all spaces is entered
    if (!this.BLANK_STRING_REGEX.test(this.$nameField.val())) {
      this.$('.name-error').hide();
    } else {
      this.$('.name-error').show();
      passedValidation = false;
    }

    // if is exam and creating a new exam, validate that exam PDF has been uploaded
    if (this.isExam) {
      if (this.$('#id_exam_file').val() || this.assessment) {
        this.$('.exam-file-error').hide();
      } else {
        this.$('.exam-file-error').show();
        passedValidation = false;
      }
    } else {
      // if homework, validate that soft/hard deadline are entered and that they
      // are in the future
      // If the validation succeeds, the deadline datetime will be returned
      // If it fails, false will be returned.
      var softDeadline = this.validateDeadline(this.$('#id_soft_deadline'),
        this.$('.soft-deadline-error'));

      var hardDeadline = this.validateDeadline(this.$('#id_hard_deadline'),
        this.$('.hard-deadline-error'));

      if (softDeadline === false || hardDeadline === false) {
        passedValidation = false;
      }

      if (softDeadline && hardDeadline && softDeadline > hardDeadline) {
        this.$('.hard-deadline-error').show();
        passedValidation = false;
      }
    }

    // validate that the number of questions has been entered; don't need to
    // show error messages because `updateNumQuestions` does that already
    if (!this.$numQuestionsField.val()) {
      passedValidation = false;
      this.$numQuestionsError.show();
    }

    // validate that the number of parts has been entered; don't need to show
    // error messages because `updateNumParts` does that already
    var $numPartsInputs = this.$('.num-parts');
    $numPartsInputs.each(function(i, numParts) {
      var $numParts = $(numParts);
      if (!$numParts.val()) {
        $numParts.siblings('.num-parts-error').show();
        passedValidation = false;
      }
    });

    // validate that the number of points has been entered; don't need to show
    // error messages because `validatePoints` does that already
    var $allPoints = this.$('.points');
    $allPoints.each(function(i, points) {
      var $points = $(points);
      if (!$points.val()) {
        $points.siblings('.points-error').show();
        passedValidation = false;
      }
    });

    // if exam, validate that the pages have been entered; don't need to show
    // error messages because `validatePages` does that already
    if (this.isExam) {
      var $allPages = this.$('.pages');
      $allPages.each(function(i, pages) {
        var $pages = $(pages);
        if (!$pages.val()) {
          $pages.siblings('.pages-error').show();
          passedValidation = false;
        }
      });
    }

    // finally, validate that there are no existing errors displayed on the page
    var $errors = this.$('.error');
    $errors.each(function(i, error) {
      if ($(error).css('display') !== 'none') {
        passedValidation = false;
      }
    });

    return passedValidation;
  },

  validateDeadline: function($selector, $errorSelector) {
    // Validates that
    // 1. the deadline is provided
    // 2. the deadline is a valid date in the future
    // Returns the deadline if successful, false otherwise
    var deadlineIsValid = true;
    var submissionString = $selector.val();

    if (!submissionString) {
      deadlineIsValid = false;
    }

    var curTime = (new Date).getTime();
    var userEnteredTime = moment.tz(submissionString, this.timezoneString);
    if (userEnteredTime._d === 'Invalid date') {
      deadlineIsValid = false;
    } else {
      if (userEnteredTime < curTime) {
        deadlineIsValid = false;
      }
    }

    // having a past submission deadline is okay if there are already submissions
    if (deadlineIsValid || this.isFullyEditable === false) {
      $errorSelector.hide();
      return userEnteredTime;
    } else {
      $errorSelector.show();
      return false;
    }
  },

  submit: function() {
    var passedValidation = this.validateFields();
    if (!passedValidation) {
      return;
    }

    // the last thing to do before submission is to add the points in JSON
    // representation to the hidden input field
    var assessmentInfo = [];
    var $questions = this.$('.question');
    var self = this;

    // iterate over questions
    $questions.each(function(i, question) {
      var questionNum = i + 1;
      var $allPoints = $(question).find('.points');

      var questionPartInfo = [];

      // iterate over parts
      $allPoints.each(function(j, points) {
        var partNum = j + 1;
        var pointsStr = $(points).val();
        var pointsFloat = parseFloat(pointsStr);

        // add values to the part array
        if (self.isExam) {
          var pages = $(points).siblings('.pages').val();
          questionPartInfo.push([pointsFloat, pages]);
        } else {
          questionPartInfo.push(pointsFloat);
        }
      });

      // add part array to the overall array
      assessmentInfo.push(questionPartInfo);
    });

    this.$('#id_question_part_points').val(JSON.stringify(assessmentInfo));
    this.$('form').submit();
  },

  validatePages: function(event) {
    $pages = $(event.currentTarget);
    var pagesStr = $pages.val();

    if (!pagesStr || !this.PAGES_REGEX.test(pagesStr)) {
      $pages.siblings('.pages-error').show();
      return;
    }

    // convert CSV of pages to array of integers by first getting rid of the
    // whitespaces, then spltting by commas, so that '1,2,3' becomes ['1', '2', '3']
    // using map, these are then converted to integers to finally get [1,2,3]
    var pages = pagesStr.replace(' ', '').split(',').map(function(page) {
      return parseInt(page, 10);
    });

    // ensure that all of the pages are valid integers; if not, show error
    pages.forEach(function(page) {
      if (isNaN(page) || page <= 0) {
        $pages.siblings('.pages-error').show();
      }
    })

    $pages.siblings('.pages-error').hide();
  },

  populateFields: function() {
    this.isExam = this.assessment.get('isExam');

    if (this.isExam) {
      this.$('#id_assessment_type_1').click();
      this.showExamFields();
    }

    // hide the homework/exam type radio buttons; the assessment type cannot
    // be changed after creation
    this.$('.assessment-type-radio').hide();

    this.$nameField.val(this.assessment.get('name'));

    // select correct grade up/down option; change to grade down (up is default)
    if (!this.assessment.get('gradeDown')) {
      this.$('#id_grade_type_1').prop('checked', true);
    }

    // populate remaining static form fields
    if (this.isExam) {
      this.$('.exam-file-help .exam-pdf').attr('href', this.assessment.get('examPdf'));
      this.$('.exam-file-help').show();
    } else {
      var softDeadline = this.assessment.get('softDeadline');
      this.$('#id_soft_deadline').val(softDeadline);
      this.$softDeadlineFormGroup.data('DateTimePicker').setDate(new Date(softDeadline));

      var hardDeadline = this.assessment.get('hardDeadline');
      this.$('#id_hard_deadline').val(hardDeadline);
      this.$hardDeadlineFormGroup.data('DateTimePicker').setDate(new Date(hardDeadline));
    }

    if (this.assessment.get('solutionsPdf')) {
      this.$('.solutions-file-help .solutions-pdf').attr(
        'href', this.assessment.get('solutionsPdf'));
      this.$('.solutions-file-help').show();
    } else {
      this.$('#id_solutions_file').show();
    }

    // populate the dynamic form fields (question part info). first, populate
    // the `questionPartInfo` array that contains information about the points
    // (and pages, if `isExam`), grouped by the parts. ex: [[5, 10], [5]] is an
    // assessment that has two parts for question 1, worth 5 points and 10
    // points, and one part for question 2 worth 5 points
    var questionPartInfo = [];
    var partsInfo = [];
    var questionNum = 1;
    var partNum = 1;
    var self = this;
    this.questionParts.forEach(function(questionPart) {
      // new question has been added, so add parts of previous question
      if (questionPart.get('questionNumber') > questionNum) {
        questionPartInfo.push(partsInfo);
        questionNum += 1;
        partsInfo = [];
      }

      // add part
      if (self.isExam) {
        partsInfo.push([questionPart.get('maxPoints'), questionPart.get('pages')]);
      } else {
        partsInfo.push(questionPart.get('maxPoints'));
      }

      // if final question part, need to add the part info
      if (self.questionParts.last() === questionPart) {
        questionPartInfo.push(partsInfo);
      }
    });

    // fill in the number of questions
    this.$numQuestionsField.val(questionPartInfo.length);

    // iterate over questions; for each question, fill in number of parts
    questionPartInfo.forEach(function(partsInfo, i) {
      var $question = $(self.templates.questionFormTemplate({ questionNum: i + 1 }));
      $question.find('.num-parts').val(partsInfo.length);

      // iterate over parts; for each part, fill in points (and pages, if exam)
      partsInfo.forEach(function(partInfo, j) {
        var $part = $(self.templates.partFormTemplate({
          partNum: j + 1,
          isExam: self.isExam
        }));

        if (self.isExam) {
          $part.find('.points').val(partInfo[0]);
          $part.find('.pages').val(partInfo[1]);
        } else {
          $part.find('.points').val(partInfo);
        }

        $question.find('.parts-form').append($part);
      });
      self.$questionsForm.append($question);
    });
  },

  showFileUpload: function(event) {
    // hides the message and shows the file upload field
    event.preventDefault();
    $viewUploadFieldLink = $(event.currentTarget);
    $viewUploadFieldLink.parent().hide();
    $viewUploadFieldLink.parent().siblings('input').show();
  },

  showPartialEditing: function() {
    this.$numQuestionsField.attr('disabled', true);
    this.$('.num-parts').attr('disabled', true);
    this.$('.assessment-type').attr('disabled', true);
    if (this.isExam) {
      this.$('.partially-editable-exam').show();
    } else {
      this.$('.partially-editable-homework').show();
    }
  }
});
