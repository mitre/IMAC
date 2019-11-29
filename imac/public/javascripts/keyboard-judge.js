var tbd_record_count;
var project_id = '';
var query_id = '';

var layout = {
   alignment: 'close',
   rows: [
      ['last', ', ', 'first'],
      ['dob'],
      ['id']
   ]
};

$(document).ready(function () {


   $('.expand-button').click(function () {
      expand_record($(this).parent());
   });

   // Close popup button
   $('.popup-close,.disabled-background').click(function () {
      hidePopup();
   });

   //Close popup keyboard shortcut
   $(document).bind('keydown', 'esc', function () {
      hidePopup();
   });

   project_id = $('#records').attr('project-id');
   query_id = $('#records').attr('query-id');

   // Return page scroll to the top
   $('html, body').animate({
      scrollTop: 0
   });
   var $tbd_records = $('div.record').not('.record-true, .record-false, .record-maybe');
   tbd_record_count = $tbd_records.length;
   // Set TBD Records Count
   update_tbd_record_count();

   // Set first active record
   $tbd_records.first().addClass('active-record');

   // Add the loaded query id to the end of the url for the window so the user can refresh if need be
   window.history.replaceState("", "", window.location.pathname + "?query_id=" + query_id + "&view=" + view);

   // Show/Hide expand-button when mouse hovering over a specific record
   $('.k-record').mouseenter(function () {
      $(this).addClass('show-footer').find('.expand-button').show();

   }).mouseleave(function () {
      $(this).removeClass('show-footer').find('.expand-button').hide();
   });

   // Bind Sort Handler
   $('#sort-dropdown').change((event) => {
      sort_records($(this).find(':selected').val())
   });

   // Hotkey- Mark True
   $(document).bind('keydown', 'm shift+m', function () {
      var $active_record = $('.active-record');
      if ($active_record.length > 0 && $active_record.attr('id') != 'next-page') {
         mark_record($active_record, true);
         $('.active-record, .popup-contents').removeClass('record-false record-maybe').addClass('record-true');
         if(popupVisible()){
            $('.popup-contents').addClass('record-true')
         }
         next_active_record();
      }
   });

   // Hotkey - Mark False
   $(document).bind('keydown', 'n shift+n', function () {
      var $active_record = $('.active-record');
      if ($active_record.length > 0 && $active_record.attr('id') != 'next-page') {
         mark_record($active_record, false);
         $('.active-record, .popup-contents').removeClass('record-true record-maybe').addClass('record-false');
         if(popupVisible()){
            $('.popup-contents').addClass('record-false');
         }
         next_active_record();
      }
   });

   // Hotkey - Mark Maybe
   $(document).bind('keydown', 'u shift+u', function () {
      var $active_record = $('.active-record');
      if ($active_record.length > 0 && $active_record.attr('id') != 'next-page') {
         mark_record($active_record, 'maybe');
         $('.active-record, .popup-contents').removeClass('record-true record-false').addClass('record-maybe');
         if(popupVisible()){
            $('.popup-contents').addClass('record-maybe');
         }
         next_active_record();
      }
   });

   // Hotkey - Prev Active Record
   $(document).bind('keydown', 'k shift+k', prev_active_record);

   // Hotkey - Next Active Record
   $(document).bind('keydown', 'l shift+l', function(){
      // Highlight the next active record, unless we're about to advance to the next page
      if($('.active-record').attr('id') == 'next-page'){
         next_page();
      } else {
         next_active_record();
      }
   });

   // Hotkey - Jump To Active Record
   $(document).bind('keydown', 'j shift+j', jump_to_active_record);

   // Hotkey - Display Hotkey Help
   $(document).bind('keydown', 'shift+/ /', show_help);

   // Hotkey - Open/Expand Record
   $(document).bind('keydown', 'o shift+o', function () {
      if($('.active-record').attr('id') != 'next-page'){
         expand_record($('.active-record'));
      }
   });

   // Click - Mark True
   $(document).on('click', '.true-button', function () {
      var $current_record = $(this).closest('.record');
      var match_id = $current_record.attr('match-id');
      mark_record($current_record, true);
      $('[match-id="' + match_id +'"]').removeClass('record-false record-maybe').addClass('record-true');
   });

   // Click - Mark False
   $(document).on('click', '.false-button', function () {
      var $current_record = $(this).closest('.record');
      var match_id = $current_record.attr('match-id');
      mark_record($current_record, false);
      $('[match-id="' + match_id +'"]').removeClass('record-true record-maybe').addClass('record-false');
   });

   // Click - Mark Maybe
   $(document).on('click', '.maybe-button', function () {
      var $current_record = $(this).closest('.record');
      var match_id = $current_record.attr('match-id');
      mark_record($current_record, 'maybe');
      $('[match-id="' + match_id +'"]').removeClass('record-true record-false').addClass('record-maybe');
   });

   // Prev/Next buttons
   $('#prev-record').on('click', prev_active_record);

   $('#next-record').on('click', next_active_record);

   // Adjudication Count - Scroll to active record
   $('#adjudication-count').on('click', jump_to_active_record);

});

