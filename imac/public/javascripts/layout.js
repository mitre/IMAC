var username;
var priorities = {1: 'High', 2: 'Medium', 3: 'Low'};

// Extend jquery to include an option for animating via animate.css
$.fn.extend({
   animateCss: function (animationName, callback) {
      var animationEnd = 'webkitAnimationEnd mozAnimationEnd MSAnimationEnd oanimationend animationend';
      this.addClass('animated ' + animationName).one(animationEnd, function () {
         $(this).removeClass('animated ' + animationName);
         if(callback){
            callback(this);
         }
      });
   }
});

$(document).ready(function () {
   var $menu_pointer = $('.menu-pointer');
   var $menu_container = $('.menu-container');
   var $menu_button = $('.menu-button');

   $.noty.defaults.theme = 'relax';
   $.noty.defaults.layout = 'topCenter';
   $.noty.defaults.timeout = 6000;
   $.noty.defaults.animation = {
      open: 'animated fadeIn',
      close: 'animated fadeOut'
   };

   $('.flash-messages > div').each(function () {
      var type = this.classList[0];
      noty({
         type: type,
         text: $(this).html()
      });
   });



   username = $('#username').html();

   // Toggle menu visibility when menu button is clicked
   $menu_button.click(function () {
      $(this).siblings('.menu-pointer, .menu-container').toggle();
   });

   $('body').on('click', function (e) {
      var $target = $(e.target);

      // ignore clicks on the list
      if ($target.is($menu_container) || ($target.parents('.menu-container').length > 0) || $target.is($menu_button)) {
         return;
      } else if ($menu_container.is(':visible')) {
         $menu_container.hide();
         $menu_pointer.hide();
      }
   });

});

function fixRowHeights() {
   return;
   // Match heights for all table elements
   $('.record > .obj').each(function (index) {
      $label_rows = $(this).find('.labels > .property-row');
      $query_rows = $(this).find('.query > .property-row');
      $match_rows = $(this).find('.match > .property-row');
      for (var row_index = 0; row_index < $query_rows.length; row_index++) {

         $query_row = $($query_rows[row_index]);
         $match_row = $($match_rows[row_index]);
         var query_height = $query_row.height();
         var match_height = $match_row.height();

         var max_height = (query_height > match_height) ? query_height : match_height;
         $query_row.height(max_height);
         $match_row.height(max_height);
         // If the label row exists set it's height as well
         if ($label_rows[row_index] != undefined) {
            $($label_rows[row_index]).height(max_height);
         }

      }
   });
}

function getUrlParameter(sParam, sDefault=undefined) {
   var sPageURL = decodeURIComponent(window.location.search.substring(1)),
      sURLVariables = sPageURL.split('&'),
      sParameterName,
      i;

   for (i = 0; i < sURLVariables.length; i++) {
      sParameterName = sURLVariables[i].split('=');

      if (sParameterName[0] === sParam) {
         return sParameterName[1] === undefined ? sDefault : sParameterName[1];
      }
   }
   return sDefault;
}

function displayStatusMessages(messages) {
   messages.forEach(function (message) {
      noty({
         type: message.message_class,
         text: message.content
      });
   });
}
