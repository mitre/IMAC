var show_only_conflicted = getUrlParameter('showOnlyConflicted', false);
var active_users = [];

$(document).ready(function () {
   $('.adjudicator').button();
   $('.conflict-filter').buttonset();

   // Hide queries with no responses
   //$('.query:not(:has(li.match-container))').hide();

   // Set up the active user list
   $('.adjudicator').each(function () {
      active_users.push(this.id);
   });

   // Collapse / Expand for queries
   $('.collapse-icon,.query-content').click(function () {
      var $header = $(this).closest('.query-data');
      var $content = $header.parent().find('.match-data');
      var $resolve_button = $(this).parent().find('.resolve-button');
      var query_id = $resolve_button.attr('query-id');
      var project_id = $resolve_button.attr('project-id');

      console.log("Grabbing results for: " + query_id);

      // See if the match-content has anything in it
      if($content.html() == ""){
         // If there's no content try to grab content from the server
         $.get('/imac/review/responses/' + project_id + '/' + query_id, function (data) {
            console.log("Grabbed results for: " + query_id);
            $content.html(data);
            if(show_only_conflicted){
               hideNonConflicts();
            }
            //open up the content needed - toggle the slide- if visible, slide up, if not slidedown.
            $content.slideToggle(0, function () {
               //execute this after slideToggle is done
               //toggle the expanded class to change from the plus icon to the minus
               $header.find('.collapse-icon').toggleClass('expanded');
            });
         });
      } else {
         $content.slideToggle(0, function () {
            //execute this after slideToggle is done
            //toggle the expanded class to change from the plus icon to the minus
            $header.find('.collapse-icon').toggleClass('expanded');
         });
      }


   });

   // Ajax call for getting Super Adjudication popup
   $('.resolve-button').click(function () {
      var project_id = $(this).attr('project-id');
      var query_id = $(this).attr('query-id');
      $.get('/imac/review/' + project_id + '/' + query_id, function (data) {
         console.log("Loaded superadjudication data.");
         $('.popup-contents').html(data);
         $('.popup').toggle().scrollTop(0);
         // Disable scrolling while popup is active
         $('body').css('overflow', 'hidden');
         $('.disable-page').toggle();
         // Hide user lists that do not contain users
         $('.users:not(:has(div.user))').hide();

         // Find First Conflict
         var $first_conflict = $('.record.conflicted').first();

         if($first_conflict.length > 0){
            $first_conflict.addClass('active-record'); // Set first conflict as active record
            scroll_conflicts(); // Scroll to the first conflict
         }


         setQueryConflictRemaining();
         fixRowHeights();
      }).fail(function(err){
         console.log(err);
      });
   });

   // Close popup button
   $('.popup-close,.disable-page').click(function () {
      closePopup();
   });

   //Close poup keyboard shortcut
   $(document).bind('keydown', 'esc', function () {
      closePopup();
   });

   // Click events for super-adjudication

   // Click - Mark True
   $(document).on('click', '.k-record.active .footer-button', function () {
      var $current_record = $(this).closest('.record');
      // Make the current record the 'active-record'
      $('.active-record').removeClass('active-record');
      $current_record.addClass('active-record');

      // Grab some variables we need
      var query_id = $current_record.closest('#records').attr('query-id');
      var response_id = $current_record.first().attr('match-id');
      var mark = $(this).hasClass('true-button') ? 'true' : 'false';
      var marking_path = "/imac/rest/mark" + '/' + query_id + '/' + response_id + '/' + mark + '/false/true';
      console.log(marking_path);
      $.getJSON(marking_path);

      // Remove any previous judgements from the current user
      $current_record.find('.user.' + username).remove();

      var judgement_html = "<div class='user " + username + " super-adjudication'>" + username + "</div>";
      // Set the record style and add this adjudication to the list of adjudications
      if (mark == 'true') {
         $current_record.removeClass('record-false record-maybe').addClass('record-true');
         $current_record.find('.true-users').show().append(judgement_html);
      } else {
         $current_record.removeClass('record-true record-maybe').addClass('record-false');
         $current_record.find('.false-users').show().append(judgement_html);
      }

      // Show/Hide the users containers depending on who's got content
      $current_record.find('.users').each(function () {
         if ($(this).find('.user').length > 0) {
            $(this).show();
         } else {
            $(this).hide();
         }
      });

      // Mark the record as no longer conflicted
      $current_record.removeClass('conflicted');

      // Update the conflict count
      setQueryConflictRemaining();

      // Show/Hide the users divs if there are no users
      $('.adjudications:not(:has(div.user))').hide();
      $('.adjudications:has(div.user)').show();
   });

   // Next/Prev Click Events

   // Click - Scroll to Current Conflict
   $(document).on('click', '#adjudication-count', scroll_conflicts);


   // Click - Next Conflict
   $(document).on('click', '#next-conflict', function () {
      $active_record = $('.active-record');
      if ($active_record.length == 0) {
         $('.record.conflicted').first().addClass('active-record');
      } else {
         $('.active-record').removeClass('active-record').nextAll('.record.conflicted').first().addClass('active-record');
      }
      scroll_conflicts();
   });

   // Click - Previous Conflict
   $(document).on('click', '#prev-conflict', function () {
      $active_record = $('.active-record');
      if ($active_record.length == 0) {
         $('.record.conflicted').last().addClass('active-record');
      } else {
         $active_record.removeClass('active-record').prevAll('.record.conflicted').first().addClass('active-record');
      }
      scroll_conflicts();
   });


   // Set Default View
   if (show_only_conflicted === 'true') {
      $("#conflicts").prop("checked", true);
      hideNonConflicts();
   }

   // Show All
   $('#all-button, #all-matches').click(showNonConflicts);
   // Show only conflicts
   $('#conflicts-button, #conflicts').click(hideNonConflicts);

   // Toggle User's queries on/off
   $('.adjudicator').click(toggleUser);
});

function closePopup() {
   var $popup = $('.popup .super-adjudication');
   var query_id = $popup.attr('query-id');
   var project_id = $popup.attr('project-id');
   var $match_data = $('.match-data[query-id=' + query_id + ']');
   var $query = $match_data.closest('.query');
   var $resolve_button = $query.find('.resolve-button');

   // Update the content of the query that was just closed
   $.get('/imac/review/responses/' + project_id + '/' + query_id, function (data) {
      console.log("Refreshing results for: " + query_id);
      // Update the content
      $match_data.html(data);
      if(show_only_conflicted){
         hideNonConflicts();
      }

      // Count the conflicted responses for the updated query
      var conflict_count = $match_data.find('li.conflicted').length;

      // Toggle the query-level conflict classes and update the text of the 'resolve-button'
      if(conflict_count > 0){
         $query.removeClass('non-conflicted').addClass('conflicted');
         $resolve_button.html("Resolve " + conflict_count + " Conflicts");
      } else {
         $query.removeClass('conflicted').addClass('non-conflicted');
         $resolve_button.html("Review All");
      }

      // Update the total number of conflicted queries
      var query_conflict_count = $('.query.conflicted').length;
      $('#conflict-count').html(query_conflict_count);
   });

   // Hide the popup and the page-overlay
   $('.popup, .disable-page').toggle(false);
   // Re-enable scrolling on the page
   $('body').css('overflow', 'auto');
   // Get rid of the active-record class to avoid confusing the next time the popup opens
   $('.active-record').removeClass('active-record');


}

function hideNonConflicts() {
   show_only_conflicted = true;
   $('.match-container.non-conflicted').addClass('c-hidden');
   $('.query.non-conflicted').hide();
}

function showNonConflicts() {
   show_only_conflicted = false;
   $('.match-container.non-conflicted').removeClass('c-hidden');
   $(".query.non-conflicted[involved-users~='" + active_users.join("'],[involved-users-id~='") + "']").show();
}

function toggleUser() {
   var user_class = this.id;
   var conflicted_class = show_only_conflicted ? '.conflicted' : '';

   // Find all instances of this user's matches, the filter class will ensure we're either dealing
   // with all matches, or just the conflicted ones
   var $user_divs = $('.' + user_class);

   // If we're re-activating a user...
   if (this.checked) {
      // Add them back into the active users list
      active_users.push(user_class);
      // Show all of their query elements and remove the 'hidden' class from the match-containers
      $user_divs.closest('.match-container').removeClass('u-hidden');
      // Show queries where this user is active
      $('.query' + conflicted_class + '[involved-users~=' + user_class + ']').show();
   }

   // Hide any divs that have only hidden users
   else {
      // Remove this user from the list of active users
      active_users.splice(active_users.indexOf(user_class), 1);

      // Use the updated active users list to build a selector like:
      // .admin, .joe, .bill (etc)
      var active_selector = '.';
      if (active_users.length > 0) {
         active_selector += active_users.join(', .');
      } else {
         active_selector = '';
      }


      // Go through each adjudications div related to this user...
      $user_divs.closest('.adjudications').each(function () {
         // ...if this match-container contains no matches involving users on the active user list...
         if ($(this).find(active_selector).length == 0) {
            // ...hide the match-container using the 'hidden' class.
            $(this).parent().addClass('u-hidden');
         }
      });

      // Loop through the queries where this user is involved, hide any where there are no active users
      $(".query[involved-users~=" + user_class + "]:not([involved-users~='" + active_users.join("'],[involved-users~='") + "'])").hide();
   }
}

function showHideQueries() {
   // For each match-content div...
   //$(".query[involved-users~='" + active_users.join("'],[involved-users-id~='") + "']")

   // For each match-content div...
   $('.match-content').each(function () {
      // grab the first match-container
      var $match_content = $(this);
      if ($match_content.children('.c-hidden, .u-hidden').length == $match_content.children().length) {
         $match_content.closest('.query').hide();
      } else {
         $match_content.closest('.query').show();
      }
   });

   /*$('.query').each(function () {
      // grab the first match-container
      var $query = $(this);
      var involved_users = $query.attr('involved-users').split(' ');
      for(au of active_users){
         if ($.inArray(au, involved_users != -1)){
            $query.show();
            break;
         }
      }
   });*/
}

function setQueryConflictRemaining() {
   var conf_count = $('.record.conflicted').length;
   $('#adjudication-count .count').html(conf_count);
}

function scroll_conflicts() {
   var $all_conflicts = $('.record.conflicted');
   var $active_record = $('.active-record');
   if ($all_conflicts.length == 0) {
      // Pulse the remaining indicator, return
      return;
   } else if ($active_record.length == 0) {
      $active_record = $all_conflicts.first().addClass('active-record');
   }
   var $scroller = $('.popup');
   var active_top = $active_record.position().top;
   var active_bottom = active_top + $active_record.height();
   var view_bottom = $scroller.innerHeight();
   var offset = $('.active-record').offset().top - $('.popup-contents').offset().top - 20;

   // If the top of the active record is above the viewport or if the bottom of the active record is below the viewport
   if (active_top < 0 || active_bottom > view_bottom) {
      // Scroll so the top of the page is 20 px above the top of the element
      $scroller.animate({
         scrollTop: offset
      });
   }
   $active_record.animateCss('pulse');

}