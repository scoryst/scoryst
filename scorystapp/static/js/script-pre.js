$(function() {
  var $container = $('.container');
  var $nav = $('nav');
  var origNavHeight = $nav.height();

  /* This function calculates and sets the height of the navigation bar. */
  window.resizeNav = function() {
      // the height of the page excluding the header and footer
      var contentHeight = $container.outerHeight(true);

      // the height of the browser
      var viewportHeight = $(window).height() - $('header').height() - $('footer').height();

      // ensure the nav takes up the entire content/viewport space
      var navHeight = Math.max(viewportHeight, contentHeight, origNavHeight);
      $nav.height(navHeight);
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

  // reload collapsed nav setting
  var $main = $('.main');
  if ($.cookie('navCollapsed')) {
    $main.addClass('collapsed-nav');
  }

  // allow user to collapse nav
  $('.collapse-nav').click(function(event) {
    event.preventDefault();
    $main.toggleClass('collapsed-nav');

    // save setting
    $.cookie('navCollapsed', $main.hasClass('collapsed-nav'), { path: '/' });
  });

  // Prefilters ajax calls that have json as the datatype and converts all
  // keys in the options.data object to camel_case from camelCase.
  // Specify an option 'maintainKeys' to True if you want to disable this.
  $.ajaxPrefilter('json', function(options) {
    if (!options.maintainKeys && options.data) {
      var data = $.parseJSON(options.data);
      data = convertKeysToUnderscore(data);
      options.data = JSON.stringify(data);
    }
  });

  // Recursively converts all they keys in data to underscore, where
  // data could be an object, an array of objects, or anything.
  // In case it's an array, it recursively calls convertKeysToUnderscore
  // on each index. If data is neither an array nor an object, it simply
  // returns data.
  window.convertKeysToUnderscore = function(data) {
    if ($.type(data) === 'array') {
      for (var i = 0; i < data.length; i++) {
        data[i] = convertKeysToUnderscore(data[i]);
      }
    } else if ($.type(data) === 'object') {
      var newData = {};
      $.each(data, function(key, value) {
        var newKey = convertCamelCaseStringToUnderscore(key);
        newData[newKey] = convertKeysToUnderscore(value);
      });
      return newData;
    } else {
      // String or number or some other type, do nothing
    }
    return data;
  }

  // patternOne puts an underscore before a block of text beginning with
  // one Capital letter and all others small.
  // eg. If we had JSONObjectHi, patternOne would change it to JSON_Object_Hi
  var patternOne = new RegExp(/(.)([A-Z][a-z]+)/g);

  // patternTwo puts an underscore if it sees a lowercase alphabet or a digit
  // before a capital letter. This is needed for cases like helloJSON to
  // be converted to hello_json since they won't be captured by patternOne.
  var patternTwo = new RegExp(/([a-z\d])([A-Z])/g);

  function convertCamelCaseStringToUnderscore(str) {
    str = str.replace(patternOne, '$1_$2');
    return str.replace(patternTwo, '$1_$2').toLowerCase();
  }

});
