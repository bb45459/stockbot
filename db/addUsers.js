const MongoClient = require('mongodb').MongoClient;
const assert = require('assert');

exports.addOneUser = (webexId, displayName) => {
    // Connection URL
    const url = `mongodb+srv://${process.env.MONGODB_USER}:${process.env.MONGODB_PW}@${process.env.MONGODB_HOSTLIST}/stockbot?retryWrites=true&w=majority`;

    return new Promise((resolve, reject) => {
        // Use connect method to connect to the Server
        MongoClient.connect(url, function(err, client) {
            assert.equal(null, err);
            const db = client.db('stockbot');
            db.collection('users').insertOne({
                webexId: webexId,
                displayName: displayName,
                cash: 10000
            })
            .then(function(result) {
                // process result
                console.log(JSON.stringify(result, null, 4));
                resolve({
                  roomId: process.env.ROOM_ID,
                  markdown: 'Added user!'
                });
            })

            client.close();
        });
    });
}