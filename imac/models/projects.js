var db = require('../db');
var fs = require('fs');
var ObjectID = require('mongodb').ObjectID;
var mongoose = require('mongoose');
var async = require('async');
var sendmail = require('sendmail')();
var from_address = 'imac@mitre.org';
var temp_map = {'[': 'xxxxlsqxxxx', ']': 'xxxxrsqxxxx', '|': 'xxxxpipexxxx', '~': 'xxxxtildexxxx'};
var formatHelper = require('./format');


var Schema = mongoose.Schema;
var totalImports;

/**
 * Project Schema
 * @type {mongoose.Schema}
 */
var projectSchema = new Schema({
   name: String,
   question: String,
   alignment: String,
   archived: {type: Boolean, default: false},
   users: [], //Todo: this is here for legacy reasons for preventing a crash, should be removed
   fields: [String],
   field_layout: [],
   show_labels: Boolean,
   row_labels: [String]
}, {strict: false});

projectSchema.statics.findQueries = function (project_id, callback) {
   return Query.find({_project: project_id}, callback);
};

var Project = mongoose.model('Project', projectSchema);

/**
 * Query Schema
 * @type {mongoose.Schema}
 */
var responseSchema = new Schema({
   record_id: String,
   conflicted: Boolean,
   super_adjudicated: Boolean,
   match: Boolean
   /*    fields: [{
    name: String,
    value: String
    }],*/
}, {
   strict: false
});

var Response = mongoose.model('Response', responseSchema);

var querySchema = new Schema({
   record_id: String,
   priority: Number,
   required_adjudications: Number,
   remaining_adjudications: Number,
   times_served: {type: Number, default: 0},
   involved_users: [String],
   completed_users: [String],
   conflicted: Boolean,
   conflict_count: {type: Number, default: 0},
   /*  fields:[{
    name: String,
    value: String
    }],*/
   responses: [responseSchema],
   _project: {type: Schema.Types.ObjectId, ref: 'Project'}
}, {strict: false});

var Query = mongoose.model('Query', querySchema);

/**
 * Judgement Schema
 * @type {mongoose.Schema}
 */
var judgementSchema = new Schema({
   _user: {type: String, ref: 'User'},
   _query: {type: Schema.Types.ObjectId, ref: 'Query'},
   _response: {type: Schema.Types.ObjectId, ref: 'Response'},
   _project: {type: Schema.Types.ObjectId, ref: 'Project'},
   mark: Boolean,
   fatigue: Boolean,
   super_adjudication: Boolean
});

var Judgement = mongoose.model('Judgement', judgementSchema);

exports.getProjects = function (archived, username, callback) {
   //Project.find({archived:archived}, {name: 1}, {sort: '-_id'}, callback);
   Query.aggregate([
         {
            $project: {
               conflict_number: {$cond: ["$conflicted", 1, 0]},
               _project: 1,
               required_adjudications: 1,
               remaining_adjudications: 1,
               completed_users: 1,
               response_count: {$size: "$responses"},
               judgements: {$multiply: [{$size: "$responses"}, {$size: "$completed_users"}]}
            }
         },
         {
            $group: {
               "_id": "$_project",
               total_required_adjudication_sets: {$sum: "$required_adjudications"},
               total_remaining_adjudication_sets: {$sum: "$remaining_adjudications"},
               total_queries: {$sum: 1},
               total_conflicts: {$sum: "$conflict_number"},
               total_required_judgements: {$sum: {$multiply: ["$response_count", "$required_adjudications"]}},
               total_complete_judgements: {$sum: "$judgements"},
               user_completed_judgements: {
                  $sum: {
                     $cond: {
                        if: {$setIsSubset: [[username], "$completed_users"]},
                        then: "$response_count",
                        else: 0
                     }
                  }
               },
               user_incomplete_judgements: {
                  $sum: {
                     $cond: {
                        if: {
                           $and: [
                              {$not: {$setIsSubset: [[username], "$completed_users"]}},
                              {$gt: ["$remaining_adjudications", 0]}
                           ]
                        },
                        then: "$response_count",
                        else: 0
                     }
                  }
               },
               user_completed_queries: {
                  $sum: {
                     $cond: {
                        if: {$setIsSubset: [[username], "$completed_users"]},
                        then: 1,
                        else: 0
                     }
                  }
               },
               user_incomplete_queries: {
                  $sum: {
                     $cond: {
                        if: {
                           $and: [
                              {$not: {$setIsSubset: [[username], "$completed_users"]}},
                              {$gt: ["$remaining_adjudications", 0]}
                           ]
                        },
                        then: 1,
                        else: 0
                     }
                  }
               }
            }
         },
         {
            $lookup: {
               from: "projects",
               localField: "_id",
               foreignField: "_id",
               as: "project_info"
            }
         },
         {
            $match: {
               "project_info.archived": archived,
               "project_info.field_layout": {$not: {$size: 0}}
            }
         },
         {
            $sort: {"_id": -1}
         }
      ],
      function (err, results) {
         if (err) {
            console.log(err);
         } else {
            for (var i = 0; i < results.length; i++) {
               var required_adj_sets = results[i].total_required_adjudication_sets;
               var remaining_adj_sets = results[i].total_remaining_adjudication_sets;
               var complete_adj_sets = required_adj_sets - remaining_adj_sets;
               var user_complete = results[i].user_completed_judgements;
               var user_incomplete = results[i].user_incomplete_judgements;
               results[i].total_complete_adjudication_sets = complete_adj_sets;
               var percent_complete = (results[i].total_complete_judgements / results[i].total_required_judgements * 100).toFixed(1);
               var user_percent_complete = (user_complete / (user_complete + user_incomplete) * 100).toFixed(1);
               if (percent_complete > 100) {
                  percent_complete = 100.0
               }
               if (user_percent_complete > 100) {
                  user_percent_complete = 100.0
               }
               results[i].percent_complete = isNaN(percent_complete) ? "--%" : percent_complete + "%";
               results[i].user_percent_complete = isNaN(user_percent_complete) ? "--%" : user_percent_complete + "%";
            }
            callback(results);
         }
      });
};

