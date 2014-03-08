$(function() {
  var $exams = $('.nav.nav-tabs');
  
  var curExamId = $exams.find('li.active a').attr('data-exam-id');
  
  var $statisticsTemplate = $('.statistics-template');
  var $statisticsTable = $('.table-container');
  var $histogramHeader = $('.histogram-header');

  var curQuestionNum = 0;
  var curPartNum = 0;

  var templates = {
    renderStatisticsTemplate: _.template($statisticsTemplate.html())
  };
  
  // Makes an AJAX call to fetch the statistics to be rendered into the table
  function renderStatistics() {
    $.ajax({
      url: curExamId + '/get-statistics/',
      dataType: 'json'
    }).done(function(data) {
      $statisticsTable.html(templates.renderStatisticsTemplate(data));
      window.resizeNav();
    }).fail(function(request, error) {
      console.log('Error while getting exams overview data: ' + error);
    });
  }

  // Makes an AJAX call to fetch the histogram to be displayed
  function renderHistogram(questionNumber, partNumber) {
    var url = curExamId + '/get-histogram/';
    if (questionNumber && partNumber) {
      url += questionNumber + '/' + partNumber + '/';
    } else if (questionNumber) {
      url += questionNumber + '/';
    }

    // If the question and part haven't change, do not re-render
    if (curQuestionNum == questionNumber && curPartNum == partNumber) {
      return;
    }

    curQuestionNum = questionNumber;
    curPartNum = partNumber;

    $.ajax({
      url: url,
      dataType: 'json'
    }).done(function(data) {
      var ctx = $('#histogram')[0].getContext('2d');
      var chartData = {
        labels : data.labels,
        datasets : [
          {
            fillColor : 'rgba(151, 187, 205, 0.5)',
            strokeColor : 'rgba(151, 187, 205, 1)',
            data : data.histogram
          }
        ]
      };
      
      $(window).off('resize', resizer);

      var canvas = '#histogram';
      setupCanvas(canvas, chartData);

      function resizer() {
        setupCanvas(canvas, chartData);
      }
      $(window).resize(resizer);
    
    }).fail(function(request, error) {
      console.log('Error while getting exams overview data: ' + error);
    });
  }

  function setupCanvas(canvas, chartData) {
    $canvas = $(canvas);
    var newWidth = $canvas.parent().width();
    
    $canvas.prop({
      width: newWidth,
      height: 500
    });

    var ctx = $canvas.get(0).getContext('2d');
    new Chart(ctx).Bar(chartData, convertToWholeNumberAxis(chartData));
  }

  // Required to show whole number in the histogram y axis
  function convertToWholeNumberAxis(data) {
    var maxValue = false;
    for (datasetIndex = 0; datasetIndex < data.datasets.length; ++datasetIndex) {
      var setMax = Math.max.apply(null, data.datasets[datasetIndex].data);
       
      if (maxValue === false || setMax > maxValue) {
        maxValue = setMax;
      }
    }

    var steps = maxValue;
    var stepWidth = 1;

    if (maxValue > 10) {
      stepWidth = Math.floor(maxValue / 10);
      steps = Math.ceil(maxValue / stepWidth);
    }
    
    return {
      scaleOverride: true,
      scaleSteps: steps,
      scaleStepWidth: stepWidth,
      scaleStartValue: 0
    };
  }

  renderStatistics();
  renderHistogram();
  
  $statisticsTable.on('click', 'tr', function(event) {
    event.preventDefault();
    var $tr = $(event.currentTarget);
    var questionNumber = $tr.find('.question-number').html();
    var partNumber = $tr.find('.part-number').html();
    var $selected = $('.selected');

    if (questionNumber === 'Total') {
      renderHistogram();
      $histogramHeader.text('Total Scores');
    } else if (questionNumber && partNumber) {
      renderHistogram(questionNumber, partNumber);
      $histogramHeader.text('Question: ' + questionNumber + '.' + partNumber);
    } else if (questionNumber) {
      renderHistogram(questionNumber);
      $histogramHeader.text('Question: ' + questionNumber);
    }

    // Check if the collapse/expand button (for showing parts' statistics) is clicked
    // and toggle the UI accordingly
    if ($(event.target).parent('a').length) {
      $tr.find('a.toggle').toggle();
      $('table').find('tr.question-part[data-question=' + questionNumber + ']').toggle();
    }

    $selected.removeClass('selected');
    $tr.addClass('selected');
  });


  // When an exam tab is clicked, update the exam summary.
  $exams.on('click', 'li', function(event) {
    event.preventDefault();
    var $li = $(event.currentTarget);

    $exams.find('li').removeClass('active');
    curExamId = $li.find('a').attr('data-exam-id');
    $li.addClass('active');
    
    renderStatistics();
    // Reset them to zero
    curQuestionNum = 0;
    curPartNum = 0;
    $histogramHeader.text('Total Scores');
    renderHistogram();
  });
});
