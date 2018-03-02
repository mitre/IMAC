$(document).ready(function () {

   var $row_labels = $('.row-label');
   // Initial Show/Hide label fields
   if ($('#show-labels:checked').length == 1) {
      $row_labels.show();
   }

   // Show/Hide action for label fields
   $('#show-labels').on('click', function () {
      $('.row-label').toggle();
   });

   // Check/Uncheck all query checkboxes with check-all checkbox
   $('#check-all').on('change', function () {
      var $query_checkboxes = $('.query-select');
      if ($('#check-all:checked')[0] != undefined)
         $query_checkboxes.prop('checked', true);
      else
         $query_checkboxes.prop('checked', false);
   });

   // Click action for query delete buttons
   $('.delete-query').on('click', function () {
      // Confirm the delete with the user
      if (!confirm("Are you sure you want to delete this query?")) {
         return;
      }

      // Grab the query ID from the element
      var query_id = $(this).attr('query-id');
      var query_row = $(this).closest('tr');

      // Remove the query row
      $.ajax('/imac/query/delete/' + query_id).done(function () {
         query_row.remove();
         noty({
            type: 'success',
            text: 'Query successfully deleted.'
         });
      })
   });

   $('.delete-many').on('click', function () {
      var selected_queries = [];
      $('.query-select:checked').each(function (checkbox) {
         selected_queries.push(this.closest('tr').id);
      });

      // Confirm the delete with the user
      if (!confirm("Are you sure you want to delete the selected queries?")) {
         return;
      }

      $.post('/imac/query/delete', {queries: selected_queries}).done(function () {
         $('.query-select:checked').closest('tr').remove();
         noty({
            type: 'success',
            text: 'Queries successfully deleted'
         });
      })
   });

   // Edit Query
   $('.edit-query').on('click', function () {
      var form = $(this).parent();
      var query_id = $(this).attr('query-id');
      var query_ids = [];
      if (query_id == 'many') {
         $('.query-select:checked').closest('tr').each(function () {
            query_ids.push(this.id);
         });
      } else {
         query_ids.push(query_id);
      }

      var query_updates = {
         priority: form.find('.priority').val(),
         required_adjudications: form.find('.required-adjudications').val(),
         query_ids: query_ids
      };

      $.post('/imac/query/edit', {query_updates: JSON.stringify(query_updates)}).done(function () {
         updateQueries(query_updates);
      });
   });

   // Tag field-rows as being sortable targets for field elements
   $('.field-row').sortable({revert: 'true'});

   // Tag all field (and delimiter) elements as being draggable, able to sort into the field-rows
   $('.field-delimiter-container .field').draggable({
      connectToSortable: '.field-row',
      snapMode: 'inner',
      helper: 'clone',
      revert: 'invalid',
      start: function () {
         highlightTargets();
      },
      stop: function () {
         // Unhighlight
         unhighlightAndAdd();
         // Make all placed fields also draggable, but not cloneable
         $('.field-row .field').draggable({
            connectToSortable: '.field-row',
            snapMode: 'inner',
            revert: 'invalid',
            start: function () {
               highlightTargets();
            },
            stop: function () {
               unhighlightAndAdd();
            }
         });
      }
   });

   // Make all placed fields also draggable, but not cloneable
   $('.field-row .field').draggable({
      connectToSortable: '.field-row',
      snapMode: 'inner',
      revert: 'invalid',
      start: function () {
         highlightTargets();
      },
      stop: function () {
         unhighlightAndAdd();
      }
   });

   $('.field-settings').sortable();

   // Update the contents of the hidden #field-layout input whenever the field-settings div changes
   $('.field-settings').bind("DOMSubtreeModified", function () {
      var field_layout = [];
      $('.field-row').each(function () {
         var fields = [];
         $(this).children().each(function () {
            if ($(this).attr('value') != null) {
               fields.push($(this).attr('value'));
            }
         });
         if (fields.length > 0) {
            field_layout.push(fields);
         }
      });
      $('#field-layout').val(JSON.stringify(field_layout));
      updateRowLabels();
   });

});

$(document).on('click', '.field-row .handle', function () {
   $(this).parent().remove();
   unhighlightAndAdd();
});

// When Row Labels change trigger update of hidden field
$(document).on('change', 'input.label', function () {
   updateRowLabels();
});


// Helper Functions
function highlightTargets() {
   // Highlight all targetable rows
   $('.field-row').css('background', 'linear-gradient(#fff, #f7ead6)');
}

// Update contents of 'row_labels' hidden input when labels are updated
function updateRowLabels() {
   var row_labels = [];
   // Loop through each label, grab the values
   $('input.label').each(function () {
      row_labels.push($(this).val());
   });

   // Stringify the row_labels array and cram it into the hidden row_labels input
   $('#row-labels').val(JSON.stringify(row_labels));
}

function unhighlightAndAdd() {
   // Unhighlight targetable rows
   $('.field-row').css('background', '');
   // Change the content of all field-row fields to delete buttons
   //$('.field-row .field:after').
   // Create and delete field-rows as needed...
   $('.field-row').each(function () {
      // Add a row-label field to any non empty row that doesn't already have one
      if ($(this).find('.field').length > 0 && $(this).find('.row-label').length == 0) {
         $(this).prepend("<div class='row-label'><input  size='8' class='label'></div>")
         if ($('#show-labels:checked').length == 0) {
            $('.row-label').hide();
         } else {
            $('.row-label').show();
         }
      }
      // If this is the last row (no next sibling)...
      if ($(this).next().length == 0) {
         // ...and it has some content...
         if ($(this).html().length > 0) {
            // ...add another row as a possible target for fields
            $(this).after("<div class='field-row'></div>");
            // ... and make the next row a sortable target.
            $(this).next().sortable({revert: 'true'});
         }
      }
      // If this is NOT the last row and has zero content...
      else if ($(this).find('.field').length == 0) {
         // ...remove this row.
         $(this).remove();
      }

   });
}

function updateQueries(q_update) {
   for (var _id of q_update.query_ids) {
      var query_row = $('#' + _id);
      if (q_update.priority != '')
         query_row.find('td.priority').html(priorities[q_update.priority]);
      if (q_update.required_adjudications != '') {
         query_row.find('td.required-adjudications').html(q_update.required_adjudications);
         // Blank out percentage
         query_row.find('td.percent-complete').html('--');
      }

      // Hide edit menus
      query_row.find('.menu-container, .menu-pointer').hide();
      // Clear out multi-edit form contents
      $('#edit-many .priority , #edit-many .required-adjudications').val(null);
   }
   // Hide Global edit menu
   $('#selected-buttons .menu-container, #selected-buttons .menu-pointer').hide();

   var query_word = q_update.query_ids.length > 1 ? "Queries" : "Query";

   // Notify user of successful editing
   noty({
      type: 'success',
      text: query_word + " successfully edited."
   });
}
