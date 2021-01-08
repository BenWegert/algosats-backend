require("dotenv").config();

var express = require("express"),
  app = express(),
  port = process.env.PORT || 3001,
  mongoose = require("mongoose"),
  bodyParser = require("body-parser"),
  cookieParser = require("cookie-parser"),
  corsOption = {
    origin: true,
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
    credentials: true,
    exposedHeaders: ["x-auth-token"],
  },
  cors = require("cors"),
  WebSocket = require("ws"),
  jwt = require("jsonwebtoken"),
  kraken = require("node-kraken-api"),
  { cache, btcTX } = require("./utils/cache"),
  Binance = require("binance-api-node").default,
  binanceWS = Binance(),
  { WSv2 } = require("bitfinex-api-node"),
  krakenAPI = kraken(),
  bitfinexWS = new WSv2({ transform: true }),
  Bitcoin = require("bitcoin-core"),
  bip32 = require("bip32"),
  nodeBTC = new Bitcoin({
    headers: "false",
    host: "localhost",
    network: "regtest",
    password: "test",
    username: "test",
    ssl: {
      enabled: false,
      strict: false,
    },
    port: process.env.BTC_PORT,
    timeout: "3000",
  });
//testbet 18332
//regtest 18443

// nodeBTC.getWalletInfo().then(wallet => {
// 	console.log(wallet[0].hdseedid)
// });
var zmq = require("zeromq");
var bitcoin = require("bitcoinjs-lib");

var Web3 = require("web3");
var net = require("net");
var Web3Eth = require("web3-eth");
var web3 = new Web3(
  new Web3.providers.IpcProvider("/Users/benwe/Library/Ethereum/geth.ipc", net)
);

// var eth = new Web3Eth('ws://localhost:8546');

// eth.getAccounts().then(accounts => console.log(accounts));

// var subscription = eth.subscribe('logs', {
//     address: '0x6cB792531094050C420B6A4e7073',
//     topics: ['0x6cB792531094050C420B6A4e']
// }, function(error, result){
//     if (!error)
//         console.log(result);
// });

// var subscription = eth.subscribe('syncing', function(error, sync){
//     if (!error)
//         console.log(sync);
// })
// .on("data", function(sync){
//     console.log(data)
// })
// .on("changed", function(isSyncing){
//     if(isSyncing) {
//         // stop app operation
//     } else {
//         // regain app operation
//     }
// });

// subscription.on('connected', data => console.log(data))

var info = {
  "1d": {
    interval: 5,
    length: 288,
  },
  "1w": {
    interval: 60,
    length: 168,
  },
  "1m": {
    interval: 240,
    length: 168,
  },
  "1y": {
    interval: 1440,
    length: 336,
  },
  all: {
    interval: 21600,
    length: 400,
  },
};
var pairs = {
  btc: "XXBTZCAD",
  eth: "XETHZCAD",
  xrp: "XXRPZCAD",
};

// MODELS
require("./api/models/user");
require("./api/models/token");
require("./api/models/transaction");

require("./utils/passport.js");

cache.set("sdasd", 23);

mongoose.Promise = global.Promise;
mongoose.set("useCreateIndex", true);
mongoose.set("useFindAndModify", false);
mongoose.connect(
  process.env.MONGO_DB1 || "mongodb://localhost/algo",
  { useNewUrlParser: true, useUnifiedTopology: true },
  (err) => {
    if (err) {
      console.log("Error occurred while connecting to MongoDB Atlas...\n", err);
    }
    console.log("Connected to MongoDB");
  }
);

app.use(cookieParser());
app.enable("trust proxy");

app.use(cors(corsOption));
app.set("trust proxy", true);

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// ROUTES
var user = require("./api/routes/auth");
var mobile = require("./api/routes/mobile");
var transaction = require("./api/routes/transaction");

//ADD
user(app);
mobile(app);
transaction(app);

app.listen(port, () => {
  console.log(`Listening on ${port}`);
});

var User = mongoose.model("User");

async function runBlock() {
  const sock = new zmq.Subscriber();

  sock.connect("tcp://127.0.0.1:2998");
  sock.subscribe("hashblock");

  for await (const [topic, message] of sock) {
    var block = message.toString("hex");
    scanBlock(block);
  }
}

async function runTX() {
  const sock = new zmq.Subscriber();

  sock.connect("tcp://127.0.0.1:2997");
  sock.subscribe("hashtx");

  for await (const [topic, message] of sock) {
    var TX = message.toString("hex");
    scanTX(TX);
  }
}

function initializeBTC() {
  User.find(
    { transactions: { $elemMatch: { status: "pending" } } },
    { transactions: 1, _id: 0 },
    (err, user) => {
      var arr = [];
      user.forEach((n) => {
        n.transactions.forEach((tx) => {
          btcTX.set(tx.id, null);
        });
      });
    }
  );
}

initializeBTC();
runBlock();
runTX();

function scanBlock(block) {
  nodeBTC
    .getBlock(block)
    .then(async (block) => {
      console.log("BLOCK CREATED");
      var list = btcTX.keys();
      for await (tx of list) {
        nodeBTC
          .getTransaction(tx, true)
          .then(async (tx) => {
            const user = await User.findOne({ email: tx[0].details[0].label });
            user.updateTransaction(tx[0]);
          })
          .catch((e) => {});
      }
    })
    .catch((e) => {});
}

function scanTX(tx) {
  nodeBTC
    .getTransaction(tx, true)
    .then(async (tx) => {
      const user = await User.findOne({ email: tx[0].details[0].label });
      user.updateTransaction(tx[0]);
    })
    .catch((e) => {});
}

getExchangeRates();
for (symbol of Object.keys(pairs)) {
  getCandles("chart" + symbol);
}

