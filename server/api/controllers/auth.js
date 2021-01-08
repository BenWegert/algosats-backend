'strict'

var mongoose = require('mongoose')
var User = mongoose.model('User');
var Token = mongoose.model('Token')
const jwt = require('jsonwebtoken');
var passport = require('passport');
var crypto = require('crypto')
const ipLocation = require("iplocation");
const DeviceDetector = require('node-device-detector');
const detector = new DeviceDetector;

const { header, body, validationResult } = require('express-validator')

exports.signup = function(req, res, next) {
	const { email, password } = req.body;

	const errors = validationResult(req); // Finds the validation errors in this request and wraps them in an object with handy functions

	if (!errors.isEmpty()) {
		res.status(422).json({ errors: errors.array() });
		return;
	}
	else {
		passport.authenticate('signup', { session : false }, async (err, user, info) => {
			if (err)
				res.status(403).send()
			else
				res.json({
					message : 'Signup successful',
					user : user
				});
		})(req, res, next);
	}
}

exports.login = function(req, res, next) {
	const { email, password } = req.body;

	const errors = validationResult(req); // Finds the validation errors in this request and wraps them in an object with handy functions

	if (!errors.isEmpty()) {
		res.status(422).json({ errors: errors.array() });
		return;
	}
	else {
		passport.authenticate('login', async (err, user, info) => {     
			try {
				if (err || !user){
					res.status(401).send();
				}
				else
					req.login(user, { session : false }, async (error) => {
						if ( error )
							return next(error)
						const body = { email: user.email };
						var location = {}
						await ipLocation(req.ip.split(':').pop() || '192.168.1.0').then(response => location = response).catch(err => {
							location = {reserved: true}
						})
						const device = detector.detect(req.headers['user-agent'])
						const token = jwt.sign({ user : body }, process.env.SECRET, { expiresIn: process.env.EXPIRE });
						const refresh = crypto.randomBytes(40).toString('hex')

						Token.updateOne(
							{
								id: refresh
							}, 
							{
								id: refresh,
								token: token,
								user: user.email,
								device: {
									type: device.device.type,
									os: device.os.name,
									os_version: device.os.version,
									client: device.client.name === "OkHttp" ? "Mobile App" : device.client.name,
									client_version: device.client.name === "OkHttp" ? "" : device.client.version
								},
								location: {
									name: location.reserved ? "Unknown location" : location.city + ", " + 
										location.region.code + ", " + location.country.name,
									ip: req.ip
								}
							}, 
							{
								upsert: true
							}, (err, result) => {
								if (!err)
									return res.json({ token, refresh });
								else
									return res.status(500).send();
							})
					});     
			}
			catch (error) {
				res.status(500).send();
				return next(error);
			}
		})(req, res, next);
	}
} 

exports.refresh = function(req, res, next) {
	const { refresh } = req.body;

	const errors = validationResult(req);
	const device = detector.detect(req.headers['user-agent'])

	if (!errors.isEmpty()) {
		res.status(422).json({ errors: errors.array() });
		return;
	}
	else {
		Token.findOne({id: refresh}, (err, token) => {
			if (err)
				return res.status(500).send()
			else if (token) {
				if (token.device.type == device.device.type && 
					token.device.os == device.os.name && 
					token.device.client == (device.client.name === "OkHttp" ? "Mobile App" : device.client.name)) {
					decoded = jwt.verify(token.token, process.env.SECRET, {ignoreExpiration: true}, (err, decoded) => {
						if (!err) {
							const email = decoded.user.email
							const body = { email : decoded.user.email };
						
							var newToken = jwt.sign({ user : body }, process.env.SECRET, { expiresIn: process.env.EXPIRE });
							Token.updateOne({id: refresh}, {token: newToken}, (err, result) => {
								if (err)
									return res.status(500).send()
								if (result.nModified === 1)
									res.json({ newToken })
								else
									res.status(401).send()
							})
						}
						else
							res.status(500).send()
					})
				}
				else 
					Token.deleteOne({id: refresh}, (err, result) => {
						if (err)
							return res.status(500).send()
						if (result.deletedCount === 1)
							res.status(403).send()
						else
							res.status(401).send()
					})
			}
			else
				res.status(401).send()
		})
	}
}

exports.logout = function(req, res, next) {
	const { refresh } = req.body;

	const errors = validationResult(req); // Finds the validation errors in this request and wraps them in an object with handy functions

	if (!errors.isEmpty()) {
		res.status(422).json({ errors: errors.array() });
		return;
	}
	else {
		Token.deleteOne({id: refresh}, (err, result) => {
			if (err)
				return res.status(500).send()
			if (result.deletedCount === 1)
				res.status(200).send()
			else
				res.status(401).send()
		})
	}
}

exports.getDevices = function(req, res, next) {
	passport.authenticate('jwt', {session: false}, async (err, user, info) => {
		if (user) {
			Token.find({user: user.email, token: { "$ne": req.headers['authorization'].split(' ').pop() }}, {'location.name': 1, device: 1}, (error, token) => {
				res.json(token)
			})
		}
		else
			res.status(401).send()
	})(req, res, next)
}

exports.removeDevices = function(req, res, next) {
	passport.authenticate('jwt', {session: false}, async (err, user, info) => {
		if (user) {
			const { _id } = req.body;

			const errors = validationResult(req); // Finds the validation errors in this request and wraps them in an object with handy functions

			if (!errors.isEmpty()) {
				res.status(422).json({ errors: errors.array() });
				return;
			}
			else {
				if (_id === 'all')
					Token.deleteMany({user: user.email, token: { "$ne": req.headers['authorization'].split(' ').pop() }}, (error, result) => {
						if (err)
							return res.status(500).send()
						if (result.deletedCount > 0)
							res.status(200).send()
						else
							res.status(401).send()
					})
				else
					Token.deleteOne({user: user.email, _id: _id, token: { "$ne": req.headers['authorization'].split(' ').pop() }}, (error, result) => {
						if (err)
							return res.status(500).send()
						if (result.deletedCount === 1)
							res.status(200).send()
						else
							res.status(401).send()
					})
			}
		}
		else
			res.status(401).send()
	})(req, res, next)
}

exports.profile = function(req, res, next) {
	passport.authenticate('jwt', {session: false}, async (err, user, info) => {
		if (user) {
			User.findOne({email: user.email}, (error, user) => {
				if (error)
					res.status(500).send()
				else if (user)
					res.json({
						user: user.email,
						wallet: user.wallet
					})
				else
					res.status(401).send()
			})
		}
		else
			res.status(401).send()
	})(req, res, next)
}  

exports.validate = (method) => {
	switch (method) {
		case 'signup': {
	    	return [
	    		body('email', "email not found").isEmail(),
	    		body('password', "pasword not found").notEmpty()
	    	]
    	}
    	case 'login': {
	    	return [
	    		body('email', "email not found").isEmail(),
	    		body('password', "pasword not found").notEmpty()
	    	]
    	}
		case 'refresh': {
	    	return [
	    		body('refresh', "refresh token not found").isLength({min:80, max: 80}),
	    	]
    	}
    	case 'logout': {
	    	return [
	    		body('refresh', "refresh token not found").isLength({min:80, max: 80})
	    	]
    	}
    	case 'removeDevices': {
	    	return [
	    		body('_id', "ID not found").isLength({min:3, max: 50})
	    	]
    	}
	}
}