exports.getPendingProjects = function (archived, callback) {
   Project.find({
      archived: archived,
      $or: [{fields: {$size: 0}}, {field_layout: {$size: 0}}]
   }, {name: 1}, {sort: '-_id'}, callback);
};

exports.archiveProject = function (project_id, archive, callback) {
   Project.findByIdAndUpdate(project_id, {archived: archive}, callback);
};

function findConflicts(query_id, response_id, project_id) {
   return Promise(function (resolve, reject) {
      Judgement.find({_query: query._id, _response: response._id, _project: project_id}).then(function (judgement) {
         var true_users = [];
         var false_users = [];
         for (var judgement of judgements) {
            if (judgement.mark) {
               true_users.push(judgement._user);
            } else {
               false_users.push(judgement._user);
            }
         }
         resolve({true_users: true_users, false_users: false_users});
      });
   });
}

exports.getReviewQueries = function (project_id, callback) {
   var field_layout;
   var involved_users = new Set();
   var review_info = {
      queries: [],
      conflicted_count: 0
   };

   Project.findOne({_id: project_id}, {
      field_layout: 1,
      show_labels: 1,
      row_labels: 1,
      alignment: 1
   }).then(function (project) {
      field_layout = project.field_layout;

      review_info.show_labels = project.show_labels;
      review_info.row_labels = project.row_labels;
      review_info.alignment = project.alignment;

      return Query.find({_project: project_id, involved_users: {$ne: []}}, {responses: 0});
   }).then(function (queries) {

      for (var query of queries) {
         var q_rows = exports.convertLayout({data: query, field_layout: field_layout});
         var conflicted = (query.conflicted != undefined) ? query.conflicted : false;
         if(conflicted){review_info.conflicted_count++}

         review_info.queries.push({
            id: query.record_id,
            _id: query._id,
            rows: q_rows,
            conflict_count: query.conflict_count,
            is_conflicted: conflicted,
            responses: [],
            involved_users: query.involved_users
         });

         // Add each user to the global involved user set
         for(user of query.involved_users){
            involved_users.add(user);
         }
      }

      review_info.involved_users = Array.from(involved_users);
      callback(review_info);
   }).catch(function (err) {
      console.log("Error Retrieving Review Data:");
      console.log(err);
      console.log(err.stack);
   });
};

/**
 * @param options -
 *      project_id: the project id to get review info for
 *      query_id:   (optional) for use when pulling up info for a single query for the superadjudication view
 *      callback:   callback function
 */
