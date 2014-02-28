// TODO: browserify
var AnnotationView = IdempotentView.extend({
  /* How long to display the comment success icon. */
  ANNOTATION_SUCCESS_DISPLAY_DURATION: 1000,

  template: Handlebars.compile($('.annotation-template').html()),

  events: {
    'click .annotation-circle': 'toggleAnnotation',
    'click .close': 'closeAnnotation',
    'click .save': 'saveComment',
    'click .edit': 'editComment',
    'click .delete': 'delete'
  },

  // TODO: comments
  initialize: function(options) {
    this.constructor.__super__.initialize.apply(this, arguments);
    this.model = options.model;
    this.render();
  },

  render: function() {
    var annotation = this.model.toJSON();
    this.$el.html(this.template(annotation));
    this.$el.addClass('annotation');
    this.$el.css('top', annotation.top_offset + 'px');
    this.$el.css('left', annotation.left_offset + 'px');
    var self = this;

    // Make the annotation draggable.
    this.$el.draggable({
      containment: '.exam-canvas',

      // When the annotation has stopped being dragged, save new coordinates.
      stop: function(event, annotation) {
        var topOffset = parseFloat(self.$el.css('top'));
        var leftOffset = parseFloat(self.$el.css('left'));

        // TODO: Success / error functions for saving offset?
        self.model.save({
          top_offset: topOffset,
          left_offset: leftOffset
        }, {});

        // Reopen the annotation.
        self.toggleAnnotation();
      }
    });

    return this;
  },

  closeAnnotation: function(event) {
    var $target = $(event.target);
    var $annotation = $target.parents('.annotation');

    // If the value in the comment box is nothing, delete the annotation
    // completely. Otherwise, just hide the comment box.
    if ($annotation.find('textarea').val().length > 0) {
      $annotation.find('.annotation-comment').hide();
    } else {
      $annotation.remove();      
    }
  },

  toggleAnnotation: function(event) {
    this.$el.find('.annotation-comment').toggle();
  },

  saveComment: function(event) {
    var $target = $(event.target);
    var $textarea = $target.siblings('textarea');

    if ($textarea.val().length == 0) {
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

        setTimeout(function() {
          $annotationSuccessIcon.hide();
        }, self.ANNOTATION_SUCCESS_DISPLAY_DURATION);
      }
    });
  },

  editComment: function(event) {
    var $target = $(event.target);
    $target.text('Save');
    $target.removeClass('edit').addClass('save');
    $target.siblings('textarea').removeAttr('disabled').focus();
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