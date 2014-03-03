(function(window, document, undefined) {
  var ModelUtils = {};

  // retrieve CSRF token
  $.cookie.raw = true;
  ModelUtils.CSRF_TOKEN = $.cookie('csrftoken');
  $.cookie.raw = false;

  /* Adds the CSRF token to the given request. */
  ModelUtils.beforeSendCSRFHandler = function(xhr) {
    xhr.setRequestHeader('X-CSRFToken', ModelUtils.CSRF_TOKEN);
  };

  // whether a student is viewing the grade page
  ModelUtils.IS_STUDENT_VIEW = /exams\/view\/(\d+)\/$/.test(window.location.href);

  window.ModelUtils = ModelUtils;
})(this, this.document);
