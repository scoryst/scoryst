$(function() {
  // DOM elements
  var $addQuestion = $('.add-question');
  var $questionList = $('.question-list');
  var $doneRubric = $('.done-rubric');

  var $gradeDownRadio = $('input[name=grade-down]');
  var $gradeDownRadioYes = $('input[name=grade-down]').eq(0);
  var $gradeDownRadioNo = $('input[name=grade-down]').eq(1);

  var $questionTemplate = $('.question-template');
  var $partTemplate = $('.part-template');
  var $rubricTemplate = $('.rubric-template');

  var templates = {
    renderQuestionTemplate: _.template($questionTemplate.html()),
    renderPartTemplate: _.template($partTemplate.html()),
    renderRubricTemplate: _.template($rubricTemplate.html())
  };

  var lastQuestionNum = 0;

  var examCanvasView = new ExamCanvasView({
    el: '.exam',
    preloadCurExam: 2
  });
  examCanvasView.render();

  // Used to recreate the UI, either after deletion, or during editing
  var savedQuestions;

  // Grade down by default
  var gradeDown = true;

  var infoPopoverText = 'Exams can be graded down or up. If grading down, exams' +
    ' have perfect scores initially, and each rubric selected deducts points from' +
    ' the total score. If grading up, exams have 0 points awarded initially, and' +
    ' each rubric selected awards points to the total score.';

  var $infoPopover = $('.info-popover');
  $infoPopover.popover({ content: infoPopoverText, placement: 'bottom' });


  $(function(){
    // Make a synchronous call to check if this exam already exists, in which case
    // the UI will be prepopulated with the existing questions/parts/rubrics.
    $.ajax({
      url: 'get-saved-exam/',
      dataType: 'json',
      // We want it to be asynchronous because if we're an updating an existing
      // rubric, we better load it
      async: false
    }).done(function(data) {
      savedQuestions = data['questions'];
      gradeDown = data['gradeDown'];
    }).fail(function(request, error) {
      console.log(error);
    });

    // Click the appropriate radio button based on whether the exam was
    // previously being graded up or down.
    if (gradeDown) {
      $gradeDownRadioYes.click();
    } else {
      $gradeDownRadioNo.click();
    }

    // Init the UI by adding one question to be shown to begin with
    $addQuestion.click();
  });


  // handle adding parts
  $questionList.click(function(event) {
    var $target = $(event.target);
    var $targetAndParents = $target.parents().addBack();
    var $addPart = $targetAndParents.filter('.add-part').eq(0);

    // event delegation on .add-part button
    if ($addPart.length !== 0) {
      // Prevent the click event being passed on to higher DOM elements
      event.preventDefault();

      // Find the ul where the template will be rendered
      var $ul = $addPart.siblings('ul');

      // Get the questionNum and partNum
      var questionNum = parseInt($addPart.children('div').data().question, 10);
      var partNum = $ul.children('li').length + 1;

      var points = '';
      var pages = '';

      // If we are recreating, fetch the previous points and pages corresponding to this part
      if (savedQuestions[questionNum - 1] && savedQuestions[questionNum - 1][partNum - 1]) {
        points = savedQuestions[questionNum - 1][partNum - 1].points;
        pages = savedQuestions[questionNum - 1][partNum - 1].pages;
        // Ensure it isn't NaN
        pages = pages[0] ? pages : '';
      }

      var templateData = {
        questionNum: questionNum,
        partNum: partNum,
        points: points,
        pages: pages
      };

      $ul.append(templates.renderPartTemplate(templateData));
      $ul.find('.add-rubric:last').click();

      // ensure readonly inputs are never focused
      $ul.children('li:last').find('input[readonly]').focus(function() {
        $(this).blur();
      });
      resizeNav();

      // If we are recreating the UI, click on add part and add question as needed
      if (savedQuestions[questionNum - 1] &&
        partNum < savedQuestions[questionNum - 1].length) {

        // More parts exist for this question, so click on add part
        $questionList.children().eq(questionNum - 1).find('.add-part').click()

      } else if (questionNum < savedQuestions.length) {
        // More questions exist
        $addQuestion.click();

      }
    }
  });

  // handle adding rubrics
  $questionList.click(function(event) {
    var $target = $(event.target);
    var $targetAndParents = $target.parents().addBack();
    var $addRubric = $targetAndParents.filter('.add-rubric').eq(0);

    // event delegation on .add-rubric button
    if ($addRubric.length !== 0) {
      event.preventDefault();

      $ul = $addRubric.siblings('ul');

      var $partLi = $addRubric.parent().parent();
      var questionNum = parseInt($partLi.data('question'), 10);
      var partNum = parseInt($partLi.data('part'), 10);
      var rubricNum = $ul.children().length + 1;

      var description = '';
      var points = '';

      var rubrics;
      try {
        // This will fail if savedQuestions is undefined etc.
        rubrics = savedQuestions[questionNum - 1][partNum - 1].rubrics;
      } catch (err) {
        // Do nothing;
      }

      // If the current rubric is stored in savedQuestions
      if (rubrics && rubrics[rubricNum - 1]) {
        description = rubrics[rubricNum - 1].description;
        points = rubrics[rubricNum - 1].points;
      } else if (rubricNum == 1) {
        description = 'Correct answer';
        points = 0;
      }
      // else if (rubricNum == 2) {
      //   description = 'Wrong answer';
      //   points = -10;
      // }

      var templateData = {
        questionNum: questionNum,
        partNum: partNum,
        description: description,
        points: points,
        awardedOrDeducted: gradeDown ? 'deducted' : 'awarded'
      };

      $ul.append(templates.renderRubricTemplate(templateData));
      resizeNav();

      // Click on add rubric if there are more questions stored in savedQuestions
      // Also if rubricNum < 2, it means we need to click on add rubric to show more
      if ((rubrics && rubricNum < rubrics.length) || rubricNum < 2) {
        $questionList.children().eq(questionNum - 1).find('.add-rubric').eq(partNum - 1).click();
      }
    }
  });

  // handle expanding/contracting of questions/parts when the arrow up/down
  // is clicked
  $questionList.click(function(event) {
    var $target = $(event.target);

    // clicks on h3/h4 should also expand/contract questions/parts
    if ($target.is('h3') || $target.is('h4')) {
      $target = $target.children('i:first');
    }

    var isArrowDown = $target.is('.fa-chevron-circle-down');
    var isArrowUp = $target.is('.fa-chevron-circle-up');

    // If the user clicked on either of them
    if (isArrowDown || isArrowUp) {
      event.preventDefault();
      var $body = $target.parent().siblings('.question-body, .part-body');

      // change icon and show/hide body
      if (isArrowDown) {
        $target.removeClass('fa-chevron-circle-down')
          .addClass('fa-chevron-circle-up');
        $body.hide();
      } else if (isArrowUp) {
        $target.removeClass('fa-chevron-circle-up')
          .addClass('fa-chevron-circle-down');
        $body.show();
      }

      resizeNav();
    }
  });

  // handles clicking on trash icon and subsequent deletion of question/part
  $questionList.click(function(event) {
    // event delegation on trash icon
    var $target = $(event.target);
    if ($target.is('.fa-trash-o')) {
      var $li = $target.parents('li').eq(0);

      var questionNum = parseInt($li.data('question'), 10);
      var partNum = parseInt($li.data('part'), 10);
      savedQuestions = createQuestionsList();


      if($li.hasClass('rubric-li')) {
        // Easy case where we just delete the rubric and return
        var rubricNum = $li.index() + 1;
        savedQuestions[questionNum - 1][partNum - 1].rubrics.splice(rubricNum - 1, 1);
        $li.remove();
        return;

      } else if($li.hasClass('part-li')) {
        // user is trying to remove a part
        var partNum = parseInt($li.data('part'), 10);
        savedQuestions[questionNum - 1].splice(partNum - 1, 1);

      } else {
        // user is removing a question
        savedQuestions.splice(questionNum - 1, 1);
      }

      // Reset it to 0 since recreation will take care of updating it
      lastQuestionNum = 0;

      // Empty the questionsList since it will be recreated
      $questionList.html('');

      $addQuestion.click();
    }
  });

  $addQuestion.click(function(event) {
    event.preventDefault();
    lastQuestionNum++;

    var templateData = { questionNum: lastQuestionNum };
    $questionList.append(templates.renderQuestionTemplate(templateData));

    $questionList.find('.add-part:last').click();
    // ensure readonly inputs are never focused
    $questionList.children('li:last').find('input[readonly]').focus(function() {
      $(this).blur();
    });

    resizeNav();
  });

  // Called when user is done creating the rubrics. We create the questions,
  // validate them and send them to the server
  $doneRubric.click(function(event) {
    event.preventDefault();
    var questions = createQuestionsList();
    // Doing validation separately to keep the ugly away from the beautiful
    // validateRubrics function is defined in create-exam-validator.js
    var errorMessages = validateRubrics(questions);
    if (errorMessages.length > 0) {
      errorMessages.forEach(function(errorMessage) {
        $('.error').append(errorMessage + '<br />');
      });
      window.scrollTo(0,0);
      return;
    }

    var exam = {
      'questions': questions,
      'gradeDown': gradeDown
    };

    exam = convertKeysToUnderscore(exam);
    $('.exam-json-input').val(JSON.stringify(exam, null, 2));
    $('form').submit();
  });

  // Triggered whenever the user clicks on the checkbox corresponding to
  // grading up or down
  $gradeDownRadio.change(function() {
    gradeDown = $gradeDownRadio.filter(':checked').val() == 'yes';

    var $awardedOrDeducted = $('.awarded-or-deducted');

    if (gradeDown) {
      $awardedOrDeducted.html('deducted');
    } else {
      $awardedOrDeducted.html('awarded');
    }
  });

  // Goes over the inputs and creates the list of questions where each question
  // is a list of parts and each part is of the form:
  // {
  //   points: 10,
  //   pages: 1,2,3,
  //   rubrics: [{description: 'Rubric', points:-5},..]
  // }
  function createQuestionsList() {
    var questions = [];
    var numQuestions = lastQuestionNum;

    for (var i = 0; i < numQuestions; i++) {
      var parts = [];
      questions.push(parts);

      // Get all the parts that belong to the current question
      var $parts = $questionList.children('li').eq(i)
                    .children('div').children('ul').children('li');

      for (var j = 0; j < $parts.length; j++) {
        // By implementation, the first li corresponds to total points and pages
        // for the part we are currently on
        var points = $parts.eq(j).find('.points input').val();
        var pages = $parts.eq(j).find('.pages input').val();

        // Convert CSV of pages to array of integers. First we get rid of the
        // whitespeaces. Then we split them from the commas, so that '1,2,3'
        // will now be ['1', '2', '3']
        // Using the map function, these are then converted to integers to finally
        // get [1,2,3]
        pages = pages.replace(' ', '').split(',').map(function(page) {
          return parseInt(page, 10);
        });

        parts[j] = {
          points: parseFloat(points),
          pages: pages,
          rubrics: []
        };
        var rubrics = parts[j].rubrics;

        // Loop over the rubrics and add those to the part
        var $rubricsLi = $parts.eq(j).children('div').children('ul').children('li');
        for (var k = 0; k < $rubricsLi.length; k++) {
          var description = $rubricsLi.eq(k).find('.rubric-description').val();
          var rubricPoints = $rubricsLi.eq(k).find('.rubric-points').val();

          rubrics.push({
            description: description,
            points: parseFloat(rubricPoints)
          });
        }
      }
    }

    return questions;
  }

});