exports.getReviewResponses = function (options) {
   var project_id = options.project_id;
   var callback = options.callback;
   var query_id = options.query_id || false;

   var field_layout;
   var queries = [];
   var users = new Set();
   var review_info = {
      queries: []
   };

   Project.findById(project_id, {
      field_layout: 1,
      show_labels: 1,
      row_labels: 1,
      alignment: 1
   }).then(function (project) {
      field_layout = project.field_layout;
      review_info.show_labels = project.show_labels;
      review_info.row_labels = project.row_labels;
      review_info.alignment = project.alignment;
      if (query_id) {
         return Query.find({_project: project_id, _id: query_id});
      } else {
         return Query.find({_project: project_id, involved_users: {$ne: []}});
      }
   }).then(function (q) {
      queries = q;
      if (query_id) {
         return Judgement.find({_project: project_id, _query: query_id});
      } else {
         return Judgement.find({_project: project_id});
      }
   }).then(function (j) {
      // Create object of judgements indexed for easy referral by query/response id
      var judgements = {};

      for (var judgement of j) {
         // Push each judgement into an array at the key of the query_id + the response_id
         var j_key = String(judgement._query) + String(judgement._response);
         if (judgements[j_key] !== undefined) {
            judgements[j_key].push(judgement);
         } else {
            judgements[j_key] = [];
            judgements[j_key].push(judgement);
         }
      }
      for (var query of queries) {

         var q_rows = exports.convertLayout({data: query, field_layout: field_layout});
         var conflicted = (query.conflicted != undefined) ? query.conflicted : false;
         var q_info = {
            id: query.record_id,
            _id: query._id,
            rows: q_rows,
            is_conflicted: conflicted,
            responses: []
         };
         for (var response of query.responses) {
            var r_info = {
               id: response.record_id,
               _id: response._id,
               rows: exports.convertLayout({data: response, field_layout: field_layout, compare: query}),
               conflicted: response.conflicted,
               super_adjudicated: response.super_adjudicated,
               match: response.match,
               true_users: [],
               false_users: [],
               maybe_users: []
            };

            j_key = String(query._id) + String(response._id);

            // If we actually have judgements for this query/response...
            if (judgements[j_key] != undefined) {
               // ...loop through each judgement
               for (var judgement of judgements[j_key]) {
                  // Add an involved user to the users set
                  users.add(judgement._user);

                  // Compile the judgement info needed
                  var j_info = {
                     username: judgement._user,
                     super_adjudication_class: (judgement.super_adjudication == true) ? 'super-adjudication' : ''
                  };

                  // Add users to true and false user arrays accordingly
                  if (judgement.mark) {
                     r_info['true_users'].push(j_info);
                  } else if (judgement.mark === false) {
                     r_info['false_users'].push(j_info);
                  } else if (judgement.mark === null) {
                     r_info['maybe_users'].push(j_info);
                  }
               }
            }
            q_info['responses'].push(r_info);
         }
         review_info['queries'].push(q_info);
      }
      review_info['users'] = Array.from(users);
      callback(review_info);
   }).catch(function (err) {
      console.log("Error Retrieving Review Data:");
      console.log(err);
      console.log(err.stack);
   });
};

exports.getProjectInfo = function (project_id, callback) {
   if (project_id == 'new') {
      callback([], []);
   } else {
      return Project.findById(project_id, callback);
   }
};

exports.getQueries = function (project_id, callback) {
   if (project_id == 'new') {
      callback([], []);
   } else {
      return Query.aggregate([
         {$match: {_project: project_id}},
         {
            $project: {
               responses: {$size: '$responses'},
               percent_complete: 1,
               completed_users: 1,
               required_adjudications: 1,
               record_id: 1,
               priority: 1
            }
         },
         {$sort: {priority: 1}}
      ], function (err, queries) {
         for (var query in queries) {
            queries[query].percent_complete = Math.floor((queries[query].completed_users.length / queries[query].required_adjudications) * 100) + "%";
         }
         callback(err, queries)
      });
   }
};

exports.insertUpdate = function (data, callback) {
   // Convert JSON strings into arrays to be saved
   if (data.field_layout != undefined) {
      data.field_layout = JSON.parse(data.field_layout);
   }
   if (data.row_labels != undefined) {
      data.row_labels = JSON.parse(data.row_labels);
   }
   // Populate checkbox data if not defined
   if (data.show_labels == undefined) {
      data.show_labels = false;
   }

   if (data._id == 'new') {
      delete data._id;
      data.users = [];
      var project = new Project(data);
      project.save(function (err, project) {
         if (err) {
            console.log(err);
         } else {
            callback(project, true);
         }
      });
   } else {
      Project.findByIdAndUpdate(data._id, data, function (err, project) {
         if (err) {
            console.log(err);
         } else {
            callback(project, false);
         }
      });
   }
};

