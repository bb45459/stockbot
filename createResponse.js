require('dotenv').config();
var request = require('request');
var rp = require('request-promise');
var images = require('./images');
const getUsers = require('./db/getUsers');
const addUsers = require('./db/addUsers');
const buyStocks = require('./db/buyStocks');
const getStocks = require('./db/getStocks');
var sellStocks = require('./db/sellStocks');
const stockQuoteTemplate = require('./adaptiveCards/stockQuote/stockQuoteTemplate');
var moment = require("moment");
var ACData = require("adaptivecards-templating");

module.exports = {

  createResponse: function (message, userWebexId, roomId) {
    //Scrub the @stockbot tag from the message
    let newMessage = message;
    newMessage = newMessage.split(/ +/);
    newMessage.shift();
    let command = newMessage[0];

    console.log(newMessage);

    //Pick the proper path for the response
    if (command.startsWith('$')) {
      let stockSymbol = command.slice(1);
      return Promise.resolve(findStockPrice(stockSymbol, roomId));
    } else if (command.match(/^stonks$/i)) {
      console.log('Stonks!');
      return Promise.resolve({ files: images.stonks });
    } else if (command.match(/^at\&t$/i)) {
      console.log('Lmfao this company');
      return Promise.resolve({ files: images.death });
    } else if (command.match(/^stonkey$/i)) {
      console.log('Stonkey!');
      return Promise.resolve({ files: images.stonkey });
    } else if (command.match(/^wednesday$/i)) {
      console.log('Wednesday');
      let date = new Date();
      let dayOfWeek = date.getDay();
      if (dayOfWeek == 3) {
        return Promise.resolve({ files: images.wednesday });
      } else {
        return Promise.resolve({ markdown: 'It is not Wednesday yet my dudes' });
      }
    } else if (command.match(/bear/i)) {
      console.log('Bear');
      const randInt = Math.floor(Math.random() * images.bears.length);
      return Promise.resolve({ files: images.bears[randInt] });
    } else if (command.match(/bull/i)) {
      console.log('Bull');
      return Promise.resolve({ markdown: "### 🐂 _Bull markets don't exist_ 🐂" });
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
    } else if (command.match(/sell/i)) {
      return sellStocks.sellStocks(userWebexId, newMessage[1], newMessage[2]);
    } else if (command.match(/portfolio/i)) {
      return getStocks.getOwnedStocks(userWebexId);
    } else {
      console.log(command);
      return Promise.resolve({ markdown: 'Unable to parse user message 🚀' });
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
  return new Promise(function (resolve, reject) {
    //Do async job
    request.get(options, function (err, resp, body) {
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
  return new Promise(function (resolve, reject) {
    //Do async job
    request.get(options, function (err, resp, body) {
      if (err) {
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

  let apiUrl = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${stockSymbol}&apikey=${process.env.ALPHA_VANTAGE_TOKEN}`;
  let ytdUrl = `https://www.alphavantage.co/query?function=OVERVIEW&symbol=${stockSymbol}&apikey=${process.env.ALPHA_VANTAGE_TOKEN}`;

  console.log(apiUrl);
  console.log(ytdUrl);

  var options = {
    url: apiUrl,
  };
  return new Promise(function (resolve, reject) {
    //Do async job
    request.get(options, function (err, resp, body) {
      if (err) {
        reject(err);
      } else {
        if (Object.entries(JSON.parse(body)["Global Quote"]).length > 0) {
          let responseBody = JSON.parse(body)["Global Quote"];
          console.log(responseBody);
          // 'YYYY-MM-DDTHH:MM:SSZ'
          const d = moment(new Date()).format();
          responseBody.latestUpdateString = d;
          responseBody.changePercent = responseBody["10. change percent"] ? responseBody["10. change percent"] : 'N/A';
          responseObject["markdown"] =
            `#${responseBody["01. symbol"]}: \u0024${responseBody["05. price"]} (${responseBody["09. change"]}, ${responseBody["10. change percent"]})`;

          rp(ytdUrl, { method: 'GET' }).then(ytdRes => {
            const ytdBody = JSON.parse(ytdRes)

            responseBody = { ...responseBody, ...ytdBody };

            responseBody["symbol"] = responseBody["01. symbol"];
            responseBody["open"] = parseFloat(responseBody["02. open"]);
            responseBody["high"] = parseFloat(responseBody["03. high"]);
            responseBody["low"] = parseFloat(responseBody["04. low"]);
            responseBody["price"] = parseFloat(responseBody["05. price"]);
            responseBody["volume"] = parseInt(responseBody["06. volume"]);
            responseBody["latestTradingDay"] = responseBody["07. latest trading day"];
            responseBody["previous_close"] = parseFloat(responseBody["08. previous close"]);
            responseBody["change"] = parseFloat(responseBody["09. change"]);
            responseBody["changePercent"] = responseBody["10. change percent"];

            rp('https://storage.googleapis.com/iex/api/logos/' + responseBody["01. symbol"] + '.png', { method: 'GET' })
              .then(res => {
                // Made adaptive card
                var template = new ACData.Template(stockQuoteTemplate);
                var context = new ACData.EvaluationContext();
                context.$root = {
                  ...responseBody,
                  logoUrl: res.length > 1 ? 'https://storage.googleapis.com/iex/api/logos/' + responseBody["01. symbol"] + '.png' : 'https://crosstec.org/media/contentbuilder/plugins/image_scale/placeholder.jpg',
                  weekFiveTwoHigh: parseFloat(responseBody["52WeekHigh"]),
                  weekFiveTwoLow: parseFloat(responseBody["52WeekLow"]),
                  changePercent: responseBody.changePercent,
                  marketCap: parseInt(ytdBody.MarketCapitalization).toLocaleString()
                }
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
              });
          })
        } else {
          responseObject["markdown"] = "I couldn't find that stock";
          resolve(responseObject);
        }
      }
    });
  });
}