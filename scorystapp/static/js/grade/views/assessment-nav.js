// TODO: browserify
var AssessmentNavView = IdempotentView.extend({
  LEFT_BRACKET_KEY_CODE: 219,
  RIGHT_BRACKET_KEY_CODE: 221,

  template: _.template($('.assessment-nav-template').html()),
  events: {
    'click ul a': 'triggerChangeQuestionPart',
    'click .toggle-assessment-nav': 'toggleAssessmentNav',
    'click .next-part': 'goToNextQuestionPart',
    'click .previous-part': 'goToPreviousQuestionPart'
  },

  initialize: function(options) {
    this.constructor.__super__.initialize.apply(this, arguments);
    this.responses = options.responses;

    this.listenTo(Mediator, 'changeResponse', this.changeResponse);

    var self = this;
    this.responses.each(function(response) {
      // re-render when any answer changes
      self.listenTo(response, 'change', self.render);
    });

    // events from other elements
    this.listenToDOM($(window), 'keydown', this.handleShortcuts);
  },

  /* Renders the question navigation. */
  render: function() {
    var responses = this.responses.toJSON();
    var activeResponse = this.model.toJSON();
    var lastQuestionNum = -1;

    // total assessment statistics
    var isAssessmentGraded = true;
    var assessmentMaxPoints = 0;
    var assessmentPoints = 0;

    responses.forEach(function(response) {
      var questionPart = response.questionPart;

      // mark question separators
      if (questionPart.questionNumber !== lastQuestionNum) {
        lastQuestionNum = questionPart.questionNumber;
        questionPart.startsNewQuestion = true;
      }

      // mark active question part answer
      if (response.id === activeResponse.id) {
        response.active = true;
      }

      // compute overall assessment statistics
      isAssessmentGraded = isAssessmentGraded && response.graded;
      assessmentMaxPoints += questionPart.maxPoints;

      if (response.graded) {
        assessmentPoints += response.points;
      }
    });

    var templateData = {
      isAssessmentGraded: isAssessmentGraded,
      assessmentMaxPoints: assessmentMaxPoints,
      assessmentPoints: assessmentPoints.toFixed(2).replace(/0+$/, '').replace(/\.$/, ''),
      activeResponse: activeResponse,
      responses: responses
    };
    this.$el.html(this.template(templateData));

    if (!this.getPreviousResponse()) {
      this.$('.previous-part').hide();
    }

    if (!this.getNextResponse()) {
      this.$('.next-part').hide();
    }

    window.resizeNav();
    return this;
  },

  handleShortcuts: function(event) {
    // ignore keys entered in an input/textarea
    var $target = $(event.target);
    if ($target.is('input') || $target.is('textarea')) {
      return;
    }

    switch (event.keyCode) {
      case this.LEFT_BRACKET_KEY_CODE:
        this.goToPreviousQuestionPart();
        break;

      case this.RIGHT_BRACKET_KEY_CODE:
        this.goToNextQuestionPart();
        break;
    }
  },

  goToPreviousQuestionPart: function(event) {
    // The `event` might be undefined when this function is called from
    // another function.
    if (event) {
      event.preventDefault();
    }

    var previousResponse = this.getPreviousResponse();

    if (previousResponse) {
      Mediator.trigger('changeResponse', previousResponse, -1);
    } else {
      // if that didn't work, there is no previous part, so do nothing
    }
  },

  getPreviousResponse: function() {
    var curQuestionPart = this.model.get('questionPart');
    var previousResponse;

    if (curQuestionPart.partNumber > 1) {
      // find the previous part in the current question
      previousResponse = this.responses.filter(function(response) {
        var questionPart = response.get('questionPart');
        return questionPart.questionNumber === curQuestionPart.questionNumber &&
          questionPart.partNumber === curQuestionPart.partNumber - 1;
      });

      previousResponse = previousResponse[0];
    } else {
      // if there is no previous part, find the last part in the previous question
      previousResponse = this.responses.filter(function(response) {
        var questionPart = response.get('questionPart');
        return questionPart.questionNumber === curQuestionPart.questionNumber - 1;
      });

      if (previousResponse.length > 0) {
        // narrow down to last part
        previousResponse = _.max(previousResponse, function(response) {
          return response.get('questionPart').partNumber;
        });
      } else {
        // no previous question
        previousResponse = null;
      }
    }

    return previousResponse;
  },

  goToNextQuestionPart: function(event) {
    // The `event` might be undefined when this function is called from
    // another function.
    if (event) {
      event.preventDefault();
    }

    var nextResponse = this.getNextResponse();

    if (nextResponse) {
      Mediator.trigger('changeResponse', nextResponse, 0);
    } else {
      // if that didn't work, there is no next part, so do nothing
    }
  },

  getNextResponse: function(event) {
    var curQuestionPart = this.model.get('questionPart');

    // find the next part in the current question
    var nextResponse = this.responses.filter(function(response) {
      var questionPart = response.get('questionPart');
      return questionPart.questionNumber === curQuestionPart.questionNumber &&
        questionPart.partNumber === curQuestionPart.partNumber + 1;
    });

    nextResponse = nextResponse[0];

    // if that didn't work, find the next question
    if (!nextResponse) {
      nextResponse = this.responses.filter(function(response) {
        var questionPart = response.get('questionPart');
        return questionPart.questionNumber === curQuestionPart.questionNumber + 1 &&
          questionPart.partNumber === 1;
      });

      nextResponse = nextResponse[0];
    }

    return nextResponse;
  },

  /* Triggers the changeResponse event when a part is clicked. */
  triggerChangeQuestionPart: function(event) {
    event.preventDefault();

    var responseId = $(event.currentTarget).
      attr('data-response');
    responseId = parseInt(responseId, 10);

    Mediator.trigger('changeResponse', this.responses.
      get(responseId));
  },

  /* Changes the active response. */
  changeResponse: function(response) {
    this.model = response;
    this.render();
  },

  /* Toggles the visibility of the assessment navigation. */
  toggleAssessmentNav: function() {
    this.$el.toggleClass('nav-collapsed');
  }
});
