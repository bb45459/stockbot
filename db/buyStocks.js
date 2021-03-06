// Inputs: User, Stock, Quantity

// Get stock price
// Get user cash
// Price x Quantity < Cash?
// Insert trade document
// Subtract cash
// Return success/fail message

const MongoClient = require('mongodb').MongoClient;
const assert = require('assert');
var request = require('request');

exports.buyStocks = (userWebexId, stockSymbol, quantity=1) => {
    // Connection URL
    const url = `mongodb+srv://${process.env.MONGODB_USER}:${process.env.MONGODB_PW}@${process.env.MONGODB_HOSTLIST}/stockbot?retryWrites=true&w=majority`;

    return new Promise((resolve) => {
        // Use connect method to connect to the Server
        MongoClient.connect(url, function(err, client) {
            assert.equal(null, err);
            const db = client.db('stockbot');
            var usersCursor = db.collection('users').findOne({ webexId: userWebexId });

            findStockPrice(stockSymbol)
                .then(price => {
                    return usersCursor
                        .then(res => {
                            if (res.cash) {
                                if (price * quantity < res.cash) {
                                    return db.collection('trades').insertOne({
                                        symbol: stockSymbol,
                                        webexId: userWebexId,
                                        priceAtExecution: price,
                                        timeAtExecution: new Date(),
                                        quantity: Number.parseInt(quantity)
                                    });
                                } else {
                                    return Promise.reject('Not enough money');
                                }
                            } else {
                                return Promise.reject('Cannot find that user');
                            }
                        });
                })
                .then(insertSuccess => {
                    const totalPrice = insertSuccess.ops[0].priceAtExecution * insertSuccess.ops[0].quantity;
                    return db.collection('users').updateOne(
                        { webexId: userWebexId },
                        [
                            { $set: { cash: { $subtract: ["$cash", totalPrice] } } }
                        ]
                    );
                })
                .then(() => {
                        resolve({ markdown: `Bought ${quantity} of ${stockSymbol}`})
                })
                .catch(err => {
                    console.log(err);
                    resolve({ markdown: err })
                })
                .finally(() => client.close());
        });
    });
}

function findStockPrice(stockSymbol) {
    let apiUrl = `https://cloud.iexapis.com/stable/stock/${stockSymbol}/quote?token=${process.env.IEX_TOKEN}&displayPercent=true`;
  
    console.log(apiUrl);
  
    var options = {
      url: apiUrl,
    };
    return new Promise(function(resolve, reject) {
      //Do async job
      request.get(options, function(err, resp, body) {
        if (err) {
          reject(err);
        } else {
          if (body !== 'Unknown symbol') {
            let responseBody = JSON.parse(body);
            resolve(responseBody.latestPrice);
          } else {
            reject("I couldn't find that stock");
          }
        }
      });
    });
  }