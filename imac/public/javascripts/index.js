$(document).ready(function () {
   $('.archive-toggle').on('click', function () {
      var $button = $(this);
      var message_string = ($button.html() == 'archive') ? 'Project archived.' : 'Project restored.';

      var action_url = $button.attr('href');

      $.ajax(action_url)
         .done(function (msg) {
            console.log(msg);
            $button.closest('.project').fadeOut();
            noty({
               type: 'success',
               text: message_string
            });
         });
   });

   $('.export-adjudications').on('click', function () {
      var $button = $(this);
      var action_url = $button.attr('href');

      $.ajax(action_url)
         .done(function (results) {
            if (results.messages) {
               displayStatusMessages(results.messages);
            } else {
               window.location.href = action_url;
            }
         });
   });

   $('.pending-setup-info').on('click', function () {
      noty({
         type: 'info',
         layout: 'center',
         timeout: false,
         modal: true,
         buttons: [{
            text: 'Got it!', onClick: function ($noty) {
               $noty.close()
            }
         }],
         text: "To move a project out of 'pending': <br><br>1. Click 'import queries' to import your data into the project, then...<br>2. Click 'edit' and create a Field Layout.<br><br> Your project will immediately be available for adjudication for all users."
      });
   });
});