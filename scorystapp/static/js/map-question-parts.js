$(function() {
  var LEFT_ARROW_KEY = 37;
  var RIGHT_ARROW_KEY = 39;

  var $optionsTemplate = $('.options-template');
  var optionsTemplate = _.template($optionsTemplate.html());

  var $questionsSelect = $('.questions');
  var $partsSelect = $('.parts');
  var $pagesInput = $('.pages');
  var $saveButton = $('.save');
  var $currentPageNum = $('.current-page-number');

  var $previousPage = $('.previous-page');
  var $nextPage = $('.next-page');

  var assessmentCanvasView = new AssessmentCanvasView({
    el: '.exam',
    preloadCurExam: 2
  });

  initTypeAhead();
  getAllQuestionParts();

  // Initializes the functionality for typeahead.js
  function initTypeAhead() {
    // Expected format of each element in array from prefetch:
    // {
    //   'name': 'Karanveer Mohan',
    //   'email': 'kvmohan@stanford.edu',
    //   'studentId': 01234567,
    //   'tokens': ['Karanveer', 'Mohan']
    // }
    var typeaheadTemplate = $('.typeahead-template').html();
    $('.typeahead').typeahead({
      prefetch: {
        url: 'get-all-exam-answers/',
      },
      template: _.template(typeaheadTemplate),
      limit: 6,
      valueKey: 'name'
    }).on('typeahead:selected', function(obj, user) {
      var url = window.location.href;
      var replaceAfterStr = 'map-question-parts/';
      var index = url.indexOf(replaceAfterStr);
      window.location.href = url.substr(0, index + replaceAfterStr.length) + user['examAnswerId'];
    });
  }

  // Makes an ajax call to get the array where the i-th index corresponds to
  // the number of parts the (i+1)th question has for the give exam
  function getAllQuestionParts() {
    $.ajax({
      url: 'get/',
      dataType: 'json'
    }).done(function(data) {
      initQuestionParts(data['questions']);
    }).fail(function(request, error) {
      console.log('Error while getting all question parts');
    });
  }

  // Shows the correct range of parts for the current question
  // i.e if question 2 only has 2 parts, we'll only have two options in the select list
  function showPart(questions) {
    var questionNumber = $questionsSelect.find(':selected').text();
    if (questions) {
      var numParts = questions[questionNumber - 1];
      $partsSelect.html(optionsTemplate({length: numParts}));
    }
    getPagesForQuestionPart();
  }

  // Gets the pages associated with the 'response' corresponding to the
  // questionNumber and partNumber for the current studemt
  function getPagesForQuestionPart() {
    var questionNumber = $questionsSelect.find(':selected').text();
    var partNumber = $partsSelect.find(':selected').text();
    $.ajax({
      url: 'get/' + questionNumber + '/' + partNumber + '/',
    }).done(function(data) {
      $pagesInput.val(data);
    }).fail(function(request, error) {
      console.log('Error while getting pages');
    });
  }

  function initQuestionParts(questions) {
    // questions is an array with the i-th index corresponding to the number of parts
    // the (i+1)th question has

    // Adds options 1,2..,questions.length
    $questionsSelect.html(optionsTemplate({length: questions.length}));
    showPart(questions);

    // When the user chooses a new question, update the parts being shown
    $questionsSelect.change(function() {
      showPart(questions);
    });

    // When the user chooses a new part, update the pages associated with this new question/part
    $partsSelect.change(function() {
      getPagesForQuestionPart();
    });
  }

  // Saves the pages associated with the current question / part after validation
  $saveButton.click(function() {
    var questionNumber = $questionsSelect.find(':selected').text();
    var partNumber = $partsSelect.find(':selected').text();
    var pages = $pagesInput.val();
    var success = validatePages(pages);

    if (!success) {
      $('.error').html('Please enter comma separated pages within the range ' +
        '[1, numPages] in the form: 1,2,3');
      return;
    }

    $.ajax({
      url: 'update/' + questionNumber + '/' + partNumber + '/' + encodeURIComponent(pages) + '/',
    }).done(function(data) {
      $('.success').show().delay(3000).fadeOut();
    }).fail(function(request, error) {
      alert('Save failed: ' + error);
    });
  });

  function validatePages(pages) {
    pages = pages.split(',');
    for (var i = 0; i < pages.length; i++) {
      var page = pages[i];
      if (isNaN(page)) {
        return false;
      }

      if (parseInt(page) <= 0 || parseInt(page) > assessmentCanvasView.getMaxPageNumber()) {
        return false;
      }
    }
    return true;
  }

  // Makes the back button work by handling the popState event.
  $(window).bind('popstate', function() {
    assessmentCanvasView.showPage();
    $currentPageNum.html(assessmentCanvasView.getCurPageNum());
  });
});