exports.addJudgements = function (project_id, data, callback) {
   var judgements = data.judgements.split((/\r?\n/));
   // Add import data to project judgement log
   var file_path = __dirname+'/../adjudication_logs/log_' + project_id + '.txt';

   fs.appendFile(file_path, data.judgements, function (err) {
      if (err) {
         console.log(err);
      }
   });

   totalImports = judgements.length;

   console.log("Records to Import: " + totalImports);

   judgements.forEach(function (line, index) {
      // Wait a sec for postMarkCheck to catchup
      setTimeout(function () {}, 200);

      // Skip blank lines
      if (!(/\S/.test(line))) {
         return;
      }

      // Trim line
      line = line.trim();

      // Split fields by '|' character
      var field_array = line.split('|');

      // Convert strings to bool
      field_array[3] = field_array[3] == 'null' ? null : field_array[3] == 'true'; // mark
      field_array[4] = field_array[4] == 'true'; // fatigue
      field_array[5] = field_array[5] == 'true'; // super_adjudication

      Query.findOne({_project: project_id, record_id: field_array[0], "responses.record_id": field_array[1]}, {
         _id: 1,
         "responses.$": 1
      }, function (err, query) {
         if (query) {
            exports.markResponse(query._id, query.responses[0]._id, field_array[2], field_array[3], field_array[4], field_array[5]);
         } else {
            console.log("No query found with query_id of " + field_array[0] + " and response_id of " + field_array[1])
         }
      });
   });
   exports.postImportProcess(project_id, data.user);
   callback(false);
};

exports.postImportProcess = function (project_id, user) {
   // Grab every query for this project
   Query.find(
      {_project: project_id},
      {
         record_id: 1,
         required_adjudications: 1,
         remaining_adjudications: 1,
         "responses._id": 1,
         "responses.record_id": 1,
         "responses.conflicted": 1,
         "responses.match": 1,
         "responses.super_adjudicated": 1,
         conflict_count: 1,
         completed_users: 1,
         involved_users: 1,
         conflicted: 1
      }).then(
      function (queries) {
         var queries_processed = 0;
         async.eachSeries(queries, function (query, callback) {
            console.log("Processing Query: " + query._id);
            queries_processed++;

            Judgement.find({_query: query._id}, function (err, judgements) {
               // If there are no judgements for a query just skip over this
               if(err){
                  console.log(err);
               }
               if(judgements == null){
                  return;
               }
               console.log("**Judgement Count: " + judgements.length);

               var involved_users = new Set();
               var completed_users = new Set();
               var user_counts = {};
               var response_count = query.responses.length;
               var conflict_count = 0;

               // Loop through each response to a query
               for(var response of query.responses){
                  console.log("**Processing Response: " + response._id);
                  var true_count = 0, false_count = 0, maybe_count = 0;

                  // Loop through all of the judgements for a particular response
                  for(judgement of judgements){
                     if(response.id == judgement._response.toString()){
                        involved_users.add(judgement._user);
                        user_counts[judgement._user] = user_counts[judgement._user] == undefined ? 1 : user_counts[judgement._user] + 1;
                        if (judgement.mark === true) {
                           true_count++;
                        } else if (judgement.mark === false) {
                           false_count++;
                        } else if (judgement.mark === null) {
                           maybe_count++;
                        }
                     }
                  }
                  // If this response has both true and false judgements, or if it's got even one 'maybe', mark it as conflicted
                  if (((true_count > 0 && false_count > 0) || maybe_count > 0) && response.super_adjudicated !== true) {
                     response.conflicted = true;
                     query.conflicted = true;
                     conflict_count++;
                  }

               }

               // Loop through the user counts add anyone eligible to the completed_users set
               for(var username in user_counts){
                  if(user_counts[username] >= response_count){
                     completed_users.add(username);
                  }
               }

               query.involved_users = Array.from(involved_users);
               query.completed_users = Array.from(completed_users);
               query.conflict_count = conflict_count;

               // Reduce the number of remaining adjudications
               query.remaining_adjudications = query.required_adjudications - query.completed_users.length;

               console.log("--Saving Query: " + query._id);
               query.save();
               // If this is the last query we're processing email the user that we're done
               if(queries_processed == queries.length){
                  sendmail({
                     from: from_address,
                     to: user.email,
                     subject: "IMAC Adjudications Imported",
                     content: "Adjudications have been imported and the system is now ready to be used."
                  }, function (err, reply) {
                     console.log(err && err.stack);
                  });
               }
               callback();
            });
         });
      });

};

function replace_special(line) {
   for (var search in temp_map) {
      var re = new RegExp('\\\\\\' + search, "g");
      line = line.replace(re, temp_map[search]);
   }
   return line;
}

