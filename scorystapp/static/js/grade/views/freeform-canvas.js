var FreeformCanvasView = IdempotentView.extend({
  CANVAS_WIDTH: 675,
  CANVAS_HEIGHT: 873,
  ANNOTATING_ICON_Y_OFFSET: 20,
  ANNOTATING_ICON_X_OFFSET: 5,
  ERASING_LINE_WIDTH: 15,
  DRAWING_LINE_WIDTH: 1,
  TRY_SAVING_TIMEOUT: 1000,

  events: {
    'mousedown': 'beginAnnotating',
    'mousemove': 'tryAnnotating',
    'mouseup': 'endAnnotating'
  },

  initialize: function(options) {
    this.assessmentPageNumber = options.assessmentPageNumber;

    // true if the correct toolbar option is selected
    this.canDraw = false;
    this.canErase = false;

    // true if the user's mouse is pressed and user has permissions to either
    // draw or erase
    this.isAnnotating = false;

    // true if the view is waiting for a freeform annotation image to save
    this.isSaving = false;
  },

  render: function(pageNumber) {
    this.assessmentPageNumber = pageNumber;
    this.context = this.$el[0].getContext('2d');

    this.drawingGlobalCompositeOperation = this.context.globalCompositeOperation;

    this.canvas = $('canvas')[0];

    this.$el[0].width = this.CANVAS_WIDTH;
    this.$el[0].height = this.CANVAS_HEIGHT;

    // if there is a previous freeform annotation for the page, display it
    var self = this;
    $.ajax({
      url: window.location.href + 'assessment-page/' + pageNumber +
      '/has-freeform-annotation/'
    }).done(function(hasFreeformAnnotation) {
      if (hasFreeformAnnotation === 'False') {
        self.context.clearRect(0, 0, self.canvas.width, self.canvas.height);
      } else {
        var url = window.location.href + 'assessment-page/' + pageNumber +
          '/get-freeform-annotation/';

        var drawing = new Image();
        drawing.src = url;
        drawing.onload = function() {
          self.context.drawImage(drawing, 0, 0);
        };
      }
    })
  },

  beginAnnotating: function(event) {
    if (this.canDraw || this.canErase) {
      this.context.beginPath();
      var xCoord = event.offsetX + this.ANNOTATING_ICON_X_OFFSET;
      var yCoord = event.offsetY + this.ANNOTATING_ICON_Y_OFFSET;
      this.context.moveTo(xCoord, yCoord);
      this.isAnnotating = true;

      var classToAdd = this.canDraw ? 'drawing' : 'erasing';
      this.$el.addClass(classToAdd);
    }
  },

  tryAnnotating: function(event) {
    if (this.isAnnotating && (this.canDraw || this.canErase)) {
      var xCoord = event.offsetX + this.ANNOTATING_ICON_X_OFFSET;
      var yCoord = event.offsetY + this.ANNOTATING_ICON_Y_OFFSET;
      this.context.lineTo(xCoord, yCoord);

      if (this.canDraw) {
        this.context.globalCompositeOperation = this.drawingGlobalCompositeOperation;
        this.context.strokeStyle = '#e74c3c';  // red color
        this.context.lineWidth = this.DRAWING_LINE_WIDTH;
      } else {
        // set the context to draw transparent pixels
        this.context.globalCompositeOperation = 'destination-out';
        this.context.strokeStyle = 'rgba(0, 0, 0, 1)';
        this.context.lineWidth = this.ERASING_LINE_WIDTH;
      }
      this.context.stroke();
    }
  },

  endAnnotating: function() {
    if (!this.isAnnotating || (!this.canDraw && !this.canErase)) {
      return;
    }

    this.$el.removeClass('drawing');
    this.$el.removeClass('erasing');
    this.isAnnotating = false;

    // if there is a
    if (this.isSaving) {
      window.setTimeout(_.bind(this.endAnnotating, this), this.TRY_SAVING_TIMEOUT);
      return;
    }

    this.isSaving = true;

    // Save the drawing
    var dataURL = this.$el[0].toDataURL();
    var beginIndex = 'data:image/png;base64,'.length;

    var self = this;
    $.ajax({
      type: 'POST',
      url: window.location.href + 'assessment-page/' +
           this.assessmentPageNumber + '/save-freeform-annotation/',
      data: 'annotation_image=' + encodeURIComponent(dataURL.substring(beginIndex)) +
        '&csrfmiddlewaretoken=' + encodeURIComponent(Utils.CSRF_TOKEN)
    }).done(function() {
      self.isSaving = false;
    });
  },

  enableDraw: function() {
    this.canDraw = true;
  },

  disableDraw: function() {
    this.canDraw = false;
  },

  enableErase: function() {
    this.canErase = true;
  },

  disableErase: function() {
    this.canErase = false;
  }
});
