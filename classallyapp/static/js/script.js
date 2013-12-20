$(function() {
  /* This function calculates and sets the height of the navigation bar. */
  window.resizeNav = function() {
      /* The height of the page excluding the header and footer. */
      var contentHeight = $('.container').outerHeight(true);
      var viewportHeight = $(window).height() - $('header').height() - $('footer').height();
      /* If the viewport is larger than the content, the nav fills the viewport. Otherwise,
       * the nav is at least the size of the content. */
      var navHeight = Math.max(viewportHeight, contentHeight);
      $('nav').height(navHeight);
  };

  resizeNav();
  $(window).resize(resizeNav);

  // show dropdown menu on hover
  $('.dropdown').hover(function() {
    $(this).children('.dropdown-menu').show();
  }, function() {
    $(this).children('.dropdown-menu').hide();
  });

  // allows us to store objects in cookies
  $.cookie.json = true;

  var invisibleCourses = $.cookie('invisibleCourses');
  if (typeof invisibleCourses !== 'object') {
    // default to all visible courses
    invisibleCourses = {};
  }

  $('.course').click(function() {
    var $course = $(this);
    var courseId = $course.data('id');
    var showedCourse = toggleCourse($course);

    // update cookie that tracks invisible courses
    if (showedCourse) {
      delete invisibleCourses[courseId];
    } else {
      invisibleCourses[courseId] = true;
    }

    $.cookie('invisibleCourses', invisibleCourses, { path: '/' });
  });

  // show/hide courses based off past user preferences
  $('.course').each(function() {
    var $course = $(this);
    var courseId = $course.data('id');

    // all courses are visible by default; hide those the user doesn't want shown
    if (invisibleCourses[courseId]) {
      toggleCourse($course);
    }
  });

  /* Toggles the visibility of the given course. Returns true if it showed the
   * course or false if it hid it. */
  function toggleCourse($course) {
    var $nextLi = $course.next();
    var shouldShow = $nextLi.is(':hidden');

    // show/hide course links when course is clicked
    while ($nextLi.length !== 0 && !$nextLi.hasClass('course')) {
      if (shouldShow) {
        $nextLi.show();
      } else {
        $nextLi.hide();
      }

      $nextLi = $nextLi.next();
    }

    // update styles
    if (shouldShow) {
      $course.removeClass('contracted');
    } else {
      $course.addClass('contracted');
    }

    return shouldShow;
  }
});
