var FreeformCanvasView = IdempotentView.extend({
  CANVAS_WIDTH: 675,
  CANVAS_HEIGHT: 873,
  DRAWING_Y_OFFSET: 20,
  ERASING_Y_OFFSET: 10,
  ANNOTATING_ICON_X_OFFSET: 5,
  ERASING_LINE_WIDTH: 20,
  DRAWING_LINE_WIDTH: 1,
  TRY_SAVING_TIMEOUT: 1000,

  events: {
    'mousedown': 'beginAnnotating',
    'mousemove': 'continueAnnotating',
    'mouseup': 'endAnnotating',
    'mouseleave': 'endAnnotating'
  },

  initialize: function(options) {
    this.assessmentPageNumber = options.assessmentPageNumber;

    // true if the correct toolbar option is selected
    this.canDraw = false;
    this.canErase = false;

    // true if the user's mouse is pressed and user can draw or can erase
    this.isAnnotating = false;

    // true if the view is waiting for a freeform annotation image to save
    this.isSaving = false;
  },

  render: function(pageNumber) {
    this.assessmentPageNumber = pageNumber;
    this.context = this.$el[0].getContext('2d');

    this.drawingGlobalCompositeOperation = this.context.globalCompositeOperation;

    this.canvas = this.$el[0];

    this.$el.prop('width', this.CANVAS_WIDTH);
    this.$el.prop('height', this.CANVAS_HEIGHT);

    // if there is a previous freeform annotation for the page, display it
    var url = window.location.href + 'assessment-page/' + pageNumber +
      '/get-freeform-annotation/';

    var drawing = new Image();
    var self = this;
    drawing.addEventListener('load', function() {
      self.context.drawImage(drawing, 0, 0);
    });
    drawing.addEventListener('error', function() {
      self.context.clearRect(0, 0, self.canvas.width, self.canvas.height);
    });
    drawing.src = url;
  },

  beginAnnotating: function(event) {
    if (this.canDraw || this.canErase) {
      this.context.beginPath();
      var x = event.offsetX + this.ANNOTATING_ICON_X_OFFSET;
      var y = event.offsetY + (this.canDraw ? this.DRAWING_Y_OFFSET : this.ERASING_Y_OFFSET);
      this.context.moveTo(x, y);
      this.isAnnotating = true;
    }
  },

  continueAnnotating: function(event) {
    if (this.isAnnotating && (this.canDraw || this.canErase)) {
      var x = event.offsetX + this.ANNOTATING_ICON_X_OFFSET;
      var y = event.offsetY + (this.canDraw ? this.DRAWING_Y_OFFSET : this.ERASING_Y_OFFSET);
      this.context.lineTo(x, y);

      if (this.canDraw) {
        this.context.globalCompositeOperation = this.drawingGlobalCompositeOperation;
        this.context.strokeStyle = '#e74c3c';  // red color
        this.context.lineWidth = this.DRAWING_LINE_WIDTH;
      } else {
        // set the context to draw transparent pixels
        this.context.globalCompositeOperation = 'destination-out';
        this.context.strokeStyle = '#000';
        this.context.lineWidth = this.ERASING_LINE_WIDTH;
      }
      this.context.stroke();
    }
  },

  endAnnotating: function() {
    if (this.isAnnotating && (this.canDraw || this.canErase)) {
      this.isAnnotating = false;

      // only one freeform annotation image can be saved to the backend at a time.
      // if there is a freeform annotation currently saving, wait to try again
      if (this.isSaving) {
        // at any point, there only one annotation save is going to try again
        if (this.oldTimeoutId) {
          clearTimeout(this.oldTimeoutId);
        }
        this.oldTimeoutId = setTimeout(_.bind(this.endAnnotating, this), this.TRY_SAVING_TIMEOUT);
        return;
      }

      this.isSaving = true;

      // Save the drawing
      var dataURL = this.$el[0].toDataURL();
      var self = this;
      $.ajax({
        type: 'POST',
        url: window.location.href + 'assessment-page/' +
             this.assessmentPageNumber + '/save-freeform-annotation/',
        data: 'annotation_image=' + encodeURIComponent(dataURL) +
          '&csrfmiddlewaretoken=' + encodeURIComponent(Utils.CSRF_TOKEN)
      }).done(function() {
        self.isSaving = false;
      });
    }
  },

  enableDraw: function() {
    this.canDraw = true;
    this.$el.addClass('drawing');
  },

  disableDraw: function() {
    this.canDraw = false;
    this.$el.removeClass('drawing');
  },

  enableErase: function() {
    this.canErase = true;
    this.$el.addClass('erasing');
  },

  disableErase: function() {
    this.canErase = false;
    this.$el.removeClass('erasing');
  }
});
