var UploadView = Backbone.View.extend({
  REFRESH_DURATION: 3000,
  template: _.template($('.progress-template').html()),

  initialize: function(options) {
    this.$exam = this.$('#id_exam_id');
    this.$uploadProgress = this.$('.upload-progress');
  },

  render: function() {
    var self = this;

    // fetch statistics for number of pages uploaded
    $.ajax({
      type: 'GET',
      url: 'split-pages/' + this.$exam.val() + '/',
    }).done(function(data) {
      var numTotalPages = data.numTotalPages;
      var numUploadedPages = data.numUploadedPages;

      // update progress
      if (numTotalPages === 0) {
        self.$uploadProgress.html(self.template());
      } else {
        self.$uploadProgress.html(self.template({
          numTotalPages: numTotalPages,
          numUploadedPages: numUploadedPages,
          percentUploaded: 100 * numUploadedPages / numTotalPages
        }));
      }

      self.refreshTimeout = setTimeout(_.bind(self.render, self),
        self.REFRESH_DURATION);
    });

    var infoPopoverText = '"Questions are on every other page" means there is ' +
    'a blank page/scratch paper between each page.';
    var $infoPopover = this.$('.info-popover');
    $infoPopover.popover({ content: infoPopoverText, placement: 'top' });
  }
  // TODO: set exam; immediately call render
});


$(function() {
  var uploadView = new UploadView({ el: $('.upload') });
  uploadView.render();
});
