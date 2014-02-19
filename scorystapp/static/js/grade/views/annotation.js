// TODO: browserify
var AnnotationView = IdempotentView.extend({
  /* How long to display the comment success icon. */
  ANNOTATION_SUCCESS_DISPLAY_DURATION: 1000,
  CIRCLE_RADIUS: 10,  // Specified in style.css

  template: Handlebars.compile($('.annotation-template').html()),

  events: {
    'click': 'createAnnotation',
    'click .annotation-circle': 'toggleAnnotation',
    'click .close': 'closeAnnotation',
    'click .save': 'saveAnnotation',
    'click .edit': 'editAnnotation',
    'click .delete': 'deleteAnnotation'
  },

  // TODO: comments
  initialize: function(options) {
    this.constructor.__super__.initialize.apply(this, arguments);

    console.log('Initialized annotation view');
    this.annotations = options.annotations;
    this.curPageNum = options.curPageNum;
    this.questionPartAnswer = options.questionPartAnswer;

    this.render();
  },

  render: function() {
    var self = this;
    this.annotations.forEach(function(annotation) {
      console.log('Adding annotation to the canvas');
      self.addAnnotationToCanvas(annotation.attributes.left_offset,
        annotation.attributes.top_offset, annotation.attributes.comment, false);
    });
  },

  addAnnotationToCanvas: function(leftOffset, topOffset, comment, isNew) {
    // First close all other annotations.
    $('.annotation-comment').hide();

    var $newAnnotation = $(this.template());
    $newAnnotation.draggable({
      containment: '.exam-canvas',
      stop: function(event, annotation) {
        console.log(annotation.offset);
      }
    });
    $newAnnotation.offset({
      left: leftOffset,
      top: topOffset
    });

    $newAnnotation.find('textarea').val(comment);
    $('.exam-canvas').append($newAnnotation);

    if (isNew) {
      $newAnnotation.find('textarea').focus();
    } else {
      $newAnnotation.attr('disabled', 'disabled');

      $newAnnotation.find('.annotation-comment').hide();
    }
  },

  createAnnotation: function(event) {
    event.preventDefault();

    $target = $(event.target);
    if ($target.is('.annotation') || $target.parents('.annotation').length > 0) {
      return;
    }

    $examCanvas = $('.exam-canvas');
    var parentOffset = $examCanvas.offset();
    var absoluteX = event.pageX - parentOffset.left;
    var absoluteY = event.pageY - parentOffset.top;

    // Check to ensure that the circle is within the canvas
    if (absoluteX < this.CIRCLE_RADIUS || absoluteY < this.CIRCLE_RADIUS ||
      absoluteX > $examCanvas.width() - this.CIRCLE_RADIUS ||
      absoluteY > $examCanvas.height() - this.CIRCLE_RADIUS) {
      return;
    }

    console.log('Clicked: ' + absoluteX + ', ' + absoluteY);   // TODO: Remove

    this.addAnnotationToCanvas(absoluteX - this.CIRCLE_RADIUS,
      (absoluteY - this.CIRCLE_RADIUS) - $examCanvas.height(), '', true);
  },

  closeAnnotation: function(event) {
    event.preventDefault();

    console.log('Clicked exit annotation.');

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
    event.preventDefault();

    console.log('Clicked show annotation');

    $target = $(event.target);
    $target.next().toggle();
  },

  saveAnnotation: function(event) {
    event.preventDefault();

    console.log('Clicked save annotation');

    var $target = $(event.target);
    var $textarea = $target.siblings('textarea');

    if ($textarea.val().length == 0) {
      return;
    }

    var self = this;
    var $annotation = $target.parents('.annotation');
    var annotation = new AnnotationModel({
      question_part_answer: self.questionPartAnswer.id,
      exam_page_number: self.curPageNum,
      comment: $textarea.val(),
      top_offset: parseFloat($annotation.css('top')),
      left_offset: parseFloat($annotation.css('left'))
    });

    this.annotations.add(annotation);

    annotation.save({}, {
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

  editAnnotation: function(event) {
    console.log('Clicked edit annotation');

    var $target = $(event.target);
    $target.text('Save');
    $target.removeClass('edit').addClass('save');
    $target.siblings('textarea').removeAttr('disabled');
  },

  deleteAnnotation: function(event) {
    console.log('Clicked delete annotation');

    $target = $(event.target);
    $target.parents('.annotation').remove();

  }
});