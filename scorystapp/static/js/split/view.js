// TODO: browserify
var SplitView = Backbone.View.extend({
  NUM_COLS: 5,
  NUM_ROWS: 4,
  LEFT_ARROW_KEY_CODE: 37,
  RIGHT_ARROW_KEY_CODE: 39,

  template: _.template(this.$('.images-template').html()),

  events: {
    'click .next-images': 'viewNextImages',
    'click .previous-images': 'viewPreviousImages',
    'click img': 'markImage',
    'click .zoom': 'showModal'
  },

  initialize: function(options) {
    this.$imageGrid = $('.image-grid');

    var self = this;
    this.pages = new SplitPageCollection();
    this.pages.fetch({
      success: function() {
        self.firstPageIndex = 0;
        self.render();
      }
    });

    $(window).keydown(_.bind(this.handleShortcuts, this));

    this.$modal = $('.modal');  // used to show large jpegs
  },

  render: function() {
    var pages = this.pages.toJSON().slice(this.firstPageIndex,
      this.firstPageIndex + this.NUM_ROWS * this.NUM_COLS);
    this.$imageGrid.html(this.template({
      'pages': pages,
      'numCols': this.NUM_COLS,
      'numRows': this.NUM_ROWS
    }));
  },

  viewNextImages: function() {
    var nextFirstPageIndex = this.firstPageIndex + this.NUM_ROWS * this.NUM_COLS;
    if (nextFirstPageIndex < this.pages.length) {
      this.firstPageIndex = nextFirstPageIndex;
      this.render();
    }
  },

  viewPreviousImages: function() {
    var nextFirstPageIndex = this.firstPageIndex - this.NUM_ROWS * this.NUM_COLS;
    if (nextFirstPageIndex > 0) {
      this.firstPageIndex = nextFirstPageIndex;
    } else {
      this.firstPageIndex = 0;
    }
    this.render();
  },

  markImage: function(event) {
    var $currentTarget = $(event.currentTarget);
    var imageId = parseInt($currentTarget.attr('data-page-id'), 10);
    var pageToSave = this.pages.filter(function(page) {
      return page.id === imageId;
    })[0];

    // If the page has been marked, set `beginsExamAnswer` to true, else false
    if ($currentTarget.parents('.image-container').hasClass('selected')) {
      $currentTarget.parents('.image-container').removeClass('selected');
      pageToSave.save({ 'beginsExamAnswer': false });
    } else {
      $currentTarget.parents('.image-container').addClass('selected');
      pageToSave.save({ 'beginsExamAnswer': true });
    }
  },

  handleShortcuts: function(event) {
    var $target = $(event.target);

    switch (event.keyCode) {
      case this.RIGHT_ARROW_KEY_CODE:
        event.preventDefault();
        this.viewNextImages();
        break;

      case this.LEFT_ARROW_KEY_CODE:
        event.preventDefault();
        this.viewPreviousImages();
        break;
    }
  },

  showModal: function(event) {
    this.$modal.find('.modal-content').html('<img src="http://placekitten.com/g/700/900" alt="zoom" />');
    this.$modal.modal();
  }
});

$(function() {
  new SplitView({ el: $('.split') });
});
