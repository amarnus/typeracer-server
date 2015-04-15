(function() {
  
  'use strict';
  
  var app = require('express')();
  var session = require('express-session');
  var RedisStore = require('connect-redis')(session);
  var bodyParser = require('body-parser');
  var server = require('http').Server(app);
  var io = require('socket.io')(server);
  var packageInfo = require('./package.json');
  var redis = require('redis');
  var redisClient = redis.createClient();
  var User = require('./lib/User')(redisClient);
  var _ = require('lodash');
  
  server.listen(4000);
  console.log(packageInfo.name + ' listening on port 4000...');
  
  app.use(session({
    name: _.snakeCase(packageInfo.name) + '.sid',
    store: new RedisStore(),
    resave: false,
    saveUninitialized: false,
    secret: 'sessionSecretString'
  }));
  
  app.get('/players', function(req, res) {
    User.getAllUsers(function(err, users) {
      if (err) {
        return res.status(500).json({ message: err }); 
      }
      res.json({
        count: users.length,
        users: users
      });
    });
  });
  
  app.post('/player/enter', bodyParser.json(), User.userFromSession, function(req, res) {
    var payload = req.body;
    var threeWeeks = 3 * 7 * 24 * 60 * 60 * 1000;
    if (req.user) {
      return res.status(400).json({
        message: 'You are already in an active session as ' + req.user.name + '!'
      });
    }
    if (!payload.name) {
      return res.status(400).json({
        message: '"name" is a required parameter'
      });
    }
    User.createUser(payload.name, req.ip, function(err, user) {
      if (err) {
        return res.status(500).json({
          message: err
        });
      }
      req.session.user_id = user.user_id;
       
      req.session.cookie.expires = new Date(Date.now() + threeWeeks);
      res.sendStatus(204);
    });
  });
  
  app.post('/player/exit', function(req, res) {
    req.session.destroy(function(err) {
      if (err) {
        return res.status(500).json({
          message: err
        });
      }
      res.sendStatus(204);
    });
  });
  
})();