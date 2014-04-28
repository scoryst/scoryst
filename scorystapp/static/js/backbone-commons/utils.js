(function(window, document, undefined) {
  var Utils = {};

  // retrieve CSRF token
  $.cookie.raw = true;
  Utils.CSRF_TOKEN = $.cookie('csrftoken');
  $.cookie.raw = false;

  /* Adds the CSRF token to the given request. */
  Utils.beforeSendCSRFHandler = function(xhr) {
    xhr.setRequestHeader('X-CSRFToken', Utils.CSRF_TOKEN);
  };

  // whether a student is viewing the grade page
  Utils.IS_STUDENT_VIEW = /exams\/view/.test(window.location.href);

  // whether the exam is being previewed
  Utils.IS_PREVIEW = /exams\/preview/.test(window.location.href);

  window.Utils = Utils;
})(this, this.document);