function restore_special(line) {
   if(Array.isArray(line)){
      // Recursion to handle multi-part fields
      line = line.map(function (l) {
         l = restore_special(l);
         return l;
      });
   } else {
      for (var replace in temp_map) {
         var re = new RegExp(temp_map[replace], "g");
         line = line.replace(re, replace);
      }
   }

   return line;
}

function parseRunString(run_string, project_id, default_priority, default_adjudications)  {
   var errFunc = function() {
      [].slice.call(arguments).forEach(function(arg) {
         console.log("getFormat: ", arg);
      });
   };
   var run_array_failsafe = replace_special(run_string).split((/\r?\n/));
   var inputFormats = formatHelper.getFormats(run_string, errFunc);
   if (inputFormats === null) {
      console.log("Could not determine input format for string: "+run_string);
      return parseRunArray(run_array_failsafe, project_id, default_priority, default_adjudications);
   }
   console.log("Detected input formats: ", inputFormats);

   //try all until one succeeds
   for(var F=0;F<inputFormats.length;F++) {
      var inputFormat = inputFormats[F];
      try {
         var errFuncConvert = function() {
            [].slice.call(arguments).forEach(function(arg) {
               console.log("convert error: ", arg);
            });
         };
         run_string = formatHelper.convert(run_string, errFuncConvert, inputFormat, 'IMAC');

         // if we get to here, then we're definitely parsing an IMAC-formatted thing.

         var run_array = replace_special(run_string).split((/\r?\n/));

         // handle the absence of an explicit key row
         if (run_array[0].indexOf('key=') < 0) {
            console.log("WARNING: auto-generating key line");
            //forward-copy all lines one position further to make room for artificial key line
            for(var i=run_array.length;i>0;i--) {
               run_array[i] = run_array[i-1];
            }
            //add empty key prefix
            run_array[0] = "key=";

            //determine key from first record of first line
            var line = run_array[1].trim().slice(1, -1); // Remove whitespace and leading/trailing '[', ']' characters
            line = replace_special(line); // Temporarily replace escaped special characters (\[, \], \|, \~) pre-split
            // Split line into query and response
            var firstQuery = line.indexOf('][') < 0 ? line.split('|') : line.split('][')[0].split('|');
            if (firstQuery.length <= 1) {
               console.log("The first query must contain AT LEAST an id and one other value")
               continue;
            }
            // add id field and auto-enumerate other fields in key (generically named)
            run_array[0] = run_array[0]+"id";
            for(var i=1;i<firstQuery.length;i++) {
               run_array[0] = run_array[0]+"|value"+i;
            }
         }

         //if we get to here, then we have an IMAC-formatted thing with a key row at the beginning

          // handle one-record per-line input, by auto-expanding to nlogn binary comparisons
         if (run_array[1].indexOf(']') === run_array[1].lastIndexOf(']')) {
            // there is only one closing brace on the first data line, so assume all lines have a single record
            console.log("WARNING: auto-pairing flat input");

            var records = run_array.slice(1); //all but key line
            run_array = run_array.slice(0,1); //just key line

            // rebuild run_array w/ comparisons of all (unordered) pairs
            for(var i=0; i<records.length;i++)
               for(var j=i+1;j<records.length;j++) {
                  run_array[run_array.length] = ""+records[i]+records[j];
               }
         }

         return parseRunArray(run_array, project_id, default_priority, default_adjudications);
      } catch (ex) {
         console.log("Exception handling as "+inputFormat, ex);
      }
   }
   return parseRunArray(run_array_failsafe, project_id, default_priority, default_adjudications);
}

