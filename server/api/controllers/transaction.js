'strict'

var passport = require('passport'),
	{ cache } = require('../../utils/cache'),
	mongoose = require('mongoose'),
	User = mongoose.model('User')

const { param, validationResult } = require('express-validator')

exports.prepareDeposit = async function(req, res, next) {
	//passport.authenticate('jwt', {session: false}, async (err, user, info) => {
		var user = {email: 'test@gmail.com'}
		if (user) {
			const user1 = await User.findOne({email: 'test@gmail.com'})
			res.json(await user1.getAddress())
		}
		else
			res.status(401).send()
	//})(req, res, next)
} 

exports.validate = (method) => {
	switch (method) {
		case 'chart': {
	    	return [
	    		param('symbol', "Invalid symbol").isIn(['btc', 'eth', 'xrp']),
	    	]
    	}
	}
}