// ImageLoader class handles asynchronously loading jpegs as well as preloading
// images for better performance. In case of errors, it also handles showing
// a loading gif and periodically attempting to fetch the image again
// 
// Arguments:
// curPageNum: page number to be initially loaded. If it is undefined, then we don't
// initially load anything
// 
// preloadPageConfig: An object of the form:
// { preloadPage: true, prefetchNumber: 2 }
// where preloadPage is true if we want to preload previous and next pages for 
// the current student and prefetchNumber is the number of pages we want preloaded
// in either direction. prefetchNumber is 4 by default.
// 
// preloadStudentConfig: An object of the form:
// { preloadStudent: true, prefetchNumber: 2, useQuestionPartNum: true }
// where preloadStudent is true if we want to preload previous and next students,
// prefetchNumber is the same as above and useQuestionPartNum is set to true
// if we want to preload next and previous students such that the page loaded
// has the same question number and part number as the current page. 
// If it is true, an ajax call of the form:
// get-student-jpeg/' + offsetFromCurrent + '/' curQuestionNum + '/' + curPartNum
// will be made. 
// If it is false, an ajax call of the form:
// get-student-jpeg/' + offsetFromCurrent + '/' curPageNum will be made
// 
// 
function ImageLoader(curPageNum, preloadPageConfig, preloadStudentConfig) {
  var $examCanvas = $('.exam-canvas');
  $examCanvas.empty();
  this.$canvas = $('<img />').appendTo($examCanvas);

  // TODO: fix this hack by adding a template
  this.$zoomLens = $('<div />').addClass('zoom-lens');
  this.$zoomImg = $('<img />').appendTo(this.$zoomLens);
  this.$zoomLens.appendTo($examCanvas);

  // Needed for resizing page navigation etc.
  this.$window = $(window);
  this.$previousPage = $('.previous-page');
  this.$nextPage = $('.next-page');

  this.curPageNum = curPageNum;
  this.preloadPage = preloadPageConfig ? preloadPageConfig.preloadPage : false;

  if (this.preloadPage) {
    this.preloadPageConfig = preloadPageConfig;
  }

  this.preloadStudent = preloadStudentConfig ? preloadStudentConfig.preloadStudent : false;
  if (this.preloadStudent) {
    this.preloadStudentConfig = preloadStudentConfig;
  }

  // Makes an ajax call and updates the number of pages associated with the pdf
  this.asyncSetNumPages();
  if (this.curPageNum) {
    this.showPage(this.curPageNum);
  }

  var loadSrc = '/static/img/loading_big.gif';
  var obj = this;

  obj.$canvas.load(function() {
    // We may fail multiple times in loading the image, however, we don't
    // want to call resize and resizePageNavigation each time
    if (this.src.indexOf(loadSrc) < 0 || !this.resized) {
      this.resized = true;
      obj.$window.resize();
      obj.resizePageNavigation();
    }
  });

  obj.$canvas.error(function() {

    this.src = loadSrc;

    // Since loading the image failed, we will once again try to load it after 2 seconds
    obj.timer = window.setTimeout(function() {
      obj.loadImage();
    }, 2000);

  });

  this.handleZoomEvents();
}

// Default number of previous and next exam/student images that will be prefetched
ImageLoader.PREFETCH_NUMBER = 4;

// Sets the number of pages associated with the exam being shown
// Needed so that we don't go past the last page
ImageLoader.prototype.asyncSetNumPages = function() {
  var obj = this;
  $.ajax({
    url: 'get-exam-page-count/',
    dataType: 'text'
  }).done(function(data) {
    obj.numPages = parseInt(data, 10);
    // Needed in the case that numPages wasn't set and user already tried to go to
    // a page beyond it.
    if (obj.curPageNum > obj.numPages) {
      obj.showPage(obj.numPages);
    }
  }).fail(function(request, error) {
    console.log(error);
  });
};

// Shows the page corresponding to pageNum. If the server returns an error, 
// shows a loading gif and attempts to load the image again after a set interval
// curQuestionNum and curPartNum are only needed if we are preloading
// jpegs for next and previous students and useQuestionPartNum is true
ImageLoader.prototype.showPage = function(pageNum, curQuestionNum, curPartNum) {
  var obj = this;
  if (pageNum < 1 || pageNum > obj.numPages) return;
  obj.curPageNum = pageNum;
  
  obj.loadImage();
  obj.preloadImages(curQuestionNum, curPartNum);
};

// Attempts to load image corresponding to page given by pageNum, and shows loading gif
// in case of failure
ImageLoader.prototype.loadImage = function() {
  // Resize after showing the loading gif
  this.resized = false;
  this.$canvas.attr('src', 'get-exam-jpeg/' + this.curPageNum);
  this.$zoomImg.attr('src', 'get-exam-jpeg/' + this.curPageNum);
};

