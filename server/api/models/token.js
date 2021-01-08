'use strict'
var mongoose = require('mongoose')
var Schema = mongoose.Schema

var Token = new Schema({
	id: {
		type: String,
		index: {unique: true}
	},
	token: {
		type: String,
	},
	user: {
		type: String,
	},
	device: {
		type: {
			type: String,			
		},
		os: {
			type: String,
		},
		os_version: {
			type: String,
		},
		client: {
			type: String,
		},
		client_version: {
			type: String,
		}
	},
	location: {
		name: {
			type: String,
		},
		ip: {
			type: String,
		}
	},
	expireAt: {
		type: Date,
		default: Date.now
	}
});

Token.index({ expireAt: 1 }, { expireAfterSeconds: 3600 * 24 * 365});
Token.index({ user: 1 })

module.exports = mongoose.model('Token', Token)