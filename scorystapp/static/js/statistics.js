$(function() {
  var $exams = $('.nav.nav-tabs');
  
  var curExamId = $exams.find('li.active a').attr('data-exam-id');
  
  var $statisticsTemplate = $('.statistics-template');
  var $statisticsTable = $('.table-container');

  var templates = {
    renderStatisticsTemplate: Handlebars.compile($statisticsTemplate.html())
  };
  
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

  function renderHistogram(questionNumber, partNumber) {
    var url = curExamId + '/get-histogram/';
    if (questionNumber && partNumber) {
      url += questionNumber + '/' + partNumber + '/';
    } else if (questionNumber) {
      url += questionNumber + '/';
    }

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
    var questionNumber = $tr.children().eq(1).html();
    var partNumber = $tr.children().eq(2).html();
    var $histogramHeader = $('.histogram-header');

    if (questionNumber == 'Total') {
      renderHistogram();
      $histogramHeader.text('Total Scores');
    } else if (questionNumber != 'Question' && partNumber != '-') {
      renderHistogram(questionNumber, partNumber);
      $histogramHeader.text('Question: ' + questionNumber + '.' + partNumber);
    } else if (questionNumber != 'Question') {
      questionNumber = parseInt(questionNumber, 10);
      renderHistogram(questionNumber);
      $histogramHeader.text('Question: ' + questionNumber);
    }

    if ($(event.target).parent('a').length) {
      $tr.find('a.toggle').toggle();
      $('table').find('tr.question-part[data-question=' + questionNumber + ']').toggle();
    }
  });


  // When an exam tab is clicked, update the exam summary.
  $exams.on('click', 'li', function(event) {
    event.preventDefault();
    var $li = $(event.currentTarget);

    $exams.find('li').removeClass('active');
    curExamId = $li.find('a').attr('data-exam-id');
    $li.addClass('active');
    
    renderStatistics();
  });
});
