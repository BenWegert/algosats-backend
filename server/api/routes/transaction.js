'use strict';


module.exports = function(app) {
	var controller = require('../controllers/transaction.js')

	app.route('/deposit').get(controller.prepareDeposit)
	//app.route('/withdraw').get(controller.ticker)
}