"use strict";
var mongoose = require("mongoose");
const Double = require("@mongoosejs/double");
const bcrypt = require("bcrypt");
const AutoIncrement = require("mongoose-sequence")(mongoose);
var bitcoin = require("bitcoinjs-lib");
var b58 = require("b58");
var xpub = process.env.TPUB;
const network = bitcoin.networks.testnet;
var { btcTX } = require("../../utils/cache");
const Bitcoin = require("bitcoin-core");
const nodeBTC = new Bitcoin({
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

var SchemaTypes = mongoose.Schema.Types;
var Schema = mongoose.Schema;

var User = new Schema(
  {
    email: {
      type: String,
    },
    password: {
      type: String,
    },
    wallet: {
      type: {
        cad: Double,
        btc: Double,
        eth: Double,
        xrp: Double,
      },
      default: { cad: 0.0, btc: 0.0, eth: 0.0, xrp: 0.0 },
    },
    transactions: [
      {
        id: {
          type: String,
        },
        address: {
          type: String,
        },
        info: {
          type: Schema.Types.Mixed,
        },
        amount: {
          type: Double,
        },
        credited: {
          type: Boolean,
        },
        status: {
          type: String,
        },
        confirmations: {
          type: Number,
        },
        currency: {
          type: String,
        },
        Created_date: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    Created_date: {
      type: Date,
      default: Date.now,
    },
  },
  { minimize: false }
);

User.index({ email: 1 }, { unique: true });

User.plugin(AutoIncrement, { inc_field: "id" });

User.pre("save", async function (next) {
  if (this.isNew) {
    //'this' refers to the current document about to be saved
    const user = this;
    //Hash the password with a salt round of 10, the higher the rounds the more secure, but the slower
    //your application becomes.
    const hash = await bcrypt.hash(this.password, 10);
    //Replace the plain text password with the hash and then store it
    this.password = hash;
  }
  //Indicates we're done and moves on to the next middleware
  next();
});

//We'll use this later on to make sure that the user trying to log in has the correct credentials
User.methods.isValidPassword = async function (password) {
  const user = this;
  //Hashes the password sent by the user for login and checks if the hashed password stored in the
  //database matches the one sent. Returns true if it does else false.
  const compare = await bcrypt.compare(password, user.password);
  return compare;
};

User.methods.getAddress = async function () {
  const user = this;

  const p2wpkh = await bitcoin.payments.p2wpkh({
    pubkey: bitcoin.bip32
      .fromBase58(xpub, network)
      .derive(user.id)
      .derive(user.transactions.length).publicKey,
    network,
  });

  const payment = await bitcoin.payments.p2sh({
    redeem: p2wpkh,
    network,
  });

  if (user.transactions.length > 0) {
    if (user.transactions[user.transactions.length - 1].status === "created") {
      return user.transactions[user.transactions.length - 1].address;
    } else {
      var transactions = user.transactions;
      transactions.push({ address: payment.address, status: "created" });
      user.transactions = transactions;
      await user.save((err) => {
        if (err) {
          console.log(err);
        } else
          nodeBTC
            .importAddress(payment.address, user.email, false)
            .then((response) => {});
      });
      return payment.address;
    }
  } else {
    var transactions = user.transactions;
    var flag = false;
    transactions.push({ address: payment.address, status: "created" });
    user.transactions = transactions;
    await user.save((err) => {
      if (err) {
        console.log(err);
      } else
        nodeBTC
          .importAddress(payment.address, user.email, false)
          .then((response) => {});
    });
    return payment.address;
  }
};

User.methods.updateTransaction = async function (tx) {
  const user = this;
  if (
    user.transactions[user.transactions.length - 1].address ===
      tx.details[0].address &&
    (user.transactions[user.transactions.length - 1].status === "created" ||
      user.transactions[user.transactions.length - 1].status === "pending")
  ) {
    var credited = user.transactions[user.transactions.length - 1].credited;
    if (tx.confirmations >= process.env.BTC_RECEIVED && !credited) {
      user.wallet.btc = parseFloat((user.wallet.btc + tx.amount).toFixed(7));
      credited = true;
      user.markModified("wallet");
    }

    user.transactions[user.transactions.length - 1] = {
      id: tx.txid,
      address: tx.details[0].address,
      confirmations: tx.confirmations,
      amount: tx.amount,
      status:
        tx.confirmations < process.env.BTC_CONFIRMED ? "pending" : "confirmed",
      info: tx,
      credited: credited,
    };
    user.save((err) => {
      if (err) console.log(err);
      else if (
        user.transactions[user.transactions.length - 1].status === "created"
      ) {
        btcTX.set(tx.txid, null);
      } else if (tx.confirmations > process.env.BTC_CONFIRMED)
        btcTX.del(tx.txid);
    });
  }
};

module.exports = mongoose.model("User", User);
