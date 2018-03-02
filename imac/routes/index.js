var express = require('express');
var fs = require('fs');

var router = express.Router();


var http = require('http');

var db = require('../db');
var Projects = require('../models/projects');

router.get('/', function (req, res, next) {
   var passport = req._passport;
   console.log(req.user);
   Projects.getProjects(false, req.user._id, function (projects) {
      Projects.getPendingProjects(false, function (err, pending_projects) {
         res.render('index', {
            title: 'Adjudication Tool',
            'data': projects,
            archive: false,
            pending_projects: pending_projects
         });
      });
   });
});


router.get('/projects/archived/', function (req, res, next) {
   Projects.getProjects(true, req.user._id, function (projects) {
      Projects.getPendingProjects(true, function (err, pending_projects) {
         res.render('archived', {
            title: 'Archived Projects',
            data: projects,
            archive: true,
            pending_projects: pending_projects
         });
      });
   });
});

router.get('/project/:id', function (req, res, next) {
   Projects.getProjectInfo(req.params.id, function (err, project) {
      var title_string = '';
      if (req.params.id == 'new') {
         project = {};
         project._id = 'new';
         title_string = 'Create New Project';
      } else {
         title_string = 'Project Settings'
      }
      Projects.getQueries(project._id, function (err, queries) {
         res.render('project', {
            title: title_string,
            project: project,
            queries: queries
         });
      });
   });
});

router.post('/project/edit/:id', function (req, res, next) {
   Projects.insertUpdate(req.body, function (project, is_new) {
      if (is_new) {
         req.flash('message', 'Project Created');
         res.redirect('/imac/import/' + project._id);
      } else {
         req.flash('message', 'Project Updated');
         res.redirect('/imac/');
      }
   });
});

router.get('/project/archive/:id/:archive', function (req, res, next) {
   var archive = req.params.archive == 'true';
   Projects.archiveProject(req.params.id, archive, function (err, doc) {
      if (err) {
         res.send(err);
      } else {
         res.send("Project Successfully Updated!");
      }
   });
});

router.get('/query/delete/:id', function (req, res, next) {
   Projects.deleteQueries([req.params.id]);
   res.send("Successful Delete");
});

router.post('/query/delete', function (req, res, next) {
   Projects.deleteQueries(req.body['queries[]']);
   res.send("Successful Delete");
});

router.post('/query/edit', function (req, res, next) {
   Projects.updateQueries(JSON.parse(req.body.query_updates), function () {
      res.send("Successful Edit");
   });
   res.send("Successful Edit");
});

router.get('/import/:id', function (req, res, next) {
   Projects.getProjectInfo(req.params.id, function (err, project) {
      var action = '/imac/import/' + project._id;
      res.render('import', {
         title: "Import Data: " + project.name,
         project: project,
         action: action
      });
   });
});

router.post('/import/:id', function (req, res, next) {
   var project_id = req.body.project_id;
   var data = {
      default_priority: req.body.default_priority,
      default_adjudications: req.body.default_adjudications
   };

   if (req.files) {
      data.run_data = req.files.import_file.data.toString();
   } else {
      data.run_data = req.body.run_data
   }
   Projects.addRun(project_id, data, function (err) {
      if (err) {
         req.flash('error', 'Import Unsuccessful');
         res.redirect('/imac/import/' + project_id);
      } else {
         req.flash('message', 'Queries Imported');
         res.redirect('/imac/project/' + project_id);
      }
   });
});

router.get('/export/:id', function (req, res, next) {
   var project_id = req.params.id;
   var filename = 'log_' + project_id + '.txt';
   var file = __dirname+'/../adjudication_logs/' + filename;

   var can_read = fs.access(file, function (err) {
      if (err) {
         res.send({messages: [{message_class: 'error', content: "No adjudication log file exists for this project."}]});
      } else {
         res.setHeader('Content-disposition', 'attachment; filename=' + filename);
         res.setHeader('Content-type', 'text/plain');

         var filestream = fs.createReadStream(file);
         filestream.pipe(res);
      }
   });


});

