require('dotenv').config();
var request = require('request');
var images = require('./images');
const getUsers = require('./db/getUsers');
const addUsers = require('./db/addUsers');
const buyStocks = require('./db/buyStocks');
const stockQuoteTemplate = require('./adaptiveCards/stockQuote/stockQuoteTemplate');
var moment = require("moment");
var ACData = require("adaptivecards-templating");

module.exports = {

  createResponse: function(message, userWebexId, roomId) {
    var responseObject = {
      "roomId": roomId,
    }

    //Scrub the @stockbot tag from the message
    let newMessage = message;
    newMessage = newMessage.split(/ +/);
    newMessage.shift();
    let command = newMessage[0];
    
    console.log(newMessage);

    //Pick the proper path for the response
    if (command.startsWith('$')) {
      let stockSymbol = command.slice(1);
      return findStockPrice(stockSymbol, roomId);
    } else if (command.match(/^stonks$/i)) {
      console.log('Stonks!');
      responseObject["files"] = images.stonks;
      return { files: images.stonks };
    } else if (command.match(/^at\&t$/i)){
      console.log('Lmfao this company');
      responseObject["files"] = images.death;
      return { files: images.death };
    } else if (command.match(/^stonkey$/i)) {
      console.log('Stonkey!');
      responseObject["files"] = images.stonkey;
      return { files: images.stonkey };
    } else if (command.match(/^wednesday$/i)) {
      console.log('Wednesday');
      let date = new Date();
      let dayOfWeek = date.getDay();
      if (dayOfWeek == 3) {
        responseObject["files"] = images.wednesday;
        return { files: images.wednesday };
      } else {
        responseObject["markdown"] = 'It is not Wednesday yet my dudes';
        return { markdown: 'It is not Wednesday yet my dudes' };
      }
    } else if (command.match(/bear/i)) {
      console.log('Bear');
      let randInt = Math.floor(Math.random() * images.bears.length);
      responseObject["files"] = images.bears[randInt];
      return { files: images.bears[randInt] };
    } else if (command.match(/bull/i)) {
      console.log('Bull');
      return { markdown: "### 🐂 _Bull markets don't exist_ 🐂" };
    } else if (command.match(/info/i)) {
      console.log('Info');
      return findStockInfo(newMessage[1], roomId);
    } else if (command.match(/ytd/i)) {
      console.log('YTD');
      return findStockYTD(newMessage[1], roomId);
    } else if (command.match(/users/i)) {
      console.log('Getting users')
      return getUsers.getAllUsers();
    } else if (command.match(/register/i)) {
      console.log('Adding one user')
      return addUsers.addOneUser(userWebexId, newMessage[1] ? newMessage[1] : 'default');
    } else if (command.match(/buy/i)) {
      return buyStocks.buyStocks(userWebexId, newMessage[1], newMessage[2]);
    } else {
      console.log(command);
      return { markdown: 'Unable to parse user message 🚀' };
    }
  }

};

function findStockYTD(stockSymbol, roomId) {
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
          console.log(responseBody);
          let ytdChange = (responseBody.latestPrice * responseBody.ytdChange) / (1 + responseBody.ytdChange);
          responseObject["markdown"] = '# ' + responseBody.symbol + ' YTD Change: $' + ytdChange.toFixed(3) + ', ' + (responseBody.ytdChange * 100).toFixed(3) + '%';
          resolve(responseObject);
        } else {
          responseObject["markdown"] = "I couldn't find that stock";
          resolve(responseObject);
        }
      }
    });
  });
}

function findStockInfo(stockSymbol, roomId) {
  var responseObject = {
    "roomId": roomId,
  };
  let apiUrl = `https://cloud.iexapis.com/stable/stock/${stockSymbol}/company?token=${process.env.IEX_TOKEN}`;

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
          console.log(responseBody);
          responseObject["markdown"] = responseBody.symbol + ': ' + responseBody.description;
          resolve(responseObject);
        } else {
          responseObject["markdown"] = "I couldn't find that stock";
          resolve(responseObject);
        }
      }
    });
  });
}

function findStockPrice(stockSymbol, roomId) {
  let responseObject = {
    "roomId": roomId,
  };
  let apiUrl = `https://cloud.iexapis.com/stable/stock/${stockSymbol}/quote?token=${process.env.IEX_TOKEN}&displayPercent=true`;

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
          console.log(responseBody);
          // 'YYYY-MM-DDTHH:MM:SSZ'
          const d = moment(responseBody.latestUpdate).format();
          responseBody.latestUpdateString = d;
          responseBody.changePercent = responseBody.changePercent ? responseBody.changePercent.toFixed(3) : 'N/A';
          responseObject["markdown"] =
            `#${responseBody.symbol}: \u0024${responseBody.latestPrice} (${responseBody.change}, ${responseBody.changePercent}%)`;
          
          // Made adaptive card
          var template = new ACData.Template(stockQuoteTemplate);
          var context = new ACData.EvaluationContext();
          context.$root = {
            ...responseBody,
            logoUrl: 'https://storage.googleapis.com/iex/api/logos/'+responseBody.symbol+'.png',
            weekFiveTwoHigh: responseBody.week52High,
            weekFiveTwoLow: responseBody.week52Low,
            changePercent: responseBody.changePercent
          }
          console.log(context);
          var card = template.expand(context);
          responseObject["attachments"] = [
            {
              "contentType": "application/vnd.microsoft.card.adaptive",
              "content": {
                ...card
              }
            }
          ];
          resolve(responseObject);
        } else {
          responseObject["markdown"] = "I couldn't find that stock";
          resolve(responseObject);
        }
      }
    });
  });
}