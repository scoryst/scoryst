var IdempotentView = Backbone.View.extend({
  initialize: function(options) {
    this.handlers = [];
    this.subviews = [];
  },

  /* Removes all side-effects of this view and sub-views. */
  removeSideEffects: function() {
    this.deregisterSubview();
    this.undelegateEvents();
    this.stopListening();
    this.stopListeningToDOM();
  },

  /* Registers a sub-view of this view. */
  registerSubview: function(view) {
    this.subviews.push(view);
  },

  /* Deregisters a sub-view of this view, or all subviews if no view is passed. */
  deregisterSubview: function(view) {
    if (view) {
      view.removeSideEffects();
      this.subviews = this.subviews.filter(function(subview) {
        return subview !== view;
      });
    } else {
      var self = this;
      _.each(this.subviews, function(subview) {
        self.deregisterSubview(subview);
      });
    }
  },

  /* Listens for the given event on the provided DOM element. Handles the
   * event by calling handler in the context of the current view. */
  listenToDOM: function($el, event, selector, handler) {
    // selector may be omitted
    if (_.isFunction(selector)) {
      handler = selector;
      selector = null;
    }

    // ensure context of handler is this view
    var boundHandler = _.bind(handler, this);

    if (selector) {
      $el.on(event, selector, boundHandler);
    } else {
      $el.on(event, boundHandler);
    }

    // keep track of handlers
    this.handlers.push({
      $el: $el,
      event: event,
      selector: selector,
      fn: boundHandler,
      str: handler.toString()
    });
  },

  /* Stops listening to all DOM events. */
  stopListeningToDOM: function() {
    _.each(this.handlers, function(handler) {
      if (handler.selector) {
        handler.$el.off(handler.event, handler.selector, handler.fn);
      } else {
        handler.$el.off(handler.event, handler.fn);
      }
    });

    this.handlers = [];
  }
});
