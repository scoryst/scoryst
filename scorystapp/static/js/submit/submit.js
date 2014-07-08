$(function() {
  $('.finalized-info-popover').popover();
  var fileSizeExceededTemplate = _.template($('.file-size-exceeded-template').html());

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
    var BYTES_IN_MB = 1024 * 1024;

    // When the form is submitted, check the file size. If the file size is
    // bigger than MAX_FILE_SIZE, prevent the submission and display an error
    $uploadForm.submit(function(event) {
      var $homeworkFile = $('#id_homework_file');
      var fileSize = $homeworkFile[0].files[0].size / BYTES_IN_MB;
      // Round up to nearest hundredth for display purposes
      fileSize = Math.ceil(fileSize * 100) / 100;

      if (fileSize > MAX_FILE_SIZE) {
        $homeworkFile.next('.error').html(fileSizeExceededTemplate({
          MAX_FILE_SIZE: MAX_FILE_SIZE,
          fileSize: fileSize
        }));
        event.preventDefault();
      }
    });
  }
});
