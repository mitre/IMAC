/*var db = require('../db');
 var ObjectID = require('mongodb').ObjectID;*/

var bcrypt = require('bcrypt-nodejs');
var sendmail = require('sendmail')();
var mongoose = require('mongoose');
//mongoose.connect('mongodb://localhost/imac');
var Schema = mongoose.Schema;
var from_address = 'imac@mitre.org';

/**
 * User Schema
 * @type {mongoose.Schema}
 */

var userSchema = new Schema({
   _id: String,
   password: String,
   email: String,
   admin: Boolean,
   password_reset_string: String,
   password_reset_timeout: Number,
   last_login: {type: Date, default: null}
});

var User = mongoose.model('User', userSchema);

var sessionSchema = new Schema({
   _id: String,
   expires: Date,
   session: new Schema({
      cookie: Object,
      passport: new Schema({
         user: new Schema({
            _id: String,
            admin: Boolean,
            email: String
         })
      })
   }, {strict: false})
});

var Session = mongoose.model('Session', sessionSchema);

exports.countUsers = function (callback) {
   User.count({}, callback);
};

exports.initialAdmin = function (data, callback) {
   // Add info for initial admin user, hardcode the username and admin settings
   admin = {
      _id: 'admin',
      password: data.password,
      email: data.email,
      admin: true
   };
   exports.createUser(admin, callback);
};

exports.createUser = function (data, callback) {
   // Create hash of password for storing in the DB
   var hash = bcrypt.hashSync(data.password);

   // If the data.admin flag has been explicitly set grant this new user admin
   var admin = data.admin === true;

   var user = new User({
      _id: data._id,
      password: hash,
      email: data.email,
      admin: admin
   });

   // Store data in the DB
   user.save(
      function (err, docs) {
         callback(err, docs);
      }
   );
};

exports.authenticate = function (_id, password, callback) {
   if (_id == null || password == null) {
      callback(false);
      return;
   }
   User.findById(_id, function (err, user) {
      if (user == null) {
         callback(false);
         return;
      }

      if (bcrypt.compareSync(password, user.password)) {
         user.last_login = new Date();
         user.save();
         callback({_id: _id, admin: user.admin, email: user.email});
      } else {
         callback(false);
      }
   });
};

exports.validateUsername = function (username, callback) {
   User.findById(username, function (err, user) {
      callback(user == null);
   });
};

exports.forgotPassword = function (username, origin, callback) {
   User.findById(username, function (err, user) {
      var messages = {};
      if (err || user == null) {
         messages['error_message'] = "Invalid Username";
      } else {
         // Generate time-expiring password link
         var random_number = Math.round(Math.random() * (10000000000000 - 100000000) + 100000000);
         var one_day = 86400000;
         var timestamp = Date.now() + one_day;
         var password_reset_string = random_number + "-" + timestamp;
         var reset_link = origin + "/password-reset/" + username + "/" + password_reset_string;
         user.password_reset_string = password_reset_string;
         user.password_reset_timeout = timestamp;
         user.save();

         // Trigger email to user
         sendmail({
            from: from_address,
            to: user.email,
            subject: 'IMAC Password Reset',
            html: "If you did not request this password reset email please disregard this message.<br>" +
            "This password reset link will be valid for the next 24 hours:<br>" +
            reset_link
         }, function (err, reply) {
            console.log(err && err.stack);
            console.dir(reply);
         });

         messages['status_message'] = "Password reset email sent to: " + user.email;
      }
      callback(messages);
   });
};

exports.checkResetString = function (username, reset_string, callback) {
   User.findById(username, function (err, user) {
      if (err || user == null) {
         callback(false);
      } else if (user.password_reset_string == reset_string && user.password_reset_timeout > Date.now()) {
         callback(true);
      } else {
         callback(false);
      }
   })
};

exports.resetPassword = function (data, callback) {
   if (data.password != data.confirm_password) {
      callback({error_message: "Passwords must match!"});
   } else {
      var hash = bcrypt.hashSync(data.password);
      exports.checkResetString(data.username, data.reset_string, function (canReset) {
         if (canReset) {
            User.findOneAndUpdate({_id: data.username}, {password: hash}, function (err, user) {
               if (err) {
                  callback({error_message: "Error updating user."});
               } else {
                  user.password_reset_string = null;
                  user.password_reset_timeout = null;
                  user.save();
                  sendmail({
                     from: from_address,
                     to: user.email,
                     subject: "IMAC Password Changed",
                     html: "The password for the account '" + user._id + "' has been changed. " +
                     "Please contact your administrator if this change was unexpected."
                  }, function (err, reply) {
                     console.log(err && err.stack);
                  });

                  callback({success: true});
               }
            });
         } else {
            callback({error_message: "Password Reset link expired or invalid."})
         }
      });
   }
};

exports.getUsers = function (callback) {
   User.find({}, {_id: 1, email: 1, admin: 1, last_login: 1}, {sort:{_id:1}}).then(callback);
};

exports.getActiveUsers = function (callback) {
   var active_timeout = new Date(Date.now() + 50 * 60 * 1000); // 10 minutes + expires timeout
   var last_active_diff = new Date(Date.now() + 60 * 60 * 1000); // One hour from now

   Session.aggregate([
      {$project: {"session.passport.user._id": 1, expires: 1}},
      {$match: {expires: {$gt: active_timeout}}},
      {$sort: {expires: 1}},
      { $group: {
         _id: "$session.passport.user._id",
         expires: {$max: "$expires"}
      }}
   ]).then(callback);
};

exports.getUserInfo = function (username, callback) {
   User.findOne({_id: username}, function(err, user){
      //console.log("I found this user: " + user._id);
      callback({_id: user._id, email: user.email, admin: user.admin});
   });
};

exports.updateUserInfo = function (updates, callback) {

   if(updates.password != null && updates.password != ""){
      updates.password = bcrypt.hashSync(updates.password);
   } else {
      delete updates.password;
   }

   User.findOneAndUpdate({_id: updates._id}, updates, function(err){
      if(err){
         console.log(err);
      } else{
         callback();
      }
   })
};
