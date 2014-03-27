// TODO: browserify
var ZoomLensView = IdempotentView.extend({
  ZOOM_LENS_OFFSET: 200,  // radius of the zoom lens

  events: {
    'click .enable-zoom': 'enableZoom',
    'click .disable-zoom': 'disableZoom',
    'mouseenter .exam-image': 'showZoomLens',
    'mouseleave .exam-image': 'hideZoomLens',
    'mousemove .exam-image': 'moveZoomLens',
    'changeExamPage': 'setCurPageNum'
  },

  initialize: function(options) {
    this.constructor.__super__.initialize.apply(this, arguments);

    this.curPageNum = options.curPageNum;
    this.zoomLensEnabled = false;
    this.image = new Image();
  },

  loadImage: function() {
    if (this.zoomLensEnabled) {
      var imageSource = 'get-exam-jpeg-large/' + this.curPageNum + '/';
      this.$el.find('.zoom-lens img').attr('src', imageSource);
      this.image.src = imageSource;
    }
  },

  enableZoom: function() {
    this.zoomLensEnabled = true;
    this.loadImage();

    this.$el.addClass('zoom-enabled');
    this.$el.find('.enable-zoom').toggle();
    this.$el.find('.disable-zoom').toggle();
  },

  disableZoom: function() {
    this.zoomLensEnabled = false;
    this.$el.removeClass('zoom-enabled');
    this.$el.find('.enable-zoom').toggle();
    this.$el.find('.disable-zoom').toggle();
  },

  showZoomLens: function() {
    if (this.zoomLensEnabled) {
      this.$el.find('.zoom-lens').show();
    }
  },

  hideZoomLens: function() {
    this.$el.find('.zoom-lens').hide();
  },

  moveZoomLens: function(event) {
    if (!this.zoomLensEnabled) return;
    var y = event.offsetY;
    var x = event.offsetX;

    // Get the offset top and left of the large image
    var offsetTop = -(y * this.image.naturalHeight / this.$el.height()) + this.ZOOM_LENS_OFFSET;
    var offsetLeft = -(x * this.image.naturalWidth / this.$el.width()) + this.ZOOM_LENS_OFFSET;

    this.$el.find('.zoom-lens').css('top', y + 20);
    this.$el.find('.zoom-lens').css('left', x + 20);
    this.$el.find('.zoom-lens img').css('top', offsetTop);
    this.$el.find('.zoom-lens img').css('left', offsetLeft);
  },

  setCurPageNum: function(curPageNum) {
    this.curPageNum = curPageNum;
    this.loadImage();
  },

  changeExamPage: function(curPageNum) {
    this.curPageNum = curPageNum;
    this.loadImage();
  }
});
