const NodeCache = require( "node-cache" );

module.exports = {
	cache: new NodeCache( { stdTTL: 60, checkperiod: 25, deleteOnExpire: false }),
	btcTX: new NodeCache( { stdTTL: 720, checkperiod: 700, deleteOnExpire: false} )
};