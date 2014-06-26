$(function() {
  var $rest = $('.feedback-rest');
  var $title = $('.feedback-title');
  var $submit = $('.feedback-submit');
  var $textarea = $('.feedback textarea');

  var $more = $('.feedback-more');

  // When the title is clicked, show the rest of the feedback box/ hide it
  $title.click(function() {
    $rest.toggle();
  });

  // The user submitted the feedback, so make an AJAX call and then thank the user
  $submit.click(function() {
    var feedback = $textarea.val();
    if (isBlank(feedback)) {
      return;
    }

    var csrftoken = $.cookie('csrftoken');

    $.ajax({
      type: 'POST',
      url: '/feedback/',
      data: {
        'csrfmiddlewaretoken': csrftoken,
        'feedback': feedback
      },

      success: function(data) {
        $textarea.val('');
        toggleGiveFeedbackThank();
      }
    });
  });

  // The user wants to give more feedback
  $more.click(function() {
    toggleGiveFeedbackThank();
  });

  // Toggle between showing the give feedback view and thanking the user
  function toggleGiveFeedbackThank() {
    $('.feedback-give').toggle();
    $('.feedback-thank').toggle();
  }

  function isBlank(str) {
    return (!str || /^\s*$/.test(str));
  }
});
