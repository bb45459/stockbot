const MongoClient = require('mongodb').MongoClient;
const assert = require('assert');

exports.getAllUsers = () => {
    // Connection URL
    const url = `mongodb+srv://${process.env.MONGODB_USER}:${process.env.MONGODB_PW}@${process.env.MONGODB_HOSTLIST}/stockbot?retryWrites=true&w=majority`;

    return new Promise((resolve, reject) => {
        // Use connect method to connect to the Server
        MongoClient.connect(url, function(err, client) {
            assert.equal(null, err);
            const db = client.db('stockbot');
            var cursor = db.collection('users').find({});
    
            function iterateFunc(doc) {
                console.log(JSON.stringify(doc, null, 4));
                resolve({
                    roomId: process.env.ROOM_ID,
                    // markdown: JSON.stringify(doc, null, 4)
                    text: JSON.stringify(doc, null, 2)
                });
            }
    
            function errorFunc(error) {
                console.log(error);
            }
    
            cursor.map(doc =>  { 
                return { 'name': doc.displayName, 'cash': doc.cash }
            }).toArray().then(
                result => {
                    console.log(result);
                    resolve({
                        roomId: process.env.ROOM_ID,
                        // markdown: JSON.stringify(result, null, 2)
                        text: JSON.stringify(result, null, 2)
                    })
                }
            );

            client.close();
        });
    })
}