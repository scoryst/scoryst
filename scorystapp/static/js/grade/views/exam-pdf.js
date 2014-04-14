// TODO: browserify
var ExamPDFView = IdempotentView.extend({
  CIRCLE_RADIUS: 10,  // specified in style.css as radius of annotation

  events: {
    'click img': 'createAnnotation'
  },

  // TODO: comments
  initialize: function(options) {
    this.constructor.__super__.initialize.apply(this, arguments);
    this.questionPartAnswers = options.questionPartAnswers;

    this.examCanvasGradeView = new ExamCanvasGradeView({
      questionPartAnswer: this.model,
      questionPartAnswers: this.questionPartAnswers,
      preloadOtherStudentExams: 2,
      preloadCurExam: 2,
      el: '.exam'
    });

    this.registerSubview(this.examCanvasGradeView);
    this.listenTo(this.examCanvasGradeView, 'changeExamPage', this.changeExamPage);

    this.annotationViews = [];
    this.renderAnnotations();
  },

  renderAnnotations: function() {
    // before rendering, remove all the old views.
    var self = this;
    this.annotationViews.forEach(function(annotationView) {
      self.deregisterSubview(annotationView);
    });

    var curPageNum = this.examCanvasGradeView.getCurPageNum();
    this.annotationViews = [];
    this.fetchAnnotations(this.model, curPageNum, function(annotations) {
      self.annotations = annotations;
      annotations.forEach(function(annotation) {
        var annotationView = new AnnotationView({
          questionPartAnswer: self.model,
          model: annotation,
          curPageNumber: curPageNum
        });

        self.$el.children('.exam-canvas').prepend(annotationView.render().$el);
        self.registerSubview(annotationView);

        self.annotationViews.push(annotationView)
      });
    });
  },

  createAnnotation: function(event) {
    if (Utils.IS_STUDENT_VIEW) {
      return;
    }
    var $target = $(event.target);

    // getting the X and Y relative to exam PDF
    var examPDFX = event.offsetX;
    var examPDFY = event.offsetY;

    // check to ensure that the circle is within the canvas
    var minX = this.CIRCLE_RADIUS;
    if (examPDFX < minX || examPDFY < this.CIRCLE_RADIUS ||
        examPDFX > this.$el.width() - minX ||
        examPDFY > this.$el.height() - this.CIRCLE_RADIUS) {
      return;
    }

    // go through all annotations, and if any have never been saved,
    // remove them from the canvas
    var comment;
    for (var i = 0; i < this.annotationViews.length; i++) {
      var annotationView = this.annotationViews[i];
      // returns the comment in the unsaved comment; if the comment is unsaved,
      // or if the view has been previously saved, return undefined
      var commentIfUnsaved = annotationView.deleteIfUnsaved();
      if (commentIfUnsaved) {
        comment = commentIfUnsaved;
      }
    }

    var annotation = new AnnotationModel({
      questionPartAnswer: this.model.id,
      examPageNumber: this.examCanvasGradeView.getCurPageNum(),
      offsetLeft: examPDFX - this.CIRCLE_RADIUS,
      offsetTop: examPDFY - this.CIRCLE_RADIUS
    });

    this.annotations.add(annotation);

    var annotationView = new AnnotationView({
      model: annotation,
      unsavedComment: commentIfUnsaved
    });

    this.annotationViews.push(annotationView);

    var annotationEl = annotationView.render().$el;
    this.$el.children('.exam-canvas').prepend(annotationEl);
    annotationEl.find('textarea').focus();
    this.registerSubview(annotationView);
  },

  fetchAnnotations: function(questionPartAnswer, curPageNum, callback) {
    var annotations = new AnnotationCollection({}, {
      questionPartAnswer: questionPartAnswer,
      examPageNumber: curPageNum
    });

    annotations.fetch({
      success: function() {
        callback(annotations);
      }
    });
  },

  changeExamPage: function(curPageNum, questionPartAnswer) {
    this.model = questionPartAnswer;
    this.renderAnnotations();
  }
});
