// TODO: browserify
var ResponseModel = Backbone.Model.extend({});

var ResponseCollection = Backbone.Collection.extend({
  model: ResponseModel,
  url: function() {
    return window.location.href + this.assessmentID + '/' +
      this.courseUserID + '/response/';
  },

  sync: function(method, model, options) {
    options = options || {};
    if (method !== 'read') {
      throw 'Can only read the list of question parts.';
    }
    return Backbone.sync.apply(this, arguments);
  },

  setAssessment: function(assessmentID) {
    this.assessmentID = assessmentID;
  },

  getAssessment: function() {
    return this.assessmentID;
  },

  setCourseUserID: function(courseUserID) {
    this.courseUserID = courseUserID;
  },

  getCourseUserID: function() {
    return this.courseUserID;
  },

  // Aggregates all parts of a given question into one returned object of the
  // following form:
  //
  // {
  //   graded: graded,    // Whether the entire assessment is graded
  //   points: points,        // points scored for the entire assessment
  //   maxPoints: maxPoints,  // maximum points for the assessment
  //   questions: questions   // an array of questions
  // }
  //
  // where each question in the questions array is of the form
  //
  // {
  //   questionNumber: questionNumber,
  //   graded: true,
  //   graders: graders,
  //   points: points,
  //   maxPoints: maxPoints,
  //   parts: parts
  // }
  //
  // and each part is of the same form, except it has partNumber instead of
  // questionNumber.
  aggregateQuestions: function() {
    var responses = this.toJSON();
    var graded = true;
    var points = 0;
    var maxPoints = 0;
    var questions = [];

    var question = {
      questionNumber: 1,
      graded: true,
      graders: [],
      points: 0,
      maxPoints: 0,
      parts: []
    };

    for (var i = 0; i < responses.length; i++) {
      var curQuestionPart = responses[i];
      var questionNumber = curQuestionPart.questionPart.questionNumber;

      var part = {
        graded: curQuestionPart.graded,
        partNumber: curQuestionPart.questionPart.partNumber,
        points: curQuestionPart.points,
        maxPoints: curQuestionPart.questionPart.maxPoints,
        grader: curQuestionPart.graderName
      };

      question.parts.push(part);
      question.graded = question.graded && part.graded;
      // Aggregate points for the question
      question.points += part.points;
      question.maxPoints += part.maxPoints;

      if (question.graders.indexOf(part.grader) === -1 && part.grader) {
        question.graders.push(part.grader);
      }

      // If we're at a new question or are done, push the previous question
      // and perform necessary computations
      if (i === responses.length - 1 ||
        responses[i + 1].questionPart.questionNumber !== questionNumber) {
        points += question.points;
        maxPoints += question.maxPoints;
        graded = graded && question.graded;

        question.graders = this.joinGraders(question.graders);
        questions.push(question);

        question = {
          questionNumber: questionNumber + 1,
          graded: true,
          graders: [],
          points: 0,
          maxPoints: 0,
          parts: []
        };
      }
    }

    return {
      graded: graded,
      points: points,
      maxPoints: maxPoints,
      questions: questions
    };
  },

  // Returns the first character from every word in the string
  getInitials: function(name) {
    var matches = name.match(/\b(\w)/g);
    return matches.join('');
  },

  // Given a list of graders ['John Doe', 'Don Joe'], returns 'JD, DJ'
  // Returns the entire name if only one grader is in the list
  // Returns '' if list is empty
  joinGraders: function(graderNames) {
    if (graderNames.length == 0) return '';
    if (graderNames.length == 1) return graderNames[0];

    var joinedGraders = this.getInitials(graderNames[0]);
    for (var i = 1; i < graderNames.length; i++) {
      joinedGraders += ', ' + this.getInitials(graderNames[i]);
    }
    return joinedGraders;
  }
});
