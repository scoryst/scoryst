// TODO: browserify
var CommentView = IdempotentView.extend({
  /* How long to display the comment success icon. */
  COMMENT_SUCCESS_DISPLAY_DURATION: 1000,

  template: _.template($('.comment-template').html()),
  events: {
    'click .save-comment': 'saveComment',
    'click .edit-comment': 'editComment',
    'click .delete-comment': 'deleteComment'
  },

  /* Initializes this comment. Requires a QuestionPartAnswer model. */
  initialize: function(options) {
    this.constructor.__super__.initialize.apply(this, arguments);
    this.listenTo(this.model, 'change:graderComments', this.render);
  },

  render: function() {
    var questionPartAnswer = this.model.toJSON();
    this.$el.html(this.template(questionPartAnswer));
    return this;
  },

  editComment: function(event) {
    this.$('.save-comment').removeClass('hidden');
    this.$('.edit-comment').addClass('hidden');
    this.$('.comment-textarea').removeAttr('disabled');
  },

  /* Saves the comment the user has entered for the custom points field. */
  saveComment: function(event) {
    var comment = this.$('.comment-textarea').val();
    if (!comment) return;
    var self = this;

    this.model.save({ graderComments: comment }, {
      success: function() {
        self.showCommentSuccess();
        self.$('.save-comment').addClass('hidden');
        self.$('.edit-comment').removeClass('hidden');

        self.$('.comment-textarea').val(comment);
        self.$('.comment-textarea').attr('disabled', 'disabled');
      },

      error: function() {
        // TODO: error handler
      },

      wait: true
    });
  },

  /* Deletes the comment the user entered for the custom points field. */
  deleteComment: function(event) {
    event.preventDefault();
    this.model.save({ graderComments: null }, { wait: true });

    this.$('.save-comment').removeClass('hidden');
    this.$('.edit-comment').addClass('hidden');
    this.$('.comment-textarea').removeAttr('disabled');
  },

  /* Shows the comment success icon briefly, and then hides it. */
  showCommentSuccess: function() {
    var $commentSuccessIcon = this.$('.comment-success');
    $commentSuccessIcon.show();

    setTimeout(function() {
      $commentSuccessIcon.hide();
    }, this.COMMENT_SUCCESS_DISPLAY_DURATION);
  }
});
