(function(window, document, undefined) {
  var ViewUtils = {};

  // whether a student is viewing the grade page
  ViewUtils.IS_STUDENT_VIEW = /exams\/view\/(\d+)\/$/.test(window.location.href);

  window.ViewUtils = ViewUtils;
})(this, this.document);