// Shows the page at offset from the current page. Use it when you wish to go to
// previous and next pages by specifying an offset of -1 and +1.
ImageLoader.prototype.showPageFromCurrent = function(offset, curQuestionNum, curPartNum) {
  this.showPage(this.curPageNum + offset, curQuestionNum, curPartNum);
};

// Called from showPage() to preload images
ImageLoader.prototype.preloadImages = function(curQuestionNum, curPartNum) {
  if (this.preloadPage) {
    this.preloadPageImages();
  }

  if (this.preloadStudent) {
    this.preloadStudentImages(curQuestionNum, curPartNum);
  }
};

// Used to preload previous and next pages for the current student
ImageLoader.prototype.preloadPageImages = function() {
  
  var prefetchNumber = this.preloadPageConfig.prefetchNumber || ImageLoader.PREFETCH_NUMBER;
  var curPageNum = this.curPageNum;

  var firstPrefetchIndex = curPageNum - prefetchNumber;
  var lastPrefetchIndex = curPageNum + prefetchNumber;

  // Ensure we don't load non-positive indices
  if (firstPrefetchIndex <= 0) {
    firstPrefetchIndex = 1;
  }
  
  // Ensure we don't load indices past the last page
  if (this.numPages && lastPrefetchIndex > this.numPages) {
    lastPrefetchIndex = this.numPages;
  }

  // Cache the images from the URLs
  var images = [];
  for (var i = firstPrefetchIndex; i <= lastPrefetchIndex; i++) {
    images[i] = new Image();
    images[i].src = 'get-exam-jpeg/' + i;
  }
};

// Used to preload previous and next students
ImageLoader.prototype.preloadStudentImages = function(curQuestionNum, curPartNum) {
  var useQuestionPartNum = this.preloadStudentConfig.useQuestionPartNum;
  if (useQuestionPartNum) {
    this.preloadStudentImagesUsingQuestionPartNum(curQuestionNum, curPartNum);
  } else {
    this.preloadStudentImagesUsingPageNum();
  }
};

// If we are on question Q part P of a student's exams, this will load
// the page containing question Q part P of previous and next students irrespective 
// of whether or not the same question/part is on different pages for those students
ImageLoader.prototype.preloadStudentImagesUsingQuestionPartNum = 
    function(curQuestionNum, curPartNum) {
  
  var questionNum = curQuestionNum || 1;
  var partNum = curPartNum || 1;
  var prefetchNumber = this.preloadStudentConfig.prefetchNumber || ImageLoader.PREFETCH_NUMBER;

  // Cache the images
  var images = [];
  for (var i = -prefetchNumber; i <= prefetchNumber; i++) {
    images[i] = new Image();
    // get-student-jpeg/' + offsetFromCurrent + '/' + curQuestionNum + '/' + curPartNum
    images[i].src = 'get-student-jpeg/' + i + '/' + questionNum + '/' + partNum;
  }
};

// If we are on page 5 of a student's exams, this will load page 5 of previous
// and next students irrespective of whether or not the same question/part is
// on page 5 for those students
ImageLoader.prototype.preloadStudentImagesUsingPageNum = function() {
  var prefetchNumber = this.preloadStudentConfig.prefetchNumber || ImageLoader.PREFETCH_NUMBER;
  
  // Cache the images
  var images = [];
  for (var i = -prefetchNumber; i <= prefetchNumber; i++) {
    images[i] = new Image();
    // get-student-jpeg/' + offsetFromCurrent + '/' curPageNum
    images[i].src = 'get-student-jpeg/' + i + '/' + this.curPageNum;
  }
};

// Resizes the page navigation to match the canvas height.
ImageLoader.prototype.resizePageNavigation = function() {
  this.$previousPage.height(this.$canvas.height());
  this.$nextPage.height(this.$canvas.height());
};

ImageLoader.prototype.handleZoomEvents = function() {
  var self = this;

  this.$canvas.mouseenter(function() {
    self.$zoomLens.show();
  });

  this.$canvas.mouseleave(function() {
    self.$zoomLens.hide();
  });

  this.$canvas.mousemove(function(event) {
    var y = event.offsetY;
    var x = event.offsetX;

    /* TODO: fix hardcoded values (important). */
    var topOffset = -(y - 50) * 2200 / 871;
    var leftOffset = -(x - 50) * 1700 / 673;

    self.$zoomLens.css('top', y + 20);
    self.$zoomLens.css('left', x + 20);
    self.$zoomImg.css('top', topOffset);
    self.$zoomImg.css('left', leftOffset);
  });
};
