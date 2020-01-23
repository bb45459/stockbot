require('dotenv').config();
const express = require('express');
var request = require("request");
var rp = require("request-promise");
var bodyParser = require('body-parser');
var createResponse = require('./createResponse');
var getUsers = require('./db/getUsers');
var addUsers = require('./db/addUsers');

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

  createResponse.createResponse(message, 'email', process.env.ROOM_ID)
    .then(result => {
      res.send({
        ...result,
        messageId,
        actorId
      });
      sendResponseMessage({
        roomId: process.env.ROOM_ID,
        markdown: result.markdown
      })
    });
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
      console.log(result);
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
  });
}

exports.sendResponseMessage = sendResponseMessage;