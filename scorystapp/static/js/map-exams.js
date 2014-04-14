$(function() { 
  var LEFT_ARROW_KEY = 37;
  var RIGHT_ARROW_KEY = 39;

  var examsArray;
  var currentIndex = -1;
  
  var examCanvasView = new ExamCanvasView({
    el: '.exam',
    preloadOtherStudentExams: 2,
    preloadCurExam: 1
  });
  examCanvasView.render();

  initTypeAhead();
  getAllExams();

  $('.previous-exam').click(function() {
    displayExamAtOffset(-1);
  });

  $('.next-exam').click(function() {
    displayExamAtOffset(1);
  });

  // Initializes the functionality for typeahead.js
  function initTypeAhead() {
    // Expected format of each element in array from prefetch:
    // {
    //   'name': 'Karanveer Mohan',
    //   'email': 'kvmohan@stanford.edu',
    //   'student_id': 01234567,
    //   'tokens': ['Karanveer', 'Mohan']
    // }
    var typeaheadTemplate = $('.typeahead-template').html();
    $('.typeahead').typeahead({
      prefetch: {
        url: 'get-all-course-students/',
      },
      template: _.template(typeaheadTemplate),
      limit: 6,
      valueKey: 'name'
    }).on('typeahead:selected', function (obj, user) {
      // When the user selects an option, call mapExam and pass the data associated
      // with the option selected, which is the same as the prefetched data
      mapExam(user);
    });
  }

  // Returns the offset to the next unmapped student
  function getOffsetToUnmapped(offset) {
    // Take care of negative step sizes
    stepSize = Math.abs(offset)/offset;

    // Loop as long as we are within bounds and on an already mapped exam
    while (currentIndex + offset >= 0 && currentIndex + offset < examsArray.length 
      && examsArray[currentIndex + offset]['mappedTo']) {
      offset += stepSize;
    }
    return offset;
  }

  function displayExamAtOffset(offset) {
    // The user only wants to see unmapped exams
    if ($('input[name=show-mapped]').filter(':checked').val() == 'unmapped') {
      offset = getOffsetToUnmapped(offset);
    }

    if (currentIndex + offset < 0 || currentIndex + offset >= examsArray.length) {
      return;
    }

    prevIndex = currentIndex;
    currentIndex += offset;

    var currentPath = window.location.pathname;
    currentPath = currentPath.replace('/map/' + examsArray[prevIndex].examAnswerId, 
      '/map/' + examsArray[currentIndex].examAnswerId);

    // update URL with history API; fall back to standard redirect
    if (window.history) {
      window.history.pushState(null, null, currentPath);
      displayExam();
    } else {
      window.location.pathname = currentPath;
    }
  }


  // Makes the back button work by handling the popState event.
  $(window).bind('popstate', function() {
    if (examsArray) {
      displayExam();
    }
  });

  // Display the exam corresponding to the URL being shown
  function displayExam() {
    // The URL has changed, so image loader will show the new exam
    examCanvasView.showPage();

    // This image is already mapped to a student, so show the student name
    if (examsArray[currentIndex]['mappedTo']) {
      $('.typeahead').typeahead('setQuery', examsArray[currentIndex]['mappedTo']).focus();
    } else {
      $('.typeahead').typeahead('setQuery', '').focus();
    }    
  }

  // Makes an ajax call to retrieve the exams and displays the one
  // corresponding to exam_answer_id in the url
  function getAllExams() {
    $.ajax({
      url: 'get-all-exams/',
      dataType: 'json'
    }).done(function(data) {
      examsArray = data['exams'];
      currentIndex = data['currentIndex'];
      displayExam();
    }).fail(function(request, error) {
      console.log('Error while getting exams');
    });
  }

  // Maps the current exam being displayed to the student specified by user
  function mapExam(user) {
    var examAnswerId = examsArray[currentIndex].examAnswerId;
    var courseUserId = user['courseUserId'];
    $.ajax({
      url: 'to/' + courseUserId + '/',
      dataType: 'text'
    }).done(function(data) {
      user['mapped']= true;
      examsArray[currentIndex]['mappedTo'] = user['name'];
      displayExamAtOffset(1);
    }).fail(function(request, error) {
      console.log('Error while mapping exams');
    });
  }

});
