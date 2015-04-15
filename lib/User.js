(function() {
  
  'use strict';
  
  var shortid = require('shortid');
  var async = require('async');
  var _ = require('lodash');
  
  var User = function(redisClient) {
    this.redisClient = redisClient;
  };
  
  var user;
  
  function createUser(name, ip) {
    return {
      user_id: 'user' + shortid.generate(),
      name: name,
      created: new Date().getTime(),
      ip: ip,
      stats: {
        matches_played: 0,
        average_speed: 0
      }
    };
  }
  
  User.prototype.getAllUsers = function(cb) {
    var self = this;
    async.waterfall([
      function(cb1) {
         self.redisClient.keys('typeracer_user_*_key', cb1);
      },
      function(keys, cb1) {
        async.map(keys, function(key, cb2) {
          self.redisClient.get(key, cb2);
        }, cb1);
      }
    ],
      function(err, usersJson) {
        if (err) {
          return cb(err);
        }
        return cb(null, _.map(usersJson, JSON.parse));
      }
    );
  };
  
  User.prototype.getUser = function(userId, cb) {
    this.redisClient.get('typeracer_user_' + userId + '_key', function(err, val) {
      if (err) {
        return cb(err);
      }
      cb(null, JSON.parse(val));
    });
  };
  
  User.prototype.createUser = function(name, ip, cb) {
    var user = createUser(name, ip);
    this.redisClient.set('typeracer_user_' + user.user_id + '_key', JSON.stringify(user), function(err) {
      if (err) {
        return cb(err); 
      }
      cb(null, user);
    });
  };
  
  User.prototype.userFromSession = function(req, res, next) {
    if (req.session.user_id) {
      user.getUser(req.session.user_id, function(err, user) {
        if (err) {
          return next(err);
        }
        req.user = user;
        next();
      });
    }
    else {
      next();
    }
  };
  
  module.exports = function(redisClient) {
    user = new User(redisClient);
    return user;
  };
  
})();