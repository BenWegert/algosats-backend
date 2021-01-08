'use strict'
var mongoose = require('mongoose')
var Schema = mongoose.Schema

var Transaction = new Schema({
	id: {
		type: String,
		index: {unique: true}
	},
	user: {
		type: String,
		index: {unique: true}
	},
	info: {
		type: Schema.Types.Mixed
	},
	type: {
		type: String
	},
	status: {
		type: String
	},
	currency: {
		type: String
	},
	Created_date: {
		type: Date,
		default: Date.now
	},
});

module.exports = mongoose.model('Transaction', Transaction)