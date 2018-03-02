$(document).ready(function () {
   // Validate passwords on changing out of the password field
   $('#password, #password-confirm').blur(function (event) {
      validatePasswords();
   });
   $('#username').blur(function () {
      validateUsername();
   });

   $('input').keypress(function (e) {
      if (e.which == 13) {
         e.preventDefault();
         var $create_button = $('#create-button');
         validatePasswords();
         validateUsername().then(function(){
            $create_button.click();
         });

      }
   });


});

function validateUsername() {
   var $username = $('#username');
   var username = $username.val();

   if(username != ''){
      return $.get('/validate-username/' + username, function (isValid) {
         if (isValid) {
            $username[0].setCustomValidity("");
         } else {
            $username[0].setCustomValidity("Username has already been used");
         }
      });
   } else {
      $username[0].setCustomValidity("Please fill out this field.");
      return new Promise(function(){});
   }
}
