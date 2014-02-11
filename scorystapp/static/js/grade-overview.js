$(function() {
  var $students = $('.nav-pills.nav-stacked');  // List of students container.
  var $examSummary = $('.exam-summary');  // Exam summary table.
  var $main = $('.main');

  var $exams = $('.nav.nav-tabs');
  var $examOptions = $('.exam-options');

  var $studentFilteringTemplate = $('.student-filtering-template');
  var $studentsTemplate = $('.students-template');

  var $studentList = $('.students ul');
  var $studentFiltering = $('.students .filtering');

  var $studentSearch = $('.students .search');
  var $studentScroll = $('.students-scroll');

  var templates = {
    renderStudentFilteringTemplate: Handlebars.compile($studentFilteringTemplate.html()),
    renderStudentsTemplate: Handlebars.compile($studentsTemplate.html())
  };

  var curExamId = $exams.find('li.active').children().attr('data-exam-id');

  function renderStudentsList() {
    // Creates the students list
    $.ajax({
      url: curExamId + '/get-students/',
      dataType: 'json',
      async: false
    }).done(function(data) {
      $students.html(templates.renderStudentsTemplate(data));
      window.resizeNav();
    }).fail(function(request, error) {
      console.log('Error while getting students data: ' + error);
    });    
  }

  renderStudentsList();

  // Creates the initial exam summary.
  var curUserId = $students.find('li.active').children().attr('data-user-id');
  
  renderExamSummary(curUserId, curExamId);

  function renderExamsOptions() {
    $.ajax({
      url: curExamId + '/get-overview/',
      dataType: 'json'
    }).done(function(data) {
      // Add the examId to be sent to handlebars
      data['examId'] = curExamId;
      $studentFiltering.html(templates.renderStudentFilteringTemplate(data));
      
      // Create release popover
      $('.release-grades').popoverConfirm({
        placement: 'right',
        text: 'Once you release grades, students with graded exams who have not' +
          ' been previously notified will receive an email and be able to view their scores.',
        confirmText: 'Release',
        confirm: function() {
          window.location.href = curExamId + '/release/';
        }
      });

      $('.export-csv').attr('href', curExamId + '/csv/');

      setCheckboxEventListener('graded');
      setCheckboxEventListener('ungraded');
      setCheckboxEventListener('unmapped');

      // show/hide exam options depending on whether students are mapped
      if (!data.mapped) {
        $examOptions.hide();
      } else {
        $examOptions.show();
      }
      
      window.resizeNav();
    }).fail(function(request, error) {
      console.log('Error while getting exams overview data: ' + error);
    });
  }

  renderExamsOptions();

  // When a student is clicked, refresh the exam summary.
  $students.on('click', 'a', function(event) {
    event.preventDefault();
    var $studentLink = $(event.currentTarget);
    curUserId = $studentLink.attr('data-user-id');

    $students.children('li').removeClass('active');
    renderExamSummary(curUserId, curExamId);
    $studentLink.parents('li').addClass('active');
  });

  // When an exam tab is clicked, update the exam summary.
  $exams.on('click', 'li', function(event) {
    event.preventDefault();
    var $li = $(event.currentTarget);

    $exams.find('li').removeClass('active');
    curExamId = $li.find('a').attr('data-exam-id');

    renderExamSummary(curUserId, curExamId);
    $li.addClass('active');
    renderStudentsList();
    renderExamsOptions();
  });

  var previousSearchValue = '';
  $studentSearch.keyup(function(event) {
    var searchValue = $studentSearch.val().toLowerCase();

    if (previousSearchValue !== searchValue) {
      // hide students that don't match search text; show students that do
      $studentList.find('li').each(function() {
        var $li = $(this);
        var text = $li.find('a').text();

        if (text.toLowerCase().indexOf(searchValue) === -1) {
          $li.hide();
        } else {
          $li.show();
        }
      });

      previousSearchValue = searchValue;
    }
  });

  function setCheckboxEventListener(checkboxClass) {
    $('input.' + checkboxClass + ':checkbox').on('change', function() {
      $lis = $students.children('li');

      if ($(this).is(':checked')) {  // If checkbox is checked.
        for (var i = 0; i < $lis.length; i++) {
          if ($lis.eq(i).children('a').attr('data-filter-type') === checkboxClass) {
            $lis.eq(i).show();
          }
        }
      } else {  // If checkbox is unchecked.
        for (var i = 0; i < $lis.length; i++) {
          if ($lis.eq(i).children('a').attr('data-filter-type') === checkboxClass) {
            $lis.eq(i).hide();
          }
        }
      }

      // Set a new active student, if necessary.
      if ($students.find('.active:visible').length == 0) {
        $lis.removeClass('active');
        $lis = $students.children('li:visible');
        if ($lis.length > 0) {
          $lis.eq(0).addClass('active');
          curUserId = $lis.eq(0).children('a').attr('data-user-id');
          renderExamSummary(curUserId, curExamId);
        }
      }

      // Update the scrollbar
      $studentScroll.customScrollbar();
    });
  }

  if ($studentScroll.height() >= 500) {
    $studentScroll.css('height', '500px');
    $studentScroll.customScrollbar();    
  }

});
