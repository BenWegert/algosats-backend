'use strict';


module.exports = function(app) {
	var controller = require('../controllers/mobile.js')

	app.route('/chart/:symbol').get(controller.validate('chart'), controller.chart)
	app.route('/ticker').get(controller.ticker)
}