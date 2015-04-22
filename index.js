(function() {
  
  'use strict';
  
  var express = require('express');
  var app = express();
  var session = require('express-session');
  var RedisStore = require('connect-redis')(session);
  var bodyParser = require('body-parser');
  var server = require('http').Server(app);
  var io = require('socket.io')(server);
  var packageInfo = require('./package.json');
  var redis = require('redis');
  var redisClient = redis.createClient();
  var User = require('./lib/User')(redisClient);
  var Game = require('./lib/Game')(redisClient);
  var _ = require('lodash');
  var async = require('async');
  
  server.listen(4000);
  console.log(packageInfo.name + ' listening on port 4000...');
  
  io.on('connection', function(socket) {
    console.log('New client just connected!');
    
    socket.on('hi', function() {
      console.log('Client says "Hi"!');
      socket.emit('hi');
    });
    
    socket.on('disconnect', function() {
      console.log('Client disconnected!');
    });
    
  });
  
  app.use(session({
    name: _.snakeCase(packageInfo.name) + '.sid',
    store: new RedisStore(),
    resave: false,
    saveUninitialized: false,
    secret: 'sessionSecretString',
    cookie: {
      httpOnly: false
    }
  }));
  
  app.use('/', express.static('react-app'));
  
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
  
  app.get('/player/me', User.userFromSession, function(req, res) {
    if (!req.user) {
      return res.sendStatus(404); 
    }
    res.json(req.user);
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
  
  app.post('/game/join', User.userFromSession, function(req, res) {
    var user = req.user;
    async.waterfall([
      function(cb1) {
        Game.joinGame(user.user_id, cb1);
      },
      function(gameId, cb1) {
        console.log(arguments);
        if (!gameId) {
          return Game.createGame(user.user_id, cb1);
        }
        return cb1(null, gameId);
      }
    ], function(err, gameId) {
      if (err) {
        return res.status(500).json({
          message: err
        });
      }
      return res.status(200).json({
        game_id: gameId
      });
    });
  });
  
})();