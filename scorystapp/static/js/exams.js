$(function() {
  var infoPopoverText = 'Once students have been mapped to an exam, that exam' +
    ' can no longer be edited or deleted';

  var $infoPopover = $('.info-popover');
  $infoPopover.popover({ content: infoPopoverText });

  var $delete = $('.delete');
  // Create the popover to warn deletion from roster
  $delete.popoverConfirm();
});
