// TODO: browserify
var AnnotationView = IdempotentView.extend({
  /* How long to display the comment success icon. */
  ANNOTATION_SUCCESS_DISPLAY_DURATION: 1000,

  template: _.template($('.annotation-template').html()),

  events: {
    'click .annotation-circle-container': 'toggleAnnotation',
    'click .close': 'toggleAnnotation',
    'click .save': 'saveComment',
    'click .edit': 'editComment',
    'click .delete': 'delete',
  },

  // TODO: comments
  initialize: function(options) {
    this.constructor.__super__.initialize.apply(this, arguments);
    this.model = options.model;
    this.unsavedComment = options.unsavedComment;
    this.render();
  },

  render: function() {
    var annotation = this.model.toJSON();
    this.$el.html(this.template(annotation));
    this.$el.addClass('annotation');
    // Subtract 10 because of padding.
    this.$el.css('top', annotation.offsetTop - 10 + 'px');
    this.$el.css('left', annotation.offsetLeft - 10 + 'px');
    var self = this;

    // Add unsaved comment from previous annotation, if any.
    if (this.unsavedComment) {
      this.$el.find('textarea').val(this.unsavedComment);
    }

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

  saveComment: function(event) {
    var $target = $(event.currentTarget);
    var $textarea = $target.siblings('textarea');

    // If an empty string or all spaces, do not allow comment to be saved.
    if ($.trim($textarea.val()).length == 0) {
      return;
    }

    var self = this;

    this.model.save({
      comment: $textarea.val()
    }, {
      wait: true,

      success: function() {
        $textarea.attr('disabled', 'disabled');
        $target.text('Edit');
        $target.removeClass('save').addClass('edit');
        var $annotationSuccessIcon = $target.siblings('.annotation-success');
        $annotationSuccessIcon.show();

        // Show green checkmark to indicate successful save.
        setTimeout(function() {
          $annotationSuccessIcon.hide();
        }, self.ANNOTATION_SUCCESS_DISPLAY_DURATION);
      }
    });
  },

  editComment: function(event) {
    var $target = $(event.currentTarget);
    $target.text('Save');
    $target.removeClass('edit').addClass('save');
    $target.siblings('textarea').removeAttr('disabled').focus();
  },

  deleteIfUnsaved: function() {
    var unsavedComment = this.$el.find('textarea').val();
    if (this.model.isNew()) {
      this.delete();
      return unsavedComment;
    }
    return undefined;
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
  }
});
