(function() {
  
  'use strict';
  
  var shortid = require('shortid');
  var async = require('async');
  var _ = require('lodash');
  
  var Game = function(redisClient) {
    this.redisClient = redisClient;
  };
  
  function createGame(userId) {
    return {
      game_id: 'game' + shortid.generate(),
      created: new Date().getTime()
    };
  }
  
  Game.prototype.joinGame = function(userId, cb) {
    var self = this;
    var _gameId = false;
    async.waterfall([
      function(cb1) {
        self.redisClient.srandmember('typeracer_games_waiting_set', cb1);
      },
      function(gameId, cb1) {
        if (!gameId) {
          return cb1(null);
        }
        _gameId = gameId;
        var multi = self.redisClient.multi();
        multi.srem('typeracer_games_waiting_set', _gameId);
        multi.sadd('typeracer_game_' + _gameId + '_players_set', userId);
        multi.sadd('typeracer_games_running_set', _gameId);
        multi.exec(cb1);
      }
    ],
      function(err) {
        if (err) { return cb(err); }
        return cb(null, _gameId);
      }
    );
  };
  
  Game.prototype.createGame = function(userId, cb) {
    var game = createGame(userId);
    var multi = this.redisClient.multi();
    multi.set('typeracer_game_' + game.game_id + '_key', JSON.stringify(game));
    multi.sadd('typeracer_game_' + game.game_id + '_players_set', userId);
    multi.sadd('typeracer_games_waiting_set', game.game_id);
    async.waterfall([
      function(cb1) {
        multi.exec(cb1);
      }
    ],
      function(err) {
        if (err) { return cb(err); }
        return cb(null, game.game_id);
      }
    );
  };
  
  module.exports = function(redisClient) {
    return new Game(redisClient);
  };
  
})();