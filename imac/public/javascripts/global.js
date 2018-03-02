
function validatePasswords() {
   var $password = $('#password');
   var $password_confirm = $('#password-confirm');

   if ($password.val() != "" && $password_confirm.val() != "" && $password.val() != $password_confirm.val()) {
      $password_confirm[0].setCustomValidity("Passwords must match!");
      return false;
   } else {
      $password_confirm[0].setCustomValidity("");
      return true;
   }
}

function showPopup(){
   $('.popup-container').show().scrollTop(0);
   $('.disabled-background').show();
   // Disable scrolling on the page
   $('body').css('overflow', 'hidden');
}

function hidePopup(){
   $('.popup-container').hide();
   $('.disabled-background').hide();
   // Re-enable scrolling on the page
   $('body').css('overflow', 'auto');
}

function popupVisible(){
   return $('.popup-container:visible').length > 0;
}