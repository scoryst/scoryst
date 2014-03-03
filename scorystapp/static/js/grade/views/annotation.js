// TODO: browserify
var AnnotationView = IdempotentView.extend({
  /* How long to display the comment success icon. */
  ANNOTATION_SUCCESS_DISPLAY_DURATION: 1000,

  template: Handlebars.compile($('.annotation-template').html()),

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
    this.$el.css('top', annotation.offset_top - 10 + 'px');
    this.$el.css('left', annotation.offset_left - 10 + 'px');
    var self = this;

    // Add unsaved comment from previous annotation, if any.
    if (this.unsavedComment) {
      this.$el.find('textarea').val(this.unsavedComment);
    }

    // Make the annotation draggable.
    this.$el.draggable({
      containment: '.exam-canvas',

      // When the annotation has stopped being dragged, save new coordinates.
      stop: function(event, annotation) {
        // If the model has not been saved previously, don't save now.
        if (self.model.isNew()) {
          return;
        }

        // TODO: Success / error functions for saving offset?
        self.model.save({
          // Add 10 because of padding.
          offset_top: parseFloat(self.$el.css('top')) + 10,
          offset_left: parseFloat(self.$el.css('left')) + 10
        }, {});

        // Reopen the annotation.
        self.toggleAnnotation();
      }
    });

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

    console.log(this.model);
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
    this.model.destroy({ wait: true });
    this.removeSideEffects();
    this.remove();
  },

  removeSideEffects: function() {
    this.constructor.__super__.initialize.apply(this, arguments);
    this.remove();
  }
});
