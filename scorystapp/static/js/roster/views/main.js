var MainView = IdempotentView.extend({
  initialize: function(options) {
    this.constructor.__super__.initialize.apply(this, arguments);
    this.courseUsers = new CourseUserCollection();

    var self = this;
    var $tbody = $('tbody');
    this.courseUsers.fetch({
      success: function() {
        self.courseUsers.forEach(function(courseUser) {
          var $tr = $('<tr></tr>', { 'class': 'course-user-' + courseUser.id });
          $tbody.append($tr);
          self.renderTableRow(courseUser);
        });
        // Changes height of roster to fill the screen.
        self.resizeRosterList();
        self.addTableSorting();
      },

      error: function() {
        // TODO: Log error message.
      }
    });
  },

  renderTableRow: function(courseUser) {
    var tableRowView = new TableRowView({
      el: $('.course-user-' + courseUser.id),
      courseUser: courseUser
    });

    this.registerSubview(tableRowView);
  },

  resizeRosterList: function(event) {
    var height = $('.main').height() - this.$el.offset().top -
      parseInt($('.container.roster').css('margin-bottom'), 10);
    if (height >= this.$el.height()) {
      this.$el.css({'height': height + 'px'});
      this.$el.perfectScrollbar({ suppressScrollX: true });
    }
  },

  addTableSorting: function() {
    // Enable sorting
    this.$('table').tablesorter({
      headers: {
        // assign the fifth column (we start counting zero)
        4: {
          // disable it by setting the property sorter to false
          sorter: false
        }
      },
      // Sort based on privilege first
      sortList: [[3, 0]],
      // For privilege, do not sort alphabetically. Instead, sort
      // instructor/TA/student.
      textExtraction: function(cell) {
        if (cell.innerHTML == 'Instructor') {
          return '0';
        } else if (cell.innerHTML == 'TA') {
          return '1';
        } if (cell.innerHTML == 'Student') {
          return '2';
        }

        return cell.innerHTML;
      }
    });
  }
});

$(function() {
  var mainView = new MainView({
    el: $('.roster-scroll')
  });

  var $manualAdd = $('.manual-add a');
  $manualAdd.click(function(event) {
    $('.manual-add-div').removeClass('hidden');
    event.preventDefault();
  });
});
