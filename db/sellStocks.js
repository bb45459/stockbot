// Inputs: User, Stock, Quantity

// Get user owned stocks
// Does user own quantity of stocks?
// Get price of stock
// Subtract quantity of stock from quantity owned
// Iterate to new document if needed
// Add price * quantity to cash
// Respond to user

const MongoClient = require('mongodb').MongoClient;
const assert = require('assert');
var request = require('request');

exports.sellStocks = (userWebexId, stockSymbol, quantity) => {
    // Connection URL
    const url = `mongodb+srv://${process.env.MONGODB_USER}:${process.env.MONGODB_PW}@${process.env.MONGODB_HOSTLIST}/stockbot?retryWrites=true&w=majority`;
    const _quantity = Number.parseInt(quantity);

    if (_quantity < 1) {
        return Promise.resolve({ text: 'Invalid quantity' });
    }

    return new Promise((resolve) => {
        // Use connect method to connect to the Server
        MongoClient.connect(url, function(err, client) {
            assert.equal(null, err);
            const db = client.db('stockbot');
            var ownedStocksCursor = db.collection('trades').aggregate([
                // First Stage
                {
                    $match : { webexId: userWebexId, symbol: stockSymbol }
                },
                //Second Stage
                {
                    $group : {
                        _id: "$webexId",
                        totalQuantity: { $sum : "$quantity" }
                    }
                }
            ]);

            findStockPrice(stockSymbol)
                .then(price => {
                    return ownedStocksCursor.map(doc => doc).toArray()
                        .then(res => {
                            if (res[0].totalQuantity >= _quantity) {
                                // Create a sell document
                                return db.collection('trades').insertOne({
                                    symbol: stockSymbol,
                                    webexId: userWebexId,
                                    priceAtExecution: price,
                                    timeAtExecution: new Date(),
                                    quantity: Number.parseInt(-quantity)
                                })
                            } else {
                                return Promise.reject('Not enough stock owned');
                            }
                        });
                })
                .then(insertResponse => {
                    const cashToAdd = insertResponse.ops[0].priceAtExecution * _quantity;
                    return db.collection('users').updateOne({ webexId: userWebexId }, [
                        { $set: { cash: { $add: ["$cash", cashToAdd] } } }
                    ])
                })
                .then(updateResponse => {
                    console.log(updateResponse);
                    resolve({ markdown: `Sold ${quantity} of ${stockSymbol}` });
                })
                .catch(err => {
                    console.log(err);
                    resolve({ markdown: err });
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