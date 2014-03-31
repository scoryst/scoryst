$(function() {
  // The validation process is a bit complicated. Firstly, if any question
  // is completely empty (nothing filled in at all), we ignore it and delete it.
  // We do the same if any part is completely empty or any rubric is completely empty
  //
  // Now, once that is done, we report errors if
  // - Nothing entered at all
  // - Partially entered question/part/rubric
  window.validateRubrics = function(questions) {
    // If a question is empty, replace it with null. We will delete it at the end.
    nullifyEmptyList(questions, isQuestionEmpty);
    var errors = [];

    // Nothing entered at all
    if (isEmpty(questions)) {
      errors.push('Nothing entered at all');
    }

    for (var i = 0; i < questions.length; i++) {
      var question = questions[i];
      // Ignore the questions that will be deleted
      if (question === null) {
        continue;
      }

      // Nullify all the empty parts in the question
      nullifyEmptyList(question, isPartEmpty);

      clearErrors();
      for (var j = 0; j < question.length; j++) {
        var part = question[j];
        // Ignore the parts that will be deleted
        if (part === null) {
          continue;
        }

        var $li = $('li[data-question="' + (i + 1) + '"][data-part="' + (j + 1) + '"]');
        if (isNaN(part.points)) {
          errors.push('Question ' + (i + 1) + ' Part ' + (j + 1) + ': Invalid points');
          $li.find('.form-group.points').addClass('has-error');
        }
        if (isIntegerArrayInvalid(part.pages)) {
          errors.push('Question ' + (i + 1) + ' Part ' + (j + 1) + ': Invalid page(s)');
          $li.find('.form-group.pages').addClass('has-error');
        }

        nullifyEmptyList(part.rubrics, isRubricEmpty);

        if (isEmpty(part.rubrics)) {
          errors.push('Question ' + (i + 1) + ' Part ' + (j + 1) + ': No rubrics entered');
        }

        for (var k = 0; k < part.rubrics.length; k++) {
          var rubric = part.rubrics[k];
          if (rubric === null) {
            continue;
          }
          if (isBlank(rubric.description)) {
            errors.push('Question ' + (i + 1) + ' Part ' + (j + 1) + ' Rubric ' +
              (k + 1) + ': Description cannot be blank');
            $li.find('li.rubric-li').eq(k).find('.form-group-rubric-description'
              ).addClass('has-error');
          }

          if (isNaN(rubric.points)) {
            errors.push('Question ' + (i + 1) + ' Part ' + (j + 1) + ' Rubric ' +
             (k + 1) + ': Invalid points');
            $li.find('li.rubric-li').eq(k).find('.form-group-rubric-points'
              ).addClass('has-error');
          }
        }
      }
    }

    // Time to delete everything that was made null
    removeEmptyList(questions);
    for (var i = questions.length - 1; i >= 0; i--) {
      removeEmptyList(questions[i]);
      for (var j = questions[i].length - 1; j >= 0; j--) {
        removeEmptyList(questions[i][j].rubrics);
      }
    }
    return errors;
  }

  // Nullifies each element of the list for which emptyFn(listElement)
  // returns true
  function nullifyEmptyList(list, emptyFn) {
    for (var i = 0; i < list.length; i++) {
      if (emptyFn(list[i])) {
        list[i] = null;
      }
    }
  }

  function isEmpty(list) {
    for (var i = 0; i < list.length; i++) {
      if (list[i] !== null) {
        return false;
      }
    }
    return true;
  }

  function removeEmptyList(list) {
    for (var i = list.length - 1; i >= 0; i--) {
      if (list[i] === null) {
        list.splice(i, 1);
      }
    }
  }

  function isQuestionEmpty(question) {
    for (var i = 0; i < question.length; i++) {
      if (!isPartEmpty(question[i])) {
        return false;
      }
    }
    return true;
  }

  function isPartEmpty(part) {
    return (isNaN(part.points) && isIntegerArrayInvalid(part.pages) &&
            allRubricsEmpty(part.rubrics));
  }

  function allRubricsEmpty(rubrics) {
    for (var i = 0; i < rubrics.length; i++) {
      if (!isRubricEmpty(rubrics[i])) {
        return false;
      }
    }
    return true;
  }

  function isRubricEmpty(rubric) {
    return isBlank(rubric.description) && isNaN(rubric.points);
  }

  // Returns true if any entry of the array is NaN
  function isIntegerArrayInvalid(arr) {
    if (arr.length === 0) return true;
    for (var i = 0; i < arr.length; i++) {
      if (isNaN(arr[i])) {
        return true;
      }
    }
    return false;
  }

  function isBlank(str) {
    return (!str || /^\s*$/.test(str));
  }

  function clearErrors() {
    $('.error').html('');
    $('.form-group').each(function() {
      $(this).removeClass('has-error');
    })
  }

});