function parseRunArray(run_array, project_id, default_priority, default_adjudications) {
   var projects = db.get().collection('projects');
   // Create 'queries' as an object to start so we can use the query id as an index to make sure
   // all response lines get placed into the correct query by using the query's id as a key
   var queries = {};
   var key_list = ['record_id', 'first', 'last', 'dob'];
   run_array.forEach(function (line, index) {
      // If line is blank, skip
      if (!(/\S/.test(line))) {
         return;
      }

      if (line.substr(0, 4) == 'key=') {
         key_list = line.substr(4).split('|');
      } else {
         var priority = default_priority;
         var req_adjudications = default_adjudications;

         // Remove whitespace and leading/trailing '[', ']' characters
         line = line.trim().slice(1, -1);

         // Temporarily replace escaped special characters (\[, \], \|, \~) pre-split
         line = replace_special(line);

         // Split line into query and response
         var line_pair = line.split('][');
         var query_array = line_pair[0].split('|');
         var response_array = line_pair[1].split('|');
         var query_id = query_array[0];
         var query = {};
         var response = {};


         // Build up the query and responses into discrete objects with values tied to keys
         key_list.forEach(function (key, index) {
            if (key == 'id') {
               key = 'record_id';
            }

            // Split up multi-part fields by '~' character
            if(query_array[index].includes('~')){
               query_array[index] = query_array[index].split('~');
            }
            if(response_array[index].includes('~')){
               response_array[index] = response_array[index].split('~');
            }

            // Replace the escaped special characters
            query_array[index] = restore_special(query_array[index]);
            response_array[index] = restore_special(response_array[index]);

            // Add the query fields to the query (this overwrites if we've seen the query before)
            query[key] = query_array[index];
            response[key] = response_array[index];
         });

         //Add the query data if this is the first time we're seeing this query
         if (!(query_id in queries)) {
            queries[query_id] = {};
            for (var key in query) {
               queries[query_id][key] = query[key];
            }
            // Initialize the responses array
            queries[query_id].responses = {};

            // Set the Project ID
            queries[query_id]._project = ObjectID(project_id);

            // Set priority and required adjudications, note that these values only get respected if set on the line for the first response
            queries[query_id].priority = priority;
            queries[query_id].required_adjudications = req_adjudications;

            // Initialize the 'remaining adjudications' to be decremented each time one is completed
            queries[query_id].remaining_adjudications = req_adjudications;

            // Initialize the 'completed users' array
            queries[query_id].completed_users = [];

         }

         queries[query_id].responses[response.record_id] = response;
      }
   });

   // After we've built up the queries object, convert it to an array
   var queries_array = [];
   for (var q_index in queries) {
      var query = queries[q_index];
      var response_array = [];
      for (var r_index in query.responses) {
         response_array.push(query.responses[r_index]);
      }
      query.responses = response_array;
      queries_array.push(query);
   }

   // Load the fields array into the project
   // todo: load this earlier and check the new fields against the existing fields to report out import errors
   Project.findById(project_id, function (err, project) {
      for (var key of key_list) {
         project.fields.addToSet(key);
      }
      project.save();
   });

   return queries_array;
}

exports.addRun = function (project_id, data, callback) {
   var queries = data.run_data;
   var default_priority = (data.default_priority != "--") ? parseInt(data.default_priority) : 2;
   var default_adjudications = (data.default_adjudications != "") ? parseInt(data.default_adjudications) : 2;

   if (!(queries.constructor === Array)) {
      queries = parseRunString(queries, project_id, default_priority, default_adjudications);
   }

   // Find All existing queries for this project
   Query.find({_project: project_id}, {record_id: 1, "responses.record_id": 1}, function (err, existing_queries) {
      var existing_query_record_ids = [];
      // Create an array of existing queries record id's so we can see if a record exists already
      for (var i = 0; i < existing_queries.length; i++) {
         existing_query_record_ids.push(existing_queries[i].record_id);
      }

      // Loop through each query that we're thinking about adding
      for (var query of queries) {
         // Grab the index of the existing query using the array we created above
         var query_index = existing_query_record_ids.indexOf(query.record_id);

         // If the new queries's doesn't have an index it doesn't exist, create it from scratch
         if (query_index === -1) {
            new Query(query).save();
         } else {
            // Grab the existing query if it does exist
            var q = existing_queries[query_index];

            // Create array of record_ids for existing responses
            var old_responses = [];
            for (var i = 0; i < q.responses.length; i++) {
               old_responses.push(q.responses[i].record_id);
            }

            // Loop through new responses
            for (var response of query['responses']) {
               // If the new response record_id doesn't exist then add this response
               // NOTE: Imports will NEVER UPDATE existing responses or query fields
               if (old_responses.indexOf(response.record_id) === -1) {
                  q.responses.push(response);
               }
            }
            q.save();
         }

      }
   });

   callback(null);
};

exports.getQuery = function (data) {


};

