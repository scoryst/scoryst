$(function() {
  var $helpNav = $('.help-nav');
  var $helpNavLi = $helpNav.find('li');

  var offset = $helpNav.offset();
  var initialOffsetLeft = offset.left;
  var initialOffsetTop = offset.top;
  var PADDING_TOP = 10;

  var curProgrammaticallyScrolling = false;


  // Decide whether to show the alert to the user to watch the intro video
  if (!localStorage || !localStorage.removedHelp) {
    $('.alert').show();
  }

  // If the user closes the alert, don't show it again even with page refreshes
  $('.alert').on('closed.bs.alert', function() {
    if (localStorage) {
      localStorage.removedHelp = true;
    }
  })


  $(window).scroll(function(event) {
    // Allow the navigation bar to stick to the top during scroll
    var windowScrollTop = $(window).scrollTop();
    if (windowScrollTop > initialOffsetTop) {
      $helpNav.offset({top: windowScrollTop + PADDING_TOP, left: initialOffsetLeft});
    } else {
      $helpNav.offset({top: initialOffsetTop, left: initialOffsetLeft});
    }

    // Select the correct list element
    if (!curProgrammaticallyScrolling) {
      var closestOffset = Infinity;
      var $closestH3 = null;
      $('h3').each(function() {
        var $h3 = $(this);

        var curOffset = $h3.offset().top - windowScrollTop;
        if ((curOffset > 0 && curOffset < closestOffset) ||
            (curOffset < 0 && curOffset < Math.abs(closestOffset))) {
          $closestH3 = $h3;
          closestOffset = curOffset;
        }
      });

      $helpNavLi.removeClass('active');
      var dataTarget = $closestH3.attr('class');
      $('li[data-target="' + dataTarget + '"]').addClass('active');
    }
  });


  // Capture navbar click events
  $helpNavLi.click(function(event) {
    curProgrammaticallyScrolling = true;
    event.preventDefault();
    var $clickedLi = $(this);
    // First check is to ensure a new li was clicked. The second check is to
    // ensure that the headings were not clicked.
    if (!$clickedLi.hasClass('active') && $clickedLi.find('a').length > 0) {
      $helpNavLi.removeClass('active');
      $(this).addClass('active');

      // Scroll to the appropriate point in the page
      var dataTarget = $clickedLi.attr('data-target');
      var $toScroll = $('h3.' + dataTarget);
      $('html, body').animate({
          scrollTop: $toScroll.offset().top + 1
      }, 500, function() {
        $clickedLi.click();
        curProgrammaticallyScrolling = false;
      });
    }
  });

  $('a.to-scroll').click(function(event) {
    event.preventDefault();

    var $clickedLink = $(event.currentTarget);
    var $toScroll = $($clickedLink.attr('href'));
    $('html, body').animate({
        scrollTop: $toScroll.offset().top + 1
    });
  });

});
