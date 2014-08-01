// This view handles the student mapping/submission.
//
// To help understand the code, note there are three states for `responsePage`:
// 1) responsePage === null, meaning the student hasn't selected anything
// 2) responsePage is an empty array, meaning the student has no answer
// 3) responsePage is an array of one integer representing the selected page
var MapSubmissionView = Backbone.View.extend({
  ESCAPE_KEY: 27,
  templates: {
    selectPagesTemplate: _.template($('.select-pages-template').html()),
    mappedTokenTemplate: _.template($('.mapped-token-template').html())
  },

  events: {
    'click .question-part-nav li': 'updateQuestionPart',
    'click .select-pages .page': 'selectPage',
    'click .zoom': 'showZoomedImage',
    'change [type="checkbox"]': 'setNoAnswer',
    'click .mapped-token.active': 'unmapQuestionPart'
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

    this.hasRendered = false;

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
          self.hasRendered = true;
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

      // an empty array corresponds to no answer (see updateQuestionPart())
      noAnswer: _.isArray(this.responsePage) && this.responsePage.length === 0
    };

    this.$selectPages.html(this.templates.selectPagesTemplate(templateData));
    this.$questionNumberHeader = this.$('.question-number');
    this.$partNumberHeader = this.$('.part-number');

    this.highlightCurrentQuestionPartTokens();

    var self = this;
    this.responses.forEach(function(response) {
      var page = self.getPageFromResponse(response);
      if (page !== null) {
        var $navLi = self.$('li[data-question-number=' + response.get('questionNumber') +
          '][data-part-number=' + response.get('partNumber') + ']');
        self.updateMappedPageNumber($navLi, page);
      }
    });

    this.showSuccessIfDone();
    window.resizeNav();
  },

  highlightCurrentQuestionPartTokens: function() {
    var $tokens = this.$('.mapped-token');
    $tokens.removeClass('active');
    $tokens.find('.remove-button').hide();

    var self = this;
    $tokens.each(function() {
      var $token = $(this);

      var tokenQuestionNumber = parseInt($token.attr('data-question-number'), 10);
      var tokenPartNumber = parseInt($token.attr('data-part-number'), 10);

      if (self.questionNumber === tokenQuestionNumber &&
          self.partNumber === tokenPartNumber) {
        $token.addClass('active');
        $token.find('.remove-button').show();
      }
    });

    // updates the "I did not answer this question" checkbox
    if (!$tokens.hasClass('active') && this.responsePage
        && this.responsePage.length === 0) {
      this.$('.no-answer').prop('checked', true);
    } else {
      this.$('.no-answer').prop('checked', false);
    }
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

    if (this.hasRendered) {
      // update the Question/Part heading with the correct numbers
      this.$questionNumberHeader.html(this.questionNumber);
      this.$partNumberHeader.html(this.partNumber);
    }

    // get response that corresponds to the new question part and re-render
    this.response = this.findResponseForQuestionPart(this.questionNumber, this.partNumber);

    // keep track of pages that contain the response
    var responsePage = this.getPageFromResponse(this.response);
    if (responsePage === "") {
      responsePage = [];
    } else if (responsePage !== null) {
      responsePage = [responsePage];
    }

    this.responsePage = responsePage;

    this.$navLis.removeClass('active');
    $li.addClass('active');
    this.highlightCurrentQuestionPartTokens();
  },

  getPageFromResponse: function(response) {
    var pageToReturn = response.get('pages');
    if (!pageToReturn) {
      return pageToReturn;
    }
    pageToReturn = pageToReturn.split(',').map(function(page) {
      return parseInt(page, 10);
    });
    return Math.min.apply(null, pageToReturn);
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

    var selectorStr = '.mapped-token[data-question-number=' + this.questionNumber +
      '][data-part-number=' + this.partNumber + ']';
    var $token = $container.find(selectorStr);
    if ($token.length > 0) {  // if the page already has the token, do nothing
      return;
    } else {  // select page
      this.responsePage = [pageNumber];

      this.$(selectorStr).remove();

      var newToken = this.templates.mappedTokenTemplate({
        questionNum: this.questionNumber,
        partNum: this.partNumber
      });
      $container.find('.mapped-token-container').append(newToken);

      // add the border glow
      var $imageContainer = $page.parent('.image-container');
      $imageContainer.addClass('just-selected');
      setTimeout(function() {
        $imageContainer.removeClass('just-selected');
      }, 200);
    }

    var $oldLi = this.$('.nav-pills li.active');
    this.updateMappedPageNumber($oldLi, pageNumber);

    this.$('.no-answer').prop('checked', false);
    this.response.save({ pages: this.responsePage.join(',') });

    this.goToNextQuestion();
    this.showSuccessIfDone();
  },

  goToNextQuestion: function() {
    // goes to the next question/part, if there is one
    var activeLi = this.$navLis.filter(function(i, li) {
      return $(li).hasClass('active');
    });

    var $nextLi = $(activeLi).next();
    if ($nextLi.length > 0) {
      $nextLi.click();
    } else {  // there is no next question to go to
      this.highlightCurrentQuestionPartTokens();
    }
  },

  setNoAnswer: function(event) {
    var $checkbox = $(event.currentTarget);

    this.$('.mapped-token').each(function() {
      var $token = $(this);
      if ($token.hasClass('active')) {
        $token.remove();
      }
    });

    var $oldLi = this.$('.nav-pills li.active');

    if ($checkbox.is(':checked')) {
      this.responsePage = [];
      // empty string signifies no answer
      this.response.save({ pages: '' });
      this.updateMappedPageNumber($oldLi, '');

      this.goToNextQuestion();
    } else {
      // null signifies no pages selected
      this.responsePage = null;
      this.response.save({ pages: null });
      this.updateMappedPageNumber($oldLi, null);
    }

    this.showSuccessIfDone();
  },

  unmapQuestionPart: function(event) {
    $(event.currentTarget).remove();

    var $oldLi = this.$('.nav-pills li.active');
    this.response.save({ pages: null });
    this.updateMappedPageNumber($oldLi, null);
    this.showSuccessIfDone();
  },

  updateMappedPageNumber: function($navLi, page) {
    if (page === null) {
      $navLi.find('.mapped-page-number').html('');
    } else if (page.length === 0) {
      $navLi.find('.mapped-page-number').html('(&mdash;)');
    } else {
      $navLi.find('.mapped-page-number').html('(pg' + page + ')');
    }
  }
});

$(function() {
  var mapSubmissionView = new MapSubmissionView(
    { el: $('.map-submission') });
  mapSubmissionView.fetchAndRender();
});