function show_help(){
 /*  noty({
      type: 'alert',
      layout: 'topCenter',
      timeout: false,
      modal: true,
      buttons: [{
         text: 'Got it!', onClick: function ($noty) {
            $noty.close()
         }
      }],
      text: "N - Not a Match <br>M - Match <br>U - Unsure <br><br>" +
      "O - Open/Expand Record<br>K - Previous Record<br>L - Next Record<br><br>" +
      "J - Jump to Active Record <br><br>" +
      "/ or ? - Display this menu"
   });*/
   alert("Keyboard Shortcuts:\nN - Not a Match \nM - Match \nU - Unsure \n\nO - Open/Expand Record\nK - Previous Record\nL - Next Record\n\nJ - Jump to Active Record \n\n/ or ? - Display this menu");
}

function expand_record($record){
   if(!popupVisible()){
      // Set the current record as the active record
      $('.active-record').removeClass('active-record');
      $record.addClass('active-record');

      // Hide the expand button
      $('.expand-button').hide();

      // Clone the contents of the record and add them to the popup contents
      update_popup();

      // Show the popup
      showPopup();
   }
}

function update_popup(previous){

   $active_record = $('.active-record');

   if($active_record.length > 0){
      var match_class = '';
      var match_id = $active_record.attr('match-id');

      if($active_record.hasClass('record-true')){
         match_class = 'record-true';
      } else if ($active_record.hasClass('record-false')){
         match_class = 'record-false';
      } else if ($active_record.hasClass('record-maybe')){
         match_class = 'record-maybe';
      }


      // Add the labels, query and match to the popup contents
      var record_table = $('.active-record table.obj').clone();

      // If the popup is visible, add new popup contents to the 'next-popup', scroll the old one off, the new one on
      if($('.popup-container:visible').length > 0){
         var $current_popup = $('.popup-container:last');
         var $next_popup = $current_popup.clone();

         // Clear out old popup data from clone, add new data
         $next_popup.find('.popup-contents').removeClass('record-false record-true record-maybe').addClass(match_class + " record k-record show-footer").attr('match-id', match_id);
         $next_popup.find('.popup-contents').html(record_table);

         // Add next popup to the popup widget
         $('.popup-widget').append($next_popup);

         var fade_in = (previous) ? 'fadeInLeft' : 'fadeInRight';
         var fade_out = (previous) ? 'fadeOutRight' : 'fadeOutLeft';

         // Scroll the two popups accordingly
         $next_popup.animateCss(fade_in);
         $current_popup.animateCss(fade_out, function (old_popup) {
            // Delete the old popup
            $(old_popup).remove();
         });
      }
      // Otherwise just replace the popup contents
      else {
         $('.popup-container .popup-contents').removeClass('record-false record-true record-maybe').addClass(match_class + " record k-record show-footer").attr('match-id', match_id);
         $('.popup-contents').html(record_table);
      }

   }

}

