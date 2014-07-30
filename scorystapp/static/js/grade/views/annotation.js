// TODO: browserify
var AnnotationView = IdempotentView.extend({
  /* How long to display the comment success icon. */
  ANNOTATION_SUCCESS_DISPLAY_DURATION: 1000,

  templates: {
    annotationTemplate: _.template($('.annotation-template').html()),
    successTemplate: _.template($('.annotation-success-template').html())
  },

  events: {
    'click .annotation-circle-container': 'toggleAnnotation',
    'click .close': 'toggleAnnotation',
    'click .annotation-hidden': 'toggleAnnotation',
    'click .delete': 'delete',
    'change .latex-checkbox': 'toggleLatexRendering',
    'click .back-to-edit': 'showTextarea',
    'click .preview': 'checkMathjaxAndRenderLatex'
  },

  // TODO: comments
  initialize: function(options) {
    this.constructor.__super__.initialize.apply(this, arguments);
    this.model = options.model;
    this.mathjaxIsLoaded = options.mathjaxIsLoaded;
  },

  render: function() {
    var annotation = this.model.toJSON();
    this.$el.html(this.templates.annotationTemplate(annotation));
    this.$el.addClass('annotation');
    // Subtract 10 because of padding.
    this.$el.css('top', annotation.offsetTop - 10 + 'px');
    this.$el.css('left', annotation.offsetLeft - 10 + 'px');

    this.$textarea = this.$('textarea');
    this.$textarea.on('paste keyup', _.bind(this.saveComment, this));
    this.$textarea.on('paste keyup', _.bind(this.clearSuccess, this));
    this.$annotationSuccess = this.$('.annotation-success');

    this.$latexCheckbox = this.$('.latex-checkbox');
    this.$latexForm = this.$('.latex-form');
    this.$renderedLatex = this.$('.rendered-latex');
    this.$editLatexButton = this.$('.back-to-edit');
    this.$previewLatexIcon = this.$('.preview');

    var self = this;

    // Make the annotation draggable.
    if (!Utils.IS_STUDENT_VIEW) {
      this.$el.draggable({
        containment: 'parent',

        // When the annotation has stopped being dragged, save new coordinates.
        stop: function(event, annotation) {
          // If the model has not been saved previously, don't save now.
          if (self.model.isNew()) {
            return;
          }

          // TODO: Success / error functions for saving offset?
          self.model.save({
            // Add 10 because of padding.
            offsetTop: parseFloat(self.$el.css('top')) + 10,
            offsetLeft: parseFloat(self.$el.css('left')) + 10
          }, {});

          // Reopen the annotation.
          self.toggleAnnotation();
        }
      });
    }

    return this;
  },

  toggleAnnotation: function(event) {
    this.$('.annotation-comment').toggle();
    this.$('.annotation-hidden').toggle();
  },

  saveComment: _.debounce(function(event) {
    var self = this;
    var comment = $.trim(this.$textarea.val());
    // If there is no change to the comment value, then ignore
    if (comment === this.model.get('comment')) {
      return;
    }

    // If an empty string or all spaces, destroy the model but keep the view.
    // This is because when there is a previously saved annotation and the user
    // deletes the entire comment, the annotation is deleted in the backend but
    // the annotation view remains on the frontend.
    if (comment.length === 0) {
      var collection = this.model.collection;
      var newModel = new AnnotationModel({
        assessmentPageNumber: this.model.get('assessmentPageNumber'),
        offsetLeft: this.model.get('offsetLeft'),
        offsetTop: this.model.get('offsetTop')
      });

      this.model.destroy({
        success: function() {
          self.model = newModel;
          collection.add(newModel);
          self.showSuccessfulSave();
        }
      });
      return;
    }

    // If the comment is valid, save new comment/annotation to the database
    else {
      this.model.save({ comment: comment }, {
        wait: true,

        success: function() {
          self.showSuccessfulSave();
        }
      });
    }
  }, 600),

  deleteIfBlank: function() {
    if ($.trim(this.$textarea.val()).length === 0) {
      this.delete();
      return true;
    }
    return false;
  },

  delete: function(event) {
    var self = this;
    this.model.destroy({
      success: function() {
        self.removeSideEffects();
        self.remove();
      }
    });
  },

  removeSideEffects: function() {
    // Extend removeSideEffects from the Idempotent view.
    this.constructor.__super__.removeSideEffects.apply(this, arguments);
    this.remove();
  },

  clearSuccess: function() {
    // If there is no change to the comment value, then ignore
    var comment = $.trim(this.$textarea.val());
    if (comment === this.model.get('comment')) {
      return;
    }

    this.$annotationSuccess.html('');
  },

  showSuccessfulSave: _.debounce(function() {
    this.$annotationSuccess.html(this.templates.successTemplate());

    var self = this;

    setTimeout(function() {
      self.$annotationSuccess.find('.saved').hide();
    }, self.ANNOTATION_SUCCESS_DISPLAY_DURATION);

  }, 100),

  removeAnnotationFrontClass: function() {
    this.$el.removeClass('annotation-front');
  },

  toggleLatexRendering: function() {
    var renderLatex = this.$latexCheckbox.is(':checked');
    if (renderLatex) {
      this.$previewLatexIcon.show();
    } else {
      this.$previewLatexIcon.hide();
    }

    this.model.save({ renderLatex: renderLatex }, {});
  },

  showTextarea: function() {
    this.$renderedLatex.hide();
    this.$editLatexButton.hide();

    var comment = this.model.get('comment');
    this.$textarea.val(comment);
    this.$textarea.show();
    this.$textarea.focus();
    this.$latexForm.show();
    this.$previewLatexIcon.show();

    // move the mouse cursor to the end of the comment
    var commentLength = comment.length;
    this.$textarea[0].setSelectionRange(commentLength, commentLength);
  },

  checkMathjaxAndRenderLatex: function() {
    if (this.mathjaxIsLoaded) {
      this.renderLatex();
    } else {
      this.waitingToLoadMathjax = true;
      this.trigger('loadMathjax', this);
    }
  },

  renderLatex: function() {
    this.mathjaxIsLoaded = true;
    this.waitingToLoadMathjax = false;
    this.$latexForm.hide();
    this.$textarea.hide();
    this.$previewLatexIcon.hide();

    var comment = $.trim(this.$textarea.val());
    this.$renderedLatex.text(comment);
    this.$renderedLatex.show();
    this.$editLatexButton.show();

    MathJax.Hub.Queue(['Typeset', MathJax.Hub, this.$renderedLatex[0]]);
  },

  shouldRenderLatex: function() {
    return this.waitingToLoadMathjax ||
            (Utils.IS_STUDENT_VIEW && this.model.get('renderLatex'));
  }
});
