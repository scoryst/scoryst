var MapSubmissionView = Backbone.View.extend({
  ESCAPE_KEY: 27,
  template: _.template($('.select-pages-template').html()),

  events: {
    'click .question-part-nav li': 'updateQuestionPart',
    'click .select-pages .page': 'selectPage',
    'click .zoom': 'showZoomedImage',
    'change [type="checkbox"]': 'setNoAnswer',
  },

  initialize: function(options) {
    this.submissionPages = new SubmissionPageCollection();
    this.responses = new ResponseCollection();

    this.$selectPages = this.$('.select-pages');
    this.$navLis = this.$('.question-part-nav li');

    this.$success = this.$('.success');
    this.$failure = this.$('.failure');

    this.$modal = $('.modal');
    this.$modalContent = this.$modal.find('.modal-content');
    this.hideModalOnEsc();
  },

  fetchAndRender: function() {
    this.uploadInProgress = true;
    var self = this;

    this.responses.fetch({
      success: function() {
        self.whenSubmissionPagesAreUploaded(function() {
          self.uploadInProgress = false;

          // show question 1, part 1 by default
          self.$navLis.eq(0).click();
          self.render();
        });
      }
    });
  },

  whenSubmissionPagesAreUploaded: function(callback) {
    var self = this;
    this.submissionPages.fetch({
      success: function() {
        if (self.submissionPages.length === pageCount) {
          callback();
        } else {
          // try again after waiting
          setTimeout(function() {
            self.whenSubmissionPagesAreUploaded(callback);
          }, 2000);
        }
      }
    });
  },

  render: function() {
    var templateData = {
      questionNumber: this.questionNumber,
      partNumber: this.partNumber,
      submissionPages: this.submissionPages.toJSON(),
      noAnswer: _.isArray(this.responsePages) && this.responsePages.length === 0
    };

    if (this.responsePages !== null) {
      var self = this;
      templateData.submissionPages.forEach(function(page) {
        if (self.responsePages.indexOf(page.pageNumber) !== -1) {
          page.isSelected = true;
        }
      });
    }

    this.$selectPages.html(this.template(templateData));
    this.showSuccessIfDone();
    window.resizeNav();
  },

  showSuccessIfDone: function() {
    var unmappedResponses = this.responses.where({ pages: null });
    if (unmappedResponses.length === 0) {
      this.$success.show();
      this.$failure.hide();
    } else {
      this.$success.hide();
      this.$failure.show();
    }
  },

  updateQuestionPart: function(event) {
    event.preventDefault();

    // don't allow user to update question part while we're waiting for the
    // upload to complete
    if (this.uploadInProgress) {
      return;
    }

    var $li = $(event.currentTarget);

    this.questionNumber = $li.data('question-number');
    this.partNumber = $li.data('part-number');

    // get response that corresponds to the new question part and re-render
    this.response = this.findResponseForQuestionPart(this.questionNumber, this.partNumber);

    // keep track of pages that contain the response
    var responsePages = this.response.get('pages');
    if (responsePages === "") {
      responsePages = [];
    } else if (responsePages !== null) {
      responsePages = responsePages.split(',').map(function(page) {
        return parseInt(page, 10);
      });
    }

    // There are three states:
    // 1) responsePages === null, meaning the student hasn't selected anything
    // 2) responsePages is an empty array, meaning the student has no answer
    // 3) responsePages is an array of integers representing the selected pages

    this.responsePages = responsePages;
    this.render();

    this.$navLis.removeClass('active');
    $li.addClass('active');
  },

  showZoomedImage: function(event) {
    var $zoomButton = $(event.currentTarget);
    var $img = $zoomButton.siblings('img');

    this.$modalContent.empty();
    var $zoomedImg = $('<img />').attr('src', $img.attr('data-zoomed-src'));

    this.$modalContent.append($zoomedImg);
    this.$modal.modal('show');
  },

  hideModalOnEsc: function() {
    var self = this;
    $(window).keydown(function(event) {
      if (event.keyCode === self.ESCAPE_KEY) {
        self.$modal.modal('hide');
      }
    });
  },

  findResponseForQuestionPart: function(questionNumber, partNumber) {
    return this.responses.findWhere({
      questionNumber: questionNumber,
      partNumber: partNumber
    });
  },

  selectPage: function(event) {
    var $page = $(event.currentTarget);
    var $container = $page.parent();

    var pageNumber = $page.attr('data-page-number');
    pageNumber = parseInt(pageNumber, 10);

    if ($container.hasClass('selected')) {
      // deselect page
      var index = this.responsePages.indexOf(pageNumber);
      this.responsePages.splice(index, 1);
    } else {
      // select page
      if (this.responsePages === null) {
        this.responsePages = [];
      }

      this.responsePages.push(pageNumber);
    }

    $container.toggleClass('selected');
    this.responsePages = _.sortBy(this.responsePages);

    if (this.responsePages.length === 0) {
      // null signifies no pages selected
      this.response.save({ pages: null });
    } else {
      this.$('.no-answer').prop('checked', false);
      this.response.save({ pages: this.responsePages.join(',') });
    }

    this.showSuccessIfDone();
  },

  setNoAnswer: function(event) {
    var $checkbox = $(event.currentTarget);
    this.$('.image-container').removeClass('selected');

    if ($checkbox.is(':checked')) {
      // empty string signifies no answer
      this.response.save({ pages: '' });
    } else {
      // null signifies no pages selected
      this.response.save({ pages: null });
    }

    this.showSuccessIfDone();
  }
});

$(function() {
  var mapSubmissionView = new MapSubmissionView(
    { el: $('.map-submission') });
  mapSubmissionView.fetchAndRender();
});
