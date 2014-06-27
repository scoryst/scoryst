// TODO: browserify
var AnnotationView = IdempotentView.extend({
  /* How long to display the comment success icon. */
  ANNOTATION_SUCCESS_DISPLAY_DURATION: 600,

  template: _.template($('.annotation-template').html()),

  events: {
    'click .annotation-circle-container': 'toggleAnnotation',
    'click .close': 'toggleAnnotation',
    'click .delete': 'delete'
  },

  // TODO: comments
  initialize: function(options) {
    this.constructor.__super__.initialize.apply(this, arguments);
    this.model = options.model;
    this.unsavedComment = options.unsavedComment;
  },

  render: function() {
    var annotation = this.model.toJSON();
    this.$el.html(this.template(annotation));
    this.$el.addClass('annotation');
    // Subtract 10 because of padding.
    this.$el.css('top', annotation.offsetTop - 10 + 'px');
    this.$el.css('left', annotation.offsetLeft - 10 + 'px');

    this.$textarea = this.$el.find('textarea');
    this.$textarea.on('paste keyup', _.bind(this.saveComment, this));
    this.$textarea.on('paste keyup', _.bind(this.clearSuccess, this));
    this.$annotationSuccess = this.$el.find('.annotation-success');

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
    this.$el.find('.annotation-comment').toggle();
  },

  saveComment: _.debounce(function(event) {
    // If an empty string or all spaces, do not allow comment to be saved.
    if ($.trim(this.$textarea.val()).length == 0) {
      return;
    }

    var self = this;

    this.model.save({
      comment: this.$textarea.val()
    }, {
      wait: true,

      success: function() {
        self.$annotationSuccess.show();
      }
    });
  }, 600),

  deleteIfBlank: function() {
    if ($.trim(this.$textarea.val()).length == 0) {
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
      },
      wait: true
    });
  },

  removeSideEffects: function() {
    // Extend removeSideEffects from the Idempotent view.
    this.constructor.__super__.removeSideEffects.apply(this, arguments);
    this.remove();
  },

  clearSuccess: function() {
    this.$annotationSuccess.hide();
  }
});
