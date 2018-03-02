$(document).ready(function () {
   // Validate passwords on changing out of the password field
   $('#password, #password-confirm').blur(function (event) {
      validatePasswords();
   });

   // Catch submission via 'enter' key
   $('input').keypress(function (e) {
      if (e.which == 13) {
         e.preventDefault();
         var $create_button = $('input[type=submit]');
         validatePasswords();
         $create_button.click();
      }
   });
});