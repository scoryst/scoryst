var TableRowView = IdempotentView.extend({
  templates: {
    rosterTemplate: _.template($('.roster-template').html()),
    editRosterTemplate: _.template($('.edit-roster-template').html()),
  },

  events: {
    'click a.save': 'saveRoster',
    'click a.edit': 'editRoster'
  },

  initialize: function(options) {
    this.constructor.__super__.initialize.apply(this, arguments);
    this.courseUser = options.courseUser;
    this.render();
  },

  render: function() {
    var templateData = this.courseUser.toJSON();
    this.$el.html(this.templates.rosterTemplate(templateData));
  },

  editRoster: function(event) {
    event.preventDefault();

    var privilege = this.$el.find('.privilege').html();
    this.$el.html(this.templates.editRosterTemplate({
      firstName: this.$el.find('.first-name').html(),
      lastName: this.$el.find('.last-name').html(),
      studentId: this.$el.find('.student-id').html(),
      currentlyIsInstructor: privilege === 'Instructor',
      currentlyIsTA: privilege === 'TA',
      currentlyIsStudent: privilege === 'Student',
      course: this.courseUser.toJSON().course,
      id: this.courseUser.id
    }));

    this.addPopover();
  },

  saveRoster: function(event) {
    event.preventDefault();

    var privilege = this.$el.find('.privilege').find('select option').filter(':selected').val();
    var self = this;
    this.courseUser.save({
      user: {
        firstName: this.$el.find('.first-name').val(),
        lastName: this.$el.find('.last-name').val(),
        studentId: this.$el.find('.student-id').val()
      },
      privilege: privilege
    }, {
      success: function() {
        self.render();
      },
      wait: true
    });
  },

  addPopover: function() {
    // Create the popover to warn deletion from roster
    $('.delete').popoverConfirm({ placement: 'left' });
  }
});
