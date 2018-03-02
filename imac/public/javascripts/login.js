$(document).ready(function () {

   $('#forgot-password').click(function (e) {
      e.preventDefault();
      var username = $('#username').val();
      window.location = $(this).attr('href') + username;
   })
});