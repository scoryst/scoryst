var HistoryView = Backbone.View.extend({
  template: _.template($('.history-template').html()),

  events: {
    'change #id_student_id': 'fetchAndRender'
  },

  initialize: function(options) {
    this.submissions = new SubmissionCollection();
    this.$select = this.$('#id_student_id');
    this.$tbody = this.$('tbody');
  },

  fetchAndRender: function() {
    var self = this;
    var studentId = this.$select.val();

    this.submissions.setStudentId(studentId);
    this.submissions.fetch({
      success: function() {
        self.render();
      }
    });
  },

  render: function() {
    var templateData = { submissions: this.submissions.toJSON() };
    this.$tbody.html(this.template(templateData));
  }
});

$(function() {
  var historyView = new HistoryView({ el: $('.submit') });
  historyView.fetchAndRender();
});
