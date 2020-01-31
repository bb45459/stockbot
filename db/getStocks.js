const MongoClient = require('mongodb').MongoClient;
const assert = require('assert');

exports.getOwnedStocks = (userWebexId) => {
    // Connection URL
    const url = `mongodb+srv://${process.env.MONGODB_USER}:${process.env.MONGODB_PW}@${process.env.MONGODB_HOSTLIST}/stockbot?retryWrites=true&w=majority`;

    return new Promise((resolve) => {
        // Use connect method to connect to the Server
        MongoClient.connect(url, function(err, client) {
            assert.equal(null, err);
            const db = client.db('stockbot');
            var ownedStocksCursor = db.collection('trades').aggregate([
                // First Stage
                {
                    $match : { webexId: userWebexId }
                },
                //Second Stage
                {
                    $group : {
                        _id: "$symbol",
                        totalQuantity: { $sum : "$quantity" }
                    }
                }
            ]);
    
            ownedStocksCursor.map(doc => doc).toArray().then(
                result => {
                    resolve({
                        text: JSON.stringify(result, null, 2)
                    })
                }
            );

            client.close();
        });
    })
}