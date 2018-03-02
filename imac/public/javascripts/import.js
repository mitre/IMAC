$(document).ready(function () {
   // Hide text input on page-load
   $('.file-import').toggle(false);

   $('.file-radio').click(function () {
      $('.text-import').toggle(false);
      $('.file-import').toggle(true);
      $('form.import-form').attr('enctype', 'multipart/form-data');
   });

   $('.text-radio').click(function () {
      $('.text-import').toggle(true);
      $('.file-import').toggle(false);
      $('form.import-form').attr('enctype', '');

   });

   $('.import-run-button').click(function () {
      if ($('.text-radio')[0].checked) {
         return true;
      }
   });

   $('.default-priority-info').on('click', function () {
      noty({
         type: 'alert',
         layout: 'top',
         timeout: false,
         modal: true,
         buttons: [{
            text: 'Got it!', onClick: function ($noty) {
               $noty.close()
            }
         }],
         text: "All queries imported in this run will be created with the chosen priority.<br><br>" +
         "Queries with a higher priority are served to adjudicators first, so priority can be used to complete a portion of your adjudications ahead of another."
      })
   });

   $('.default-adjudications-info').on('click', function () {
      noty({
         type: 'alert',
         layout: 'top',
         timeout: false,
         modal: true,
         buttons: [{
            text: 'Got it!', onClick: function ($noty) {
               $noty.close()
            }
         }],
         text: "All queries imported in this run will require the chosen number of adjudications, from unique users, before they will be considered fully adjudicated."
      })
   });

   $('.query-import-info').on('click', function () {
      noty({
         type: 'alert',
         layout: 'top',
         timeout: false,
         modal: true,
         buttons: [{
            text: 'Got it!', onClick: function ($noty) {
               $noty.close()
            }
         }],
         text:
         "This import format is square bracket ('[', ']') and pipe ('|') delimited. <br>" +
         "Each import should begin with a line beginning 'key=' that describes the import data, like so:<br>" +
         "key=record_id|column_1_name|column_2_name<br><br>" +
         "Each line after that represents a query/potential match pair. The query data will fall in between the first set of square brackets ('[', ']')" +
         " and the match data should fall in between the second pair. <br><br>" +
         "Fields are separated by the pipe character ('|'). If your fields contain either a pipe or a square bracket you must escape those charactrs with back-slashes (e.g. '\\|') " +
         "Here's a sample import of a single query with two potential matches:<br>" +
         "<div class='sample-import'>" +
            "<p>" +
               "key=record_id|column_1_name|column_2_name<br>" +
               "[query-record-id|Column One Data|Column Two][1st-match-record-id|Column One Data|Column Two]<br>" +
               "[query-record-id|Column One Data|Column Two][2nd-match-record-id|Column One Data|Column Two]" +
            "</p>" +
         "</div>"
      });
   });

   $('.judgement-import-info').on('click', function () {
      noty({
         type: 'alert',
         layout: 'top',
         timeout: false,
         modal: true,
         buttons: [{
            text: 'Got it!', onClick: function ($noty) {
               $noty.close()
            }
         }],
         text:
         "This import format is pipe ('|') delimited. <br>" +
         "Each line of the import represents a single judgement. The format of each line must be as follows:<br><br>" +
         "<span class='monospace'>query_record_id|match_record_id|username|judgement|fatigue|super_adjudication</span><br><br>" +
         "Judgement - 'true' indicates a match, 'false' indicates not a match, 'null' indicates the 'unsure'<br>" +
         "Fatigue - included for legacy reasons, should always be 'false'<br>" +
         "Super Adjudication - 'true' indicates the judgement is a super adjudication, 'false' indicates that it is not<br>" +

         "<div class='sample-import'>" +
            "<p>" +
            "18451538|18451522|cpratt|true|false|false<br>" +
            "18451538|18451634|jsmith|null|false|false <br>" +
            "18451538|18451634|admin|false|false|true" +
            "</p>" +
         "</div>"
      });
   });
});