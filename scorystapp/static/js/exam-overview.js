// TODO (cglu): where else is this file used? shouldn't it just be merged with
// grade overview?

// TODO: Share even more code between the two. I'm guessing this can be done
// better using backbone, etc.

// TODO (cglu) wrap this file in an anonymous function; explicitly expose
// renderExamSummary to global scope by doing:
// window.renderExamSummary = function() {
//  [...]
// };
var $examTemplate = $('.exam-template');
var templates = {
  renderExamTemplate: Handlebars.compile($examTemplate.html())
};

var $examSummary = $('.exam-summary');  // Exam summary table.

// Get JSON data back to render the exam breakdown for the selected student.
function renderExamSummary(userId, examId) {
  $.ajax({
    url: 'get-user-exam-summary/' + userId + '/' + examId + '/',
    dataType: 'json'
  }).done(function(data) {
    $('.table-container').html(templates.renderExamTemplate(data));
    window.resizeNav();
  }).fail(function(request, error) {
    console.log('Error while getting exam summary data: ' + error);
  });
}

// When a button is clicked, go to the correct grade page.
$examSummary.on('click', 'button', function(event) {
  var $target = $(event.currentTarget);
  var examID = $target.parents('tbody').attr('data-exam-answer-id');

  var questionNumber = parseInt($target.parents('tr').attr('data-question'), 10);
  var partNumber = parseInt($target.parents('tr').attr('data-part'), 10);

  // set active question/part number for grade page
  $.cookie('activeQuestionNumber', questionNumber, { expires: 1, path: '/' });
  $.cookie('activePartNumber', partNumber, { expires: 1, path: '/' });

  window.location = examID;
});

$examSummary.on('click', 'a.toggle', function(event) {
  event.preventDefault();

  var $target = $(event.currentTarget);
  var questionNum = parseInt($target.parents('tr').attr('data-question'), 10);

  $('table').find('tr.question-part[data-question=' + questionNum + ']').toggle();
  $target.parents('tr').find('a.toggle').toggle();
});
