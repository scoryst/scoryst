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
});
