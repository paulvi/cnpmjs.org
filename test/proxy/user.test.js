/**!
 * cnpmjs.org - test/proxy/user.test.js
 *
 * Copyright(c) cnpmjs.org and other contributors.
 * MIT Licensed
 *
 * Authors:
 *  dead_horse <dead_horse@qq.com> (http://deadhorse.me)
 *  fengmk2 <fengmk2@gmail.com> (http://fengmk2.cnpmjs.org)
 */

'use strict';

/**
 * Module dependencies.
 */

var should = require('should');
var mm = require('mm');
var path = require('path');
var fs = require('fs');
var mysql = require('../../common/mysql');
var user = require('../../proxy/user');

var fixtures = path.join(path.dirname(__dirname), 'fixtures');

var mockUser = {
  name: 'mockuser',
  email: 'mockuser@cnpmjs.org',
  salt: 'xxxxx',
  password: 'mockpassworld',
  password_sha: user.passwordSha('mockpassworld', 'xxxxx'),
  ip: '127.0.0.1'
};

function initUser(done) {
  user.add(mockUser, function (err, data) {
    mockUser.rev = data.rev;
    done(err);
  });
}

function clean(done) {
  mysql.query('DELETE FROM user WHERE name=?', [mockUser.name], done);
}

describe('proxy/user.test.js', function () {
  before(clean);
  afterEach(mm.restore);
  afterEach(clean);

  describe('get()', function () {
    before(initUser);
    it('should get user ok', function (done) {
      user.get('mockuser', function (err, data) {
        should.not.exist(err);
        data.should.have.keys('id', 'rev', 'name', 'email', 'salt',
          'json', 'npm_user',
          'password_sha', 'ip', 'roles', 'gmt_create', 'gmt_modified');
        done();
      });
    });

    it('should get error when mysql error', function (done) {
      mm.error(mysql, 'query', 'mock error');
      user.get('mockuser', function (err) {
        err.message.should.equal('mock error');
        done();
      });
    });
  });

  describe('auth()', function () {
    before(initUser);
    it('should auth user ok', function (done) {
      user.auth(mockUser.name, mockUser.password, function (err, data) {
        should.not.exist(err);
        data.should.have.keys('id', 'rev', 'name', 'email', 'salt',
          'json', 'npm_user',
          'password_sha', 'ip', 'roles', 'gmt_create', 'gmt_modified');
        done();
      });
    });

    it('should auth user fail when user not exist', function (done) {
      user.auth('notexistmockuser', '123', function (err, data) {
        should.not.exist(err);
        should.not.exist(data);
        done();
      });
    });

    it('should auth fail when password error', function (done) {
      user.auth(mockUser.name, '123', function (err, data) {
        should.not.exist(err);
        should.not.exist(data);
        done();
      });
    });

    it('should auth error when mysql error', function (done) {
      mm.error(mysql, 'query', 'mock error');
      user.auth(mockUser.name, '123', function (err, data) {
        err.message.should.equal('mock error');
        done();
      });
    });
  });

  describe('add()', function () {
    it('should add ok', function (done) {
      user.add(mockUser, function (err, data) {
        should.not.exist(err);
        data.should.have.keys(['rev']);
        done();
      });
    });

    it('should add error when mysql error', function (done) {
      mm.error(mysql, 'query', 'mock error');
      user.add(mockUser, function (err, data) {
        err.message.should.equal('mock error');
        done();
      });
    });
  });

  describe('update()', function () {
    before(initUser);

    it('should update ok', function (done) {
      user.update(mockUser, function (err, data) {
        should.not.exist(err);
        should.exist(data);
        data.should.have.keys('rev', 'result');
        done();
      });
    });

    it('should update fail by wrong rev', function (done) {
      mockUser.rev = '1-error';
      user.update(mockUser, function (err, data) {
        should.not.exist(err);
        should.exist(data);
        data.result.affectedRows.should.equal(0);
        done();
      });
    });

    it('should update fail when rev format error', function (done) {
      mockUser.rev = 'error';
      user.update(mockUser, function (err, data) {
        err.message.should.equal('error format error');
        done();
      });
    });

    it('should error when mysql error', function (done) {
      mockUser.rev = '1-error';
      mm.error(mysql, 'query', 'mock error');
      user.update(mockUser, function (err, data) {
        err.message.should.equal('mock error');
        done();
      });
    });
  });

  describe('saveNpmUser()', function () {
    var existUser = JSON.parse(fs.readFileSync(path.join(fixtures, 'fengmk2.json')));
    var notExistUser = JSON.parse(fs.readFileSync(path.join(fixtures, 'fengmk2.json')));
    notExistUser.name = 'fengmk2-not-exists';

    before(function *() {
      yield mysql.query('delete from user where name=?', [notExistUser.name]);
    });

    it('should save npm user to exists user', function *() {
      yield user.saveNpmUser(existUser);
      var r = yield mysql.queryOne('select rev, json, npm_user from user where name=?', existUser.name);
      should.exist(r);
      r.npm_user.should.equal(0);
      r.rev.should.equal(existUser._rev);
      JSON.parse(r.json).should.eql(existUser);
    });

    it('should save npm user to not exists user and create it', function *() {
      yield user.saveNpmUser(notExistUser);
      var r = yield mysql.queryOne('select name, json, npm_user from user where name=?', notExistUser.name);
      r.name.should.equal(notExistUser.name);
      should.exist(r);
      r.npm_user.should.equal(1);
      JSON.parse(r.json).should.eql(notExistUser);
    });
  });
});
