'use strict';

module.exports = function(app) {
	var controller = require('../controllers/auth.js')
	var passport = require('passport');

	app.route('/signup').post(controller.validate('signup'), controller.signup)
	app.route('/login').post(controller.validate('login'), controller.login)
	app.route('/refresh').post(controller.validate('refresh'), controller.refresh)
	app.route('/logout').post(controller.validate('logout'), controller.logout)

	app.route('/devices').get(controller.getDevices)
	app.route('/devices').post(controller.validate('removeDevices'),controller.removeDevices)

	app.route('/profile').get(controller.profile)
}