// TODO: browserify
var ZoomLensView = IdempotentView.extend({
  ZOOM_LENS_RADIUS: 200,
  ZOOM_LENS_OFFSET_FROM_MOUSE: 20,

  events: {
    'click .enable-zoom': 'enableZoom',
    'click .disable-zoom': 'disableZoom',
    'mouseenter .exam-image': 'showZoomLens',
    'mouseleave .exam-image': 'hideZoomLens',
    'mousemove .exam-image': 'moveZoomLens'
  },

  initialize: function(options) {
    this.constructor.__super__.initialize.apply(this, arguments);

    this.$enableZoomButton = this.$el.find('.enable-zoom');
    this.$disableZoomButton = this.$el.find('.disable-zoom');
    this.$zoomLens = this.$el.find('.zoom-lens');

    this.curPageNum = options.curPageNum;
    this.zoomLensEnabled = false;
    this.createdImage = false;
    this.image = new Image();
  },

  loadImage: function() {
    if (this.zoomLensEnabled) {
      var imageSource = 'get-exam-jpeg-large/' + this.curPageNum + '/';

      // dynamically create the image tag
      if (!this.createdImage) {
        this.createdImage = true;
        this.$zoomImg = $('<img alt="Enlarged Exam" />').appendTo(this.$el.find('.zoom-lens'));
      }

      this.$zoomImg.attr('src', imageSource);
      this.image.src = imageSource;
    }
  },

  enableZoom: function() {
    this.zoomLensEnabled = true;
    this.loadImage();

    this.$el.addClass('zoom-enabled');
    this.$enableZoomButton.toggle();
    this.$disableZoomButton.toggle();
  },

  disableZoom: function() {
    this.zoomLensEnabled = false;
    this.$el.removeClass('zoom-enabled');
    this.$enableZoomButton.toggle();
    this.$disableZoomButton.toggle();
  },

  showZoomLens: function() {
    if (this.zoomLensEnabled) {
      this.$zoomLens.show();
    }
  },

  hideZoomLens: function() {
    this.$zoomLens.hide();
  },

  moveZoomLens: function(event) {
    if (!this.zoomLensEnabled) return;
    var y = event.offsetY;
    var x = event.offsetX;

    // Get the offset top and left of the large image
    var offsetTop = -(y * this.image.naturalHeight / this.$el.height()) + this.ZOOM_LENS_RADIUS;
    var offsetLeft = -(x * this.image.naturalWidth / this.$el.width()) + this.ZOOM_LENS_RADIUS;

    this.$zoomLens.css('top', y + this.ZOOM_LENS_OFFSET_FROM_MOUSE);
    this.$zoomLens.css('left', x + this.ZOOM_LENS_OFFSET_FROM_MOUSE);
    this.$zoomImg.css('top', offsetTop);
    this.$zoomImg.css('left', offsetLeft);
  },

  changeExamPage: function(curPageNum) {
    this.curPageNum = curPageNum;
    this.loadImage();
  }
});
