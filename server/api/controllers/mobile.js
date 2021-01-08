'strict'

var passport = require('passport'),
	kraken = require('node-kraken-api'),
	api = kraken(),
	{ cache } = require('../../utils/cache')

const { param, validationResult } = require('express-validator')

exports.chart = async function(req, res, next) {
	const { symbol } = req.params;

	const errors = validationResult(req); // Finds the validation errors in this request and wraps them in an object with handy functions

	if (!errors.isEmpty()) {
		res.status(422).json({ errors: errors.array() });
		return;
	}
	else {
		passport.authenticate('jwt', {session: false}, async (err, user, info) => {
			if (user) {
				var data = cache.get('chart' + symbol)
				if (data !== undefined)
					res.json(data)
			}
			else
				res.status(401).send()
		})(req, res, next)	
	}
}  

exports.ticker = async function(req, res, next) {
	passport.authenticate('jwt', {session: false}, async (err, user, info) => {
		if (user) {
			res.json({
				btc: cache.get('btc'),
				eth: cache.get('eth'),
				xrp: cache.get('xrp'),
				pbtc: cache.get('percentBTC'),
				peth: cache.get('percentETH'),
				pxrp: cache.get('percentXRP')
			})
		}
		else
			res.status(401).send()
	})(req, res, next)
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