var express = require('express');
var router = express.Router();
var Users = require('../models/users');
var moment = require('moment');

/* GET users listing. */
router.get('/', function (req, res, next) {
   // Send non-admin users back to the home page
   if(!req.user.admin){
      res.redirect('/imac/');
   }

   Users.getUsers(function (users) {
      for (user of users) {
         if(user.last_login){
            user.last_login_string = moment(user.last_login).format('MMMM Do YYYY, h:mm:ss a')
            user.since_last_login = moment(user.last_login).fromNow();
         } else {
            user.last_login_string = "--";
            user.since_last_login = "--";
         }
      }
      res.render('users', {admin: req.user.admin, user: req.user._id, users: users});
   });
});

module.exports = router;

router.get('/active-users', function (req, res, next) {
   // Make sure the current user is an admin
   if (!req.user.admin) {
      res.send('Only admins can see active users');
      return;
   }

   //
   Users.getActiveUsers(function (active_users) {
      var last_active_diff = new Date(Date.now() + 60 * 60 * 1000); // One hour from now

      for (var i = 0; i < active_users.length; i++) {
         var last_active = -(active_users[i].expires - last_active_diff);
         if (last_active >= 60000) {
            active_users[i].last_active = Math.round(last_active / 60000) + "m ago";
         } else {
            active_users[i].last_active = Math.round(last_active / 1000) + "s ago";
         }
      }
      res.render('active-users', {active_users: active_users});
   });

});

router.get('/edit/:id', function (req, res, next) {
   // Non-admin users can only edit their own data
   if (!req.user.admin && req.user._id != req.params.id) {
      req.flash('error', 'Only admins can edit other users.');
      res.redirect('/imac/');
      return;
   }
   Users.getUserInfo(req.params.id, function (user_data) {
      res.render('user', {user: req.user._id, admin: req.user.admin, user_data: user_data});
   })

});

router.post('/edit/:id', function (req, res, next) {
   // Non-admin users can only edit their own data
   if (!req.user.admin && req.user._id != req.params.id) {
      req.flash('error', 'Only admins can edit other users.');
      res.redirect('/imac/');
      return;
   }

   // Make sure non-admins aren't able to backdoor updating their 'admin' status
   if(!req.user.admin){
      delete req.body.admin;
   }

   // Save data, redirect to main page, display status message
   Users.updateUserInfo({
      _id: req.params.id,
      email: req.body.email,
      password: req.body.password,
      admin: req.body.admin == 'on'
   }, function () {
      req.flash('message', 'User settings updated.');
      res.redirect('/imac/users/');
   });

});