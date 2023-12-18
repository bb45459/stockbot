const express = require('express');
var request = require("request");
var bodyParser = require('body-parser');
var createResponse = require('./createResponse');
const stockQuoteTemplate = require('./adaptiveCards/stockQuote/stockQuoteTemplate');
var ACData = require("adaptivecards-templating");
const axios = require("axios");

const app = express();
app.use(bodyParser.json());

app.get('/', (_req, res) => {
  res.send('Hello Express app!')
});

app.post('/', (req, res) => {
  let actorId = req.body.actorId;
  let messageId = req.body.data.id;
  let resource = req.body.resource;
  if (actorId !== process.env.BOT_ID) {
    console.log("Not the bot message");
    if (resource === "messages") {
      respondToUser(messageId, actorId);
    } else if (resource === "attachmentActions") {
      // let data = await 
    }
  }
  res.send(200);
});

app.post('/dev', (req, res) => {
  let actorId = req.body.actorId;
  let messageId = req.body.data.id;
  let message = req.body.data.message;

  var template = new ACData.Template(stockQuoteTemplate);
  var context = new ACData.EvaluationContext();
  findStockPrice(message, process.env.ROOM_ID)
    .then(quoteData => {
      context.$root = {
        ...quoteData
      }
      var card = template.expand(context);
      console.log(card);
      sendResponseMessage({
        roomId: process.env.ROOM_ID,
        text: 'test',
        attachments: [
          {
            "contentType": "application/vnd.microsoft.card.adaptive",
            "content": {
              ...card
            }
          }
        ]
      })
      res.send(200);
    })
    .catch(err => {
      sendResponseMessage({
        roomId: process.env.ROOM_ID,
        markdown: err
      })
    })
});

app.listen(process.env.PORT, () => {
  console.log('server started at ', process.env.PORT);
});

async function respondToUser(messageId, actorId) {
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


  // rp(options)
  axios.get(url, { headers: options.headers })
    //Get the user's message and send to response creator
    .then(function(res) {
      const body = res.data;
      const message = body.text;
      const roomId = body.roomId;
      console.log(message);
      return createResponse.createResponse(message, actorId, roomId);
    })

    //Get the response and post it back to the space
    .then(function(result) {
      return sendResponseMessage(result);
    }, function(err) {
      // can't find message, bot not @mentioned in message
      console.log(err.response.data);
    })

    .catch(function(err) {
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
    body: {
      roomId: process.env.ROOM_ID,
      ...responseObject
    },
    json: true
  };

  request(options, function(error, _response, body) {
    if (error) throw new Error(error);
    console.log("Response sent!");
    console.log(body);
  });
}

exports.sendResponseMessage = sendResponseMessage;