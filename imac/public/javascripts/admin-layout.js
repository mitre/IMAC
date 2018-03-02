$(document).ready(function () {
   // Load active users on initial page load
   refreshActiveUsers();

   // Refresh active users every 15 seconds
   //setInterval(refreshActiveUsers, 20000);
});

function refreshActiveUsers(){
   $.get('/imac/users/active-users', function (data) {
      $('#active-users-container').html(data);
      // Take the active user count from the body and apply it to the active user button
      var active_users_count = $('#active-users-count').html();
      $('.active-users-count').html(active_users_count);

   });
}