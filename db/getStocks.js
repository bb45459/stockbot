const MongoClient = require('mongodb').MongoClient;
const assert = require('assert');
var ACData = require("adaptivecards-templating");
const portfolioTemplate = require('../adaptiveCards/portfolio/portfolioTemplate');

exports.getOwnedStocks = (userWebexId) => {
    // Connection URL
    const url = `mongodb+srv://${process.env.MONGODB_USER}:${process.env.MONGODB_PW}@${process.env.MONGODB_HOSTLIST}/stockbot?retryWrites=true&w=majority`;

    return new Promise((resolve) => {
        // Use connect method to connect to the Server
        MongoClient.connect(url, function(err, client) {
            assert.equal(null, err);
            const db = client.db('stockbot');
            // var ownedStocksCursor = db.collection('trades').aggregate([
            //     // First Stage
            //     {
            //         $match : { webexId: userWebexId }
            //     },
            //     //Second Stage
            //     {
            //         $group : {
            //             _id: "$symbol",
            //             totalQuantity: { $sum : "$quantity" },
            //             // avgPrice: { $avg: { $multiply: ["$priceAtExecution", "$quantity"] } }
            //             avgPrice: { $avg: "$priceAtExecution" }
            //         }
            //     }
            // ]);

            var ownedStocksCursor = db.collection('users').aggregate([
                {
                    $match: { webexId: userWebexId }
                },
                { 
                    $lookup: {
                        from: 'trades',
                        pipeline: [
                            { 
                                $match: { webexId: userWebexId } 
                            },
                            {
                                $group : {
                                    _id: "$symbol",
                                    totalQuantity: { $sum : "$quantity" },
                                    totalPrice: { $sum: { $multiply: ["$priceAtExecution", "$quantity"] } }
                                }
                            },
                            {
                                $project : {
                                  symbol: "$_id",
                                  totalQuantity: "$totalQuantity",
                                  avgPrice: { $divide: ["$totalPrice", "$totalQuantity"] }
                                }
                            }
                        ],
                        as: 'stocks'
                    }
                },
                {
                    $project: {
                        "displayName": "$displayName",
                        "cash": "$cash",
                        "stocks": "$stocks"
                    }
                }
            ]);

            // Then get the current price from the API
    
            ownedStocksCursor.map(doc => {
                doc.stocks.map(stock => {
                    stock.symbol = stock.symbol.toUpperCase();
                    stock.avgPrice = stock.avgPrice.toFixed(2);
                })
                doc.cash = doc.cash.toFixed(2);
                return doc;
            }).toArray().then(
                result => {
                    console.log(JSON.stringify(result, null, 2));
                    var template = new ACData.Template(portfolioTemplate);
                    var context = new ACData.EvaluationContext();
                    context.$root = {
                        ...result[0],
                        profileImage: "https://i0.kym-cdn.com/photos/images/original/001/262/983/2f0.png"
                    }
                    var card = template.expand(context);
                    resolve({
                        text: 'test',
                        attachments: [
                        {
                            "contentType": "application/vnd.microsoft.card.adaptive",
                            "content": {
                            ...card
                            }
                        }
                        ]
                    });
                }
            );

            client.close();
        });
    })
}