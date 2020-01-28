require('dotenv').config();
const express = require('express');
var request = require("request");
var rp = require("request-promise");
var bodyParser = require('body-parser');
var createResponse = require('./createResponse');
const stockQuoteTemplate = require('./adaptiveCards/stockQuote/stockQuoteTemplate');
var ACData = require("adaptivecards-templating");
var AdaptiveCards = require("adaptivecards");
var moment = require("moment");
var buyStocks = require('./db/buyStocks');

const app = express();
app.use(bodyParser.json());

app.get('/', (req, res) => {
  res.send('Hello Express app!')
});

app.post('/', (req, res) => {
  let actorId = req.body.actorId;
  let messageId = req.body.data.id;
  if (actorId !== process.env.BOT_ID) {
    console.log("Not the bot message");
    respondToUser(messageId, actorId);
  }
});

app.post('/dev', (req, res) => {
  let actorId = req.body.actorId;
  let messageId = req.body.data.id;
  let message = req.body.data.message;

  buyStocks.buyStocks(actorId, 'tsla', 2)
    .then(result => {
      res.send(result);
    })

  // var template = new ACData.Template(stockQuoteTemplate);
  // var context = new ACData.EvaluationContext();
  // findStockPrice(message, process.env.ROOM_ID)
  //   .then(quoteData => {
  //     context.$root = {
  //       ...quoteData
  //     }
  //     var card = template.expand(context);
  //     console.log(card);
  //     sendResponseMessage({
  //       roomId: process.env.ROOM_ID,
  //       text: 'test',
  //       attachments: [
  //         {
  //           "contentType": "application/vnd.microsoft.card.adaptive",
  //           "content": {
  //             ...card
  //           }
  //         }
  //       ]
  //     })
  //     res.send(200);
  //   })
  //   .catch(err => {
  //     sendResponseMessage({
  //       roomId: process.env.ROOM_ID,
  //       markdown: err
  //     })
  //   })
});

app.listen(process.env.PORT, () => {
  console.log('server started at ', process.env.PORT);
});

function respondToUser(messageId, actorId) {
  let url = 'https://api.ciscospark.com/v1/messages/' + messageId;
  var options = {
    method: 'GET',
    url: url,
    headers: {
      'cache-control': 'no-cache',
      Authorization: `Bearer ${process.env.BOT_AUTH_TOKEN}`,
      'Content-Type': 'application/json'
    },
    json: true
  };

  rp(options)
    //Get the user's message and send to response creator
    .then(function (body) {
      let message = body.text;
      let user = body.personEmail;
      let roomId = body.roomId;
      console.log(body.text);
      return createResponse.createResponse(message, actorId, roomId);
    })

    //Get the response and post it back to the space
    .then(function (result) {
      // console.log(result);
      sendResponseMessage(result);
    }, function (err) {
      console.log(err.error.message);
    })

    .catch(function (err) {
      // API call failed...
      sendResponseMessage('Error parsing message');
      console.log(err);
    });
}


function sendResponseMessage(responseObject) {
  var options = {
    method: 'POST',
    url: 'https://api.ciscospark.com/v1/messages/',
    headers:
    {
      'cache-control': 'no-cache',
      Authorization: `Bearer ${process.env.BOT_AUTH_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: responseObject,
    json: true
  };

  request(options, function (error, response, body) {
    if (error) throw new Error(error);
    console.log("Response sent!");
    console.log(body);
  });
}

function findStockPrice(stockSymbol, roomId) {
  var responseObject = {
    "roomId": roomId,
  };
  let apiUrl = `https://cloud.iexapis.com/stable/stock/${stockSymbol}/quote?token=${process.env.IEX_TOKEN}`;

  console.log(apiUrl);

  var options = {
    url: apiUrl,
  };
  return new Promise(function(resolve, reject) {
    //Do async job
    request.get(options, function(err, resp, body) {
      if (err) {
        //throw new Error(err);
        reject(err);
      } else {
        if (body != 'Unknown symbol') {
          let responseBody = JSON.parse(body);
          const d = moment(responseBody.latestUpdate).format('YYYY:MM:DDTHH:MM:SSZ');
          responseBody.latestUpdateString = '2020-01-23T20:59:59Z';
          resolve(responseBody);
        } else {
          responseObject["markdown"] = "I couldn't find that stock";
          reject(responseObject);
        }
      }
    });
  });
}

exports.sendResponseMessage = sendResponseMessage;