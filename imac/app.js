var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var busboyBodyParser = require('busboy-body-parser');
var bodyParser = require('body-parser');
var session = require('express-session');
var mongoose = require('mongoose');
var MONGO_HOST = (process.env.MONGO_HOST || 'localhost')
var MONGO_PORT = (process.env.MONGO_PORT || '27017')
var MONGO_URL = 'mongodb://' + MONGO_HOST + ':' + MONGO_PORT + '/imac'
mongoose.connect(MONGO_URL);
var MongoStore = require('connect-mongo')(session);
var connect_ensure_login = require('connect-ensure-login');

var routes = require('./routes/index');
var user_routes = require('./routes/users');
var flash = require('connect-flash');
var Users = require('./models/users');

var app = express();

var helmet = require('helmet');

var db = require('./db');

// Connect to Mongo on start
db.connect(MONGO_URL, function (err) {
   if (err) {
      console.log('Unable to connect to Mongo.');
      process.exit(1);
   }
});

var passport = require('passport');
var Strategy = require('passport-local').Strategy;

passport.use(new Strategy({
      usernameField: '_id'
   },
   function (_id, password, done) {
      console.log('Login: ' + _id);

      Users.authenticate(_id, password, function (user) {
         if (user === false) {
            return done(null, user);
         } else {
            return done(null, user);
         }
      });
   })
);

//persisting sessions to a DB is the correct thing to do here in the long run
// For now they are just in memory
passport.serializeUser(function (user, done) {
   done(null, user);
});

passport.deserializeUser(function (user, done) {
   done(null, user);
});

// protect from clickjacking, xss, mime-sniffing, cross-site injection, and hides X-Powered-By header
// disable hsts because we're not using TLS
app.use(helmet());

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

app.use(favicon(__dirname + '/public/favicon.ico'));
app.use(logger('dev'));
app.use(busboyBodyParser({limit: '100mb'}));
app.use(bodyParser.json({limit: '100mb'}));
app.use(bodyParser.raw({limit: '100mb'}));
app.use(bodyParser.urlencoded({extended: false, limit: '100mb'}));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// Initialize Passport and restore authentication state, if any, from the
// session.

app.use(session({
   secret: 'imac',
   store: new MongoStore({
      mongooseConnection: mongoose.connection,
      ttl: 60 * 60, // 1 hour session
      stringify: false
   })
}));
app.use(passport.initialize());
app.use(passport.session());
app.use(flash());

app.get('/',
   function (req, res) {
      res.redirect('/login');
   }
);

// Pass admin and session information to all views
app.use(function (req, res, next) {
   if(req.user){
      res.locals.admin = req.user.admin;
      res.locals.user = req.user._id;
      res.locals.messages = req.flash('message');
      res.locals.errors = req.flash('error');
   }
   next();
});

// Set up logged in Routes
app.use('/imac', connect_ensure_login.ensureLoggedIn(), routes);
app.use('/imac/users', connect_ensure_login.ensureLoggedIn(), user_routes);

app.get('/login', function (req, res) {
   Users.countUsers(function (err, result) {
      if (result > 0) {
         var error_message = req.query.failure == 'true' ? 'Incorrect username or password' : '';
         var redirect = req.query != undefined ? req.query.redirect : '';

         res.render('login', {error_message: error_message, redirect: redirect});
      } else {
         res.render('create-first-admin');
      }
   });
});

app.post('/login',
   passport.authenticate('local', {failureRedirect: '/login?failure=true'}),
   function (req, res) {
      if (req.body.redirect != '') {
         if (req.body.redirect.indexOf('/imac') === 0) {
            //relative to site base - redirect!
            res.redirect(req.body.redirect);
            return;
         }
         if (req.body.redirect.indexOf('imac') === 0) {
            //relative to site base - redirect!
            res.redirect('/'+req.body.redirect);
            return;
         }
         if (req.body.redirect.indexOf(req.protocol+'://'+req.get('host')) === 0) {
            //absolute URL for correct hostname, so redirect blindly
            res.redirect(req.body.redirect);
            return;
         }
         // NO! THIS WOULD BE CROSS-SITE!
         console.log('NOT redirecting to '+req.body.redirect);
      }
      //default to /imac
      res.redirect('/imac');
   });

app.post('/create-first-admin', function (req, res) {
   Users.initialAdmin(req.body, function (err, docs) {
      res.redirect('/login');
   })
});

app.get('/validate-username/:id', function (req, res) {
   Users.validateUsername(req.params.id, function (isValid) {
      res.send(isValid);
   });
});

app.get('/create-account', function (req, res) {
   res.render('create-account');
});

app.post('/create-account', function (req, res) {
   Users.createUser(req.body, function (err, docs) {
      res.redirect('/login');
   });
});

app.get('/forgot-password', renderForgotPassword);
app.get('/forgot-password/:username', renderForgotPassword);

function renderForgotPassword(req, res) {
   var username = req.params.username == undefined ? null : req.params.username;
   res.render('forgot-password', {username: username});
}

app.post('/forgot-password', function (req, res) {
   var username = req.body._id;
   Users.forgotPassword(username, req.get('origin'), function (messages) {
      res.render('forgot-password', messages);
   });
});

app.get('/password-reset/:username/:reset_string', function (req, res) {
   var username = req.params.username;
   var reset_string = req.params.reset_string;
   Users.checkResetString(username, reset_string, function (canReset) {
      if (canReset) {
         res.render('logged-out-password-reset', {username: username, reset_string: reset_string});
      } else {
         res.render('login', {error_message: "Password Reset link expired or invalid."})
      }
   })
});

app.post('/password-reset', function (req, res) {
   Users.resetPassword(req.body, function (response) {
      if (response.success) {
         res.render('login', {error_message: "Password successfully reset"});
      } else {
         res.render('logged-out-password-reset', response);
      }
   })
});

app.get('/logout',
   function (req, res) {
      req.logout();
      res.redirect('/login');
   });

// catch 404 and forward to error handler
app.use(function (req, res, next) {
   var err = new Error('Not Found');
   err.status = 404;
   next(err);
});

// error handlers

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
   app.use(function (err, req, res, next) {
      res.status(err.status || 500);
      res.render('error', {
         message: err.message,
         error: err
      });
   });
}

// production error handler
// no stacktraces leaked to user
app.use(function (err, req, res, next) {
   res.status(err.status || 500);
   res.render('error', {
      message: err.message,
      error: {}
   });
});


module.exports = app;