function getExchangeRates() {
  krakenAPI
    .call("Ticker", { pair: "USDTCAD,XBTCAD,ETHCAD,XRPCAD", count: 1 })
    .then((data) => {
      cache.set("kraken", null);
      if (data.USDTCAD) {
        cache.set("krakenCAD", data.USDTCAD.b[0]);
      }
      if (data.XXBTZCAD) {
        cache.set("krakenBTC", data.XXBTZCAD.c[0]);
      }
      if (data.XETHZCAD) {
        cache.set("krakenETH", data.XETHZCAD.c[0]);
      }
      if (data.XXRPZCAD) {
        cache.set("krakenXRP", data.XXRPZCAD.c[0]);
      }
      // if (data.LTCUSDT) {
      // 	cache.set('krakenLTC', data.LTCUSDT.c[0])
      // }
    })
    .catch((err) => console.error(err));
}

async function getCandles(key) {
  var symbol = key.replace("chart", "");
  var newData = {};
  for await (const interval of Object.keys(info)) {
    await krakenAPI
      .call("OHLC", { pair: pairs[symbol], interval: info[interval].interval })
      .then((response) => {
        newData[interval] = response[pairs[symbol]].splice(
          response[pairs[symbol]].length - info[interval].length,
          response[pairs[symbol]].length
        );
      })
      .catch((err) => console.error(err));
  }
  cache.set(key, newData);
}

cache.on("expired", function (key, value) {
  if (key === "kraken") getExchangeRates();
  else if (key.startsWith("chart")) {
    getCandles(key);
  }
});

bitfinexWS.on("error", (err) => console.log(err));
bitfinexWS.on("open", () => {
  bitfinexWS.subscribeTicker("tBTCUSD");
  bitfinexWS.subscribeTicker("tETHUSD");
  //bitfinexWS.subscribeTicker('tLTCUSD')
  bitfinexWS.subscribeTicker("tXRPUSD");
});
bitfinexWS.onTicker({ symbol: "tBTCUSD" }, (ticker) => {
  cache.set("bfxBTC", ticker.lastPrice);
});
bitfinexWS.onTicker({ symbol: "tETHUSD" }, (ticker) => {
  cache.set("bfxETH", ticker.lastPrice);
});
// bitfinexWS.onTicker({ symbol: 'tLTCUSD' }, (ticker) => {
// 	cache.set('bfxLTC', ticker.lastPrice)
// })
bitfinexWS.onTicker({ symbol: "tXRPUSD" }, (ticker) => {
  cache.set("bfxXRP", ticker.lastPrice);
});
bitfinexWS.open();

binanceWS.ws.ticker(["BTCUSDT", "ETHUSDT", "XRPUSDT"], (ticker) => {
  if (ticker.symbol === "BTCUSDT") {
    cache.set("binanceBTC", ticker.curDayClose);
    cache.set("percentBTC", ticker.priceChangePercent);
  } else if (ticker.symbol === "ETHUSDT") {
    cache.set("binanceETH", ticker.curDayClose);
    cache.set("percentETH", ticker.priceChangePercent);
  }
  // else if (ticker.symbol === 'LTCUSDT'){
  // 	cache.set('binanceLTC', ticker.curDayClose)
  // 	cache.set('percentLTC', ticker.priceChangePercent)
  // }
  else if (ticker.symbol === "XRPUSDT") {
    cache.set("binanceXRP", ticker.curDayClose);
    cache.set("percentXRP", ticker.priceChangePercent);
  }
});

const wss = new WebSocket.Server({
  verifyClient: async (info, done) => {
    const token = info.req.url.split("/")[1];
    jwt.verify(token, process.env.SECRET, function (err, decoded) {
      if (err) return done(false, 403, "Not valid token");
      done(true);
    });
  },
  port: process.env.WSPORT || 2087,
});

let average = (array) => array.reduce((a, b) => a + b) / array.length;

function sendPrices(ws) {
  var btcPrice,
    ethPrice,
    ltcPrice,
    xrpPrice = null;
  var btc = [
    cache.get("krakenBTC"),
    cache.get("krakenCAD") * cache.get("binanceBTC"),
    cache.get("bfxBTC") * cache.get("krakenCAD"),
    null,
  ].filter(Boolean);

  var eth = [
    cache.get("krakenETH"),
    cache.get("krakenCAD") * cache.get("binanceETH"),
    cache.get("bfxETH") * cache.get("krakenCAD"),
    null,
  ].filter(Boolean);

  // var ltc = [
  // 	cache.get('krakenLTC')*cache.get('krakenCAD'),
  // 	cache.get('krakenCAD')*cache.get('binanceLTC'),
  // 	cache.get('bfxLTC')*cache.get('krakenCAD'), null].filter(Boolean);

  var xrp = [
    cache.get("krakenXRP"),
    cache.get("krakenCAD") * cache.get("binanceXRP"),
    cache.get("bfxXRP") * cache.get("krakenCAD"),
    null,
  ].filter(Boolean);

  btcPrice = average(btc);
  ethPrice = average(eth);
  // ltcPrice = average(ltc)
  xrpPrice = average(xrp);

  cache.set("btc", btcPrice);
  cache.set("eth", ethPrice);
  cache.set("xrp", xrpPrice);

  wss.clients.forEach(function each(client) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(
        JSON.stringify({
          type: "prices",
          payload: {
            btc: btcPrice,
            eth: ethPrice,
            xrp: xrpPrice,
            pbtc: cache.get("percentBTC"),
            peth: cache.get("percentETH"),
            pxrp: cache.get("percentXRP"),
          },
        })
      );
    }
  });
}
setInterval(() => {
  sendPrices(null);
}, 10000);