router.get('/judge/:id', function (req, res, next) {
   Projects.getFieldLayout(req.params.id, function (err, project) {
      if (project == undefined) {
         res.redirect('/imac/');
         return;
      }
      var field_layout = project.get('field_layout');
      var alignment = project.alignment;
      var data = {
         project_id: req.params.id,
         query_id: req.query.query_id,
         user_id: req.user._id
      };

      if (field_layout == undefined) {
         //todo: alert user that they've been redirected, and why
         res.redirect('/imac/');
      }

      Projects.getNextQuery(data, function (err, query, project, judgements) {
         if (err) {
            console.log(err);
         }
         else {
            // If we've actually got a query...
            if (query != null) {
               // Convert field data into data rows
               query.data_rows = Projects.convertLayout({data: query, field_layout: field_layout});
               for (var i = 0; i < query.responses.length; i++) {
                  //console.log("Value of i: " + i);
                  query.responses[i].data_rows = Projects.convertLayout({
                     data: query.responses[i],
                     field_layout: field_layout,
                     compare: query
                  });
               }
            }

            res.render('adjudicate', {
               title: 'Adjudicate',
               project_id: req.params.id,
               project: project,
               query: query,
               alignment: alignment,
               judgements: judgements,
               view: req.query.view ? req.query.view : 'full'
            });
         }
      });
   })


});

router.get('/review/:id', function (req, res, next) {
   // Variables:
   //   adjudicators[] - list of involved usernames
   //   queries[]
   //     .id
   //     .rows[] - list of rows
   //     .is_conflicted
   //     .responses
   //     [response]
   //      .id
   //      .rows
   //      .true_users[]
   //      .false_users[]
   //var adjudicators = ['admin', 'martin', 'joe', 'bill'];


   Projects.getReviewQueries(req.params.id,
      function (review_info) {
         res.render('review', {
            title: 'Review Adjudications',
            adjudicators: review_info.involved_users,
            queries: review_info.queries,
            project_id: req.params.id,
            conflicted_count: review_info.conflicted_count
         });
      });
});

router.get('/review/responses/:id/:query_id', function (req, res, next) {
   Projects.getReviewResponses({
      project_id: req.params.id,
      query_id: req.params.query_id,
      callback: function (review_info) {
          res.render('review-responses', {responses: review_info.queries[0].responses, project_id: req.params.id});
      }
   });
});

router.get('/review/:id/:query_id', function (req, res, next) {
   Projects.getReviewResponses({
      project_id: req.params.id,
      query_id: req.params.query_id,
      callback: function (review_info) {
         res.render('superadjudicate', {review_info: review_info, project_id: req.params.id});
      }
   });
});

router.get('/rest/mark/:query_id/:response_id/:mark/:fatigue/:super', function (req, res, next) {
   res.type('json');
   var params = req.params;
   var mark;
   // Distinguish between 'maybe' and true/false
   if (params.mark == 'maybe') {
      mark = null;
   } else {
      // Convert 'mark' to boolean
      mark = params.mark == 'true';
   }
   var fatigue = params.fatigue == 'true';
   var super_adjuication = params.super == 'true';

   Projects.markResponse(params.query_id, params.response_id, req.user._id, mark, fatigue, super_adjuication);

   res.send("success");
});

// Adjudication Import Code
router.get('/import/judgements/:id', function (req, res, next) {
   if(!req.user.admin){
      req.flash('error', 'Only admins can import adjudications.');
      res.redirect('/imac/');
   }

   Projects.getProjectInfo(req.params.id, function (err, project) {
      var action = '/imac/import/judgements/' + project._id;
      res.render('import-judgements', {
         title: "Import Adjudications: " + project.name,
         project: project,
         user: req.user._id,
         action: action
      });
   });
});

router.post('/import/judgements/:id', function (req, res, next) {
   if(!req.user.admin){
      req.flash('error', 'Only admins can import adjudications.');
      res.redirect('/imac/');
   }

   var project_id = req.body.project_id;
   var data = {};
   data.user = req.user;

   if (req.files) {
      data.judgements = req.files.import_file.data.toString();
   } else {
      data.judgements = req.body.run_data;
   }

   Projects.addJudgements(project_id, data, function (err) {
      if (err) {
         res.send(err);
      } else {
         req.flash('message', 'Adjudication import started. Please allow for 30 minutes before continuing with adjudications.')
         res.redirect('/imac/');
      }
   })
});

module.exports = router;