exports.getNextQuery = function (data, callback) {

   var project_id = data.project_id;
   var user_id = data.user_id;
   var query_search = {
      "_project": project_id,
      "completed_users": {$nin: [user_id]}, // Only returns queries the user has not already completed
      "remaining_adjudications": {$gt: 0}
   };
   if (data.query_id) {
      query_search['_id'] = data.query_id;
   }


   var project_object;
   var query_object;

   exports.getProjectInfo(project_id, function (err, project) {
      project_object = project;
      Query.findOne(query_search, {}, {sort: {priority: 1, remaining_adjudications: -1, times_served: 1}},
         function (err, query) {
            var query_object = query;
            var query_id = null;
            if (query) {
               query.times_served = query.times_served == undefined ? 1 : query.times_served + 1;
               query.save();
               query_id = query._id;
            } else if (data.query_id) {
               // If we were looking for a specific query and didn't find one recurse calling this function for the whole project
               data.query_id = undefined;
               exports.getNextQuery(data, callback);
               return;
            }
            return Judgement.find({_user: user_id, _query: query_id}, function (err, judgements) {
               // Index the judgements
               judgements_object = {};
               for (var i = 0; i < judgements.length; i++) {
                  judgements_object[judgements[i]._response.toString()] = judgements[i].mark == null ? ' record-maybe' : ' record-' + judgements[i].mark.toString();
               }
               callback(err, query_object, project_object, judgements_object);
               //callback({query: query_object, project: project_object, judgements: judgements});
            });
         });
   });
};

exports.getFieldLayout = function (project_id, callback) {
   Project.findById(project_id, {'field_layout': 1, 'alignment': 1}, callback);

   /*  return [
    ['surname'],
    ['dob'],
    ['nationality'],
    ['passport_number']
    ]; */
};

exports.convertLayout = function (options) {
   var delimiters = [', ', ' - ', ': ', ' '];
   var rows = [];
   var data = options.data;
   var compare = options.compare;
   for (var row of options.field_layout) {
      var row_content = "";
      for (var field_name of row) {
         // Check to see if we're dealing with a delimiter field
         if (delimiters.indexOf(field_name) != -1) {
            // Skip the delimiter if it's the first character
            if (row_content != "")
               // Add delimiter directly to the row content, replace spaces with &nbsp
               row_content += "<span class='field-delimiter deemphasize'>" + field_name.replace(/ /g, '\u00a0') + "</span> ";
         } else {
            var emphasis_class = 'deemphasize';
            if (compare != undefined) {
               emphasis_class = (data.get(field_name) === compare.get(field_name)) ? 'deemphasize' : 'emphasize';
            }

            if (data.get(field_name) == undefined || data.get(field_name) == "") {
               row_content += `<span class='blank-field field-data ${emphasis_class}'>::blank::</span> `; // Detect missing fields and put in a placeholder
            } else if(Array.isArray(data.get(field_name))){
               row_content += "<table class='multi-part-field'>";
               for(var field_part of data.get(field_name)){
                  row_content += `<tr><td class='field-data ${emphasis_class}'>` + safe_tags_replace(field_part) + "</td></tr>";
               }
               row_content += "</table>";
            } else {
               row_content += `<span class='field-data ${emphasis_class}'>` + safe_tags_replace(data.get(field_name)) + `</span> `; // Otherwise try to add the field's value
            }
         }
      }
      rows.push(row_content.trim());
   }
   return rows;
};

var tagsToReplace = {
   '&': '&amp;',
   '<': '&lt;',
   '>': '&gt;'
};

function replaceTag(tag) {
   return tagsToReplace[tag] || tag;
}

function safe_tags_replace(str) {
   return str.replace(/[&<>]/g, replaceTag);
}

function arraysEqual(a, b) {
   if (a === b) return true;
   if (a == null || b == null) return false;
   if (a.length != b.length) return false;

   // We don't care about the ordering of the arrays so we sort them here
   a = a.sort();
   b = b.sort();

   for (var i = 0; i < a.length; ++i) {
      if (a[i] !== b[i]) return false;
   }
   return true;
}

exports.markResponse = function (query_id, response_id, user_id, mark, fatigue, super_adjudication) {

   console.log("Updating: " + query_id + ", " + response_id + ", " + user_id);
   Query.findById(query_id,
      {
         record_id: 1,
         required_adjudications: 1,
         remaining_adjudications: 1,
         "responses._id": 1,
         "responses.record_id": 1,
         "responses.conflicted": 1,
         "responses.match": 1,
         "responses.super_adjudicated": 1,
         conflict_count: 1,
         completed_users: 1,
         involved_users: 1,
         conflicted: 1,
         _project: 1
      },
      function (err, query) {
         Judgement.findOneAndUpdate({
            _query: query_id,
            _response: response_id,
            _user: user_id,
            _project: query._project
         }, {
            $set: {
               _query: query_id,
               _response: response_id,
               _user: user_id,
               _project: query._project,
               mark: mark,
               fatigue: fatigue,
               super_adjudication: super_adjudication
            }
         }, {upsert: true}, function (err, result) {
            if (err) {
               console.log(err);
            } else {
               postMarkCheck(query, response_id, user_id, mark, fatigue, super_adjudication);
            }
         });
      });
};

function postMarkCheck(query, response_id, user_id, mark, fatigue, super_adjudication) {
   var query_id = query._id;
   var judgement_count = 0;
   var conflicted = false;

   // Check all judgements across all users for this query
   Judgement.find({_query: query_id}, function (err, judgements) {
      var true_count = 0;
      var false_count = 0;
      var maybe_count = 0;

      for (var judgement of judgements) {
         // If we're looking at this specific response, check for conflicts
         if (judgement._response == response_id) {
            if (judgement.mark === true) {
               true_count++;
            } else if (judgement.mark === false) {
               false_count++;
            } else if (judgement.mark === null) {
               maybe_count++;
            }
         }

         // If we're looking at a response from this user, increment their judgement count

         if (judgement._user == user_id) {
            judgement_count++;
         }
      }

      // If this response has both true and false judgements, or if it's got even one 'maybe', mark it as conflicted
      if ((true_count > 0 && false_count > 0) || maybe_count > 0) {
         conflicted = true;
      }

      query.involved_users.addToSet(user_id);
      var response_count = query.responses.length;
      // If the number of judgements for this user is equal to the number of responses, mark this user as 'complete'
      if (judgement_count >= response_count && !super_adjudication) {
         query.completed_users.addToSet(user_id);
         query.remaining_adjudications--;
      }

      var response = query.responses.id(response_id);

      // If this is a super adjudication set the super_adjudicated flag
      // and set the match flag according to this adjudication.
      if (super_adjudication) {
         response.super_adjudicated = true;
         response.match = mark;
      }

      // If we're not conflicted (or super adjudicated) declare the response as a true or false match
      if (!conflicted && response.super_adjudicated != true) {
         response.match = true_count > false_count;
      } else if (response.super_adjudicated != true) {
         response.match = undefined;
      }

      // Mark the response and query as conflicted (unless this response has already been super-adjudicated)
      if (conflicted && response.super_adjudicated != true) {
         response.conflicted = true;
      } else {
         // Remove the conflicted flag from the response
         response.conflicted = false;
      }

      var q_conflict = false;
      // Loop through each response to see if the query is conflicted
      var conflict_count = 0;
      for (var r of query.responses) {
         if (r.conflicted) {
            q_conflict = true;
            //todo: there might be an off-by-one error here if THIS response is conflicted?
            conflict_count++;
         }
      }


      // Set the query-level conflicted flag as appropriate
      query.conflicted = q_conflict;
      query.conflict_count = conflict_count;
      query.save();
      console.log("Query Post Mark Check Complete: " + query.record_id);

      // Spit out adjudication record to log
      var query_record_id = query.record_id;
      var response_record_id = query.responses.id(response_id).record_id;
      var log_string = query_record_id + '|' + response_record_id + '|' + user_id + '|' + mark + '|' + fatigue + '|' + super_adjudication + '\n';
      var file_path = __dirname+'/../adjudication_logs/log_' + query._project + '.txt';
      fs.appendFile(file_path, log_string, function (err) {
         if (err) {
            console.log(err);
         }
      });
   });
}

exports.updateQueries = function (query_updates) {

   Query.find({_id: {$in: query_updates.query_ids}}, function (err, queries) {
      for (var q of queries) {
         if (query_updates.priority != '') {
            q.priority = query_updates.priority;
         }
         // See if we're changing the required adjudications
         if (q.required_adjudications != query_updates.required_adjudications && query_updates.required_adjudications > 0) {
            // Update the required adjudications number
            q.required_adjudications = query_updates.required_adjudications;

            // Update the remaining adjudications number
            // Grab the number of currently done adjudications
            var completed_adjudications = q.completed_users.length;
            var remaining_adjudications = q.required_adjudications - completed_adjudications;

            // If the remaining adjudications would be less than zero, set it to zero instead
            q.remaining_adjudications = (remaining_adjudications > 0) ? remaining_adjudications : 0;
         }
         // Save any updates
         q.save(function (err) {
            console.log(err)
         });
      }
   });
};

exports.deleteQueries = function (queries) {
   console.log("Made it in to delete these queries:");
   console.log(queries);
   Query.remove({
      '_id': {$in: queries}
   }, function (err, q_objects) {
      if (err) {
         console.log(err)
      }
      ;
   });

};
