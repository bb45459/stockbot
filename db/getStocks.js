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
            var cursor = db.collection('trades').find({ webexId: userWebexId, sold: false });
    
            cursor.map(doc =>  { 
                return { 'stock': doc.symbol, 'quantity': doc.quantity, 'purchasePrice': doc.purchasePrice }
            }).toArray().then(
                result => {
                    console.log(result);
                    resolve({
                        roomId: process.env.ROOM_ID,
                        markdown: JSON.stringify(result, null, 2)
                    })
                }
            );

            client.close();
        });
    })
}