function mark_record($current_record, marking) {

   var record_id = $current_record.first().attr('match-id');

   // Determine if we're marking a new record or one that's been marked before
   if ($current_record.not('.record-true, .record-false, .record-maybe').length > 0 && tbd_record_count != 0) {
      tbd_record_count--;
      update_tbd_record_count();
   }

   console.log("record: " + record_id);
   var fatigue = 'false';
   var super_adjudication = 'false';
   var marking_path = "/imac/rest/mark/" + query_id + "/" + record_id + "/" + marking + "/" + fatigue + "/" + super_adjudication;
   console.log(marking_path);
   $.ajax(marking_path, {
      complete: function (result) {

         if (result.responseText == 'success') {
            console.log(result);
            // If we've adjudicated all of the records show the 'next' button
            if (tbd_record_count <= 0) {
               $('#next-page').css('visibility', 'visible');
            }

         } else {
            noty({
               type: 'error',
               text: "You have been logged out. <br><br>Your most recent adjudication has not been saved. Click below to log in again to resume adjudication.",
               timeout: 0,
               buttons: [
                  {
                     addClass: 'btn btn-primary', text: 'Login', onClick: function ($noty) {
                     window.location = '/login?redirect=' + window.location.pathname + window.location.search;
                  }
                  }
               ]
            });
         }


      }
   });
}

function next_active_record() {

   var $active_record = $('.active-record');

   // Ignore if we're primed to go to the next page
   if ($active_record.attr('id') == 'next-page') {
      return;
   }

   var $next_active_record = $active_record.nextAll('div:not(.record-false, .record-true, .record-maybe)').first();
   $active_record.removeClass('active-record');

   if (tbd_record_count <= 0) {
      // If we are out of unadjudicated records
      $('#next-page').addClass('active-record');
      $('#next-hotkey-prompt').css('visibility', 'visible');
      hidePopup();
   }
   else if ($next_active_record.length > 0) {
      $next_active_record.addClass('active-record');
   }
   else {
      // Loop back around to the first record
      $(".record:not(.record-false, .record-true, .record-maybe, .popup-contents)").first().addClass('active-record');
   }

   if(popupVisible()){
      update_popup();
   } else {
      scroll_active_record();
   }
}

function prev_active_record() {
   var $active_record = $('.active-record');
   var $prev_active_record = $active_record.prevAll('.record:not(.record-false, .record-true, .record-maybe)').first();
   $active_record.removeClass('active-record');
   if (tbd_record_count <= 0) {
      $('#next-page').addClass('active-record');
   }
   else if ($prev_active_record.length > 0) {
      $prev_active_record.addClass('active-record');
   } else {
      $(".record:not(.record-false, .record-true, .record-maybe)").last().addClass('active-record');
   }

   if($('.popup-container:visible').length > 0){
      update_popup(true);
   } else {
      scroll_active_record();
   }
}

function update_tbd_record_count() {
   $("#adjudication-count").find(".count").html(tbd_record_count);
}

function next_page() {
   location.reload();
   /*$('.k-record').empty().removeClass('record-true record-false active-record k-record');
    loadAllRecords();*/
}

function jump_to_active_record() {
   var $active_record = $('.active-record');
   // If there is no active record, pulse the remaining adjudication count
   if (tbd_record_count <= 0) {
      $('#adjudication-count').animateCss('flash');
   } else {
      // Otherwise scroll there, and pulse
      scroll_active_record();
      $active_record.animateCss('pulse');
   }
}

function scroll_active_record() {
   var $active_record = $('.active-record');
   var active_top = $active_record.offset().top;
   var active_bottom = active_top + $active_record.height();
   var view_top = $(window).scrollTop();
   var view_bottom = view_top + window.innerHeight;

   // If the top of the active record is above the viewport
   if (active_top < view_top) {
      // Scroll up so the top of the page is 20 px above the top of the element
      $('html, body').animate({
         scrollTop: active_top - 100
      });
   } else if (active_bottom > view_bottom) {
      $('html, body').animate({
         //scrollTop: active_bottom - window.innerHeight + 20
         scrollTop: active_top - 100

      });
   }
}

function sort_records(property_index) {
   const $records = $('#records .record');

   if (!!property_index) {
      // About to sort field_index: property_index
      $records.sort((a, b) => {
         return $(a).find('.match')[property_index].textContent > $(b).find('.match')[property_index].textContent ? 1 : -1;
      }).appendTo('#records');
   } else {
      // No usable field_index to sort. Reverting to original sorting
      $records.sort((a, b) => {
         return $(a).attr('original-index') > $(b).attr('original-index') ? 1 : -1;
      }).appendTo('#records');
   }

   // Flash or Jump To the currently active record
   jump_to_active_record();

   // Blur the select button to return the user to keyboard shortcut mode
   $('#sort-dropdown').blur();
}