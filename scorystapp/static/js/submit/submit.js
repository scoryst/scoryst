$(function() {
  $('.finalized-info-popover').popover();

  var pdfInfoPopoverText = 'Not sure how to create a PDF? ' +
    'Just follow the instructions below.';

  var $pdfInfoPopover = $('.pdf-info-popover');
  $pdfInfoPopover.popover({ content: pdfInfoPopoverText });

  var $createPdfInfo = $('.create-pdf-info');
  // When the popover is being displayed, highlight the part that gives
  // instructions on how to create PDFs
  $pdfInfoPopover.on('shown.bs.popover', function () {
    $createPdfInfo.addClass('highlighted');
  });

  $pdfInfoPopover.on('hidden.bs.popover', function () {
    $createPdfInfo.removeClass('highlighted');
  });

  // Check for File API support
  if (window.FileReader && window.File && window.FileList && window.Blob) {
    var $uploadForm = $('.upload-exam');
    // In MB
    var MAX_FILE_SIZE = 40;

    // When the form is submitted, check the file size
    // If the file size > MAX_FILE_SIZE, prevent the submission and display
    // an appropriate error message
    $uploadForm.submit(function(event) {
      var $homeworkFile = $('#id_homework_file');
      var file_size = $homeworkFile[0].files[0].size / 1024 / 1024;
      // Round up to nearest hundredth for display purposes
      file_size = Math.ceil(file_size * 100) / 100;

      if (file_size > MAX_FILE_SIZE) {
        var error = 'Max size allowed is ' + MAX_FILE_SIZE + ' MB but file size is '
          + file_size + ' MB. ';
        error += 'You may try <a href="http://smallpdf.com/compress-pdf" target="_blank">' +
          'this link</a> to compress the pdf size.';
        $homeworkFile.next('.error').html(error);
        event.preventDefault();
      }
    });
  }
});
