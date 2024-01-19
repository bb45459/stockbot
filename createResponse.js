require('dotenv').config();
const axios = require('axios');
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

  createResponse: function(message, userWebexId, roomId) {
    //Scrub the @stockbot tag from the message
    let newMessage = message.split(/ +/);
    newMessage.shift();
    let command = newMessage[0];

    console.log(newMessage);

    let commandType = '';

    if (command.startsWith('$')) {
      commandType = 'stockPrice';
    } else if (command.match(/^stonks$/i)) {
      commandType = 'stonks';
    } else if (command.match(/^at\&t$/i)) {
      commandType = 'att';
    } // ... continue for other commands

    switch(commandType) {
      case 'stockPrice':
        let stockSymbol = command.slice(1);
        return Promise.resolve(findStockPrice(stockSymbol, roomId));
      case 'stonks':
        console.log('Stonks!');
        return Promise.resolve({ files: images.stonks });
      case 'att':
        console.log('Lmfao this company');
        return Promise.resolve({ files: images.death });
      // ... include cases for other commandTypes
      case 'mama':
        console.log("MOMMY PELOSI");
        const randInt = Math.floor(Math.random() * images.mama.length);
        return Promise.resolve({ files: images.mama[randInt] });
      default:
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

async function findStockPrice(stockSymbolIn, roomId) {
  let responseObject = {
    "roomId": roomId,
  };

  // utility lookups for cryptos
  const overrides = {
    'btc': 'btc/usd',
    'eth': 'eth/usd',
  }

  const stockSymbol = overrides[stockSymbolIn.toLowerCase()] ?? stockSymbolIn;

  let apiUrl = `https://api.twelvedata.com/quote?symbol=${stockSymbol}&apikey=${process.env.TWELVE_DATA_TOKEN}`
  let ytdUrl = `https://www.alphavantage.co/query?function=OVERVIEW&symbol=${stockSymbol}&apikey=${process.env.ALPHA_VANTAGE_TOKEN}`;
  const logoUrl = `https://api.twelvedata.com/logo?symbol=${stockSymbol}&apikey=${process.env.TWELVE_DATA_TOKEN}`

  const ytd = await axios.get(ytdUrl);
  const logo = await axios.get(logoUrl);

  const logoUrlResolved = logo.data?.logo_base ??
    logo.data?.url ??
    'https://crosstec.org/media/contentbuilder/plugins/image_scale/placeholder.jpg';

  var options = {
    url: apiUrl,
  };
  return new Promise(function(resolve, reject) {
    //Do async job
    request.get(options, function(err, resp, body) {
      if (err) {
        reject(err);
      } else {
        if (JSON.parse(body)["symbol"]) {
          let responseBody = JSON.parse(body);
          // 'YYYY-MM-DDTHH:MM:SSZ'
          const d = moment(new Date(responseBody.timestamp * 1000)).format();
          responseBody.latestUpdateString = d;
          responseBody.changePercent = responseBody.percent_change ? responseBody.percent_change : 'N/A';
          responseObject["markdown"] =
            `#${responseBody.symbol}: \u0024${responseBody.close} (${responseBody.change}, ${responseBody.percent_change}%)`;

          const ytdBody = ytd.data;

          responseBody = { ...responseBody, ...ytdBody };

          responseBody["symbol"] = responseBody["symbol"];
          responseBody["open"] = parseFloat(responseBody["open"]);
          responseBody["high"] = parseFloat(responseBody["high"]);
          responseBody["low"] = parseFloat(responseBody["low"]);
          responseBody["price"] = parseFloat(responseBody["close"]);
          responseBody["volume"] = parseInt(responseBody["volume"]);
          responseBody["previous_close"] = parseFloat(responseBody["previous_close"]);
          responseBody["change"] = parseFloat(responseBody["change"]);
          responseBody["changePercent"] = responseBody["percent_change"];

          // Made adaptive card
          var template = new ACData.Template(stockQuoteTemplate);
          var context = new ACData.EvaluationContext();
          context.$root = {
            ...responseBody,
            logoUrl: logoUrlResolved,
            weekFiveTwoHigh: parseFloat(responseBody["fifty_two_week"]["high"]),
            weekFiveTwoLow: parseFloat(responseBody["fifty_two_week"]["low"]),
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
        } else {
          responseObject["markdown"] = "I couldn't find that stock";
          resolve(responseObject);
        }
      }
    });
  });
}