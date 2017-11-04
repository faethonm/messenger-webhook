'use strict'

const express = require('express')
const bodyParser = require('body-parser')
const app = express().use(bodyParser.json()); // creates express http server
const request = require('request')

const PAGE_ACCESS_TOKEN = process.env.BALLO_PAGE_ACCESS_TOKEN
const VERIFY_TOKEN = process.env.BALLO_VERIFY_TOKEN

// Sets server port and logs message on success
app.listen(process.env.PORT || 1337, () => console.log('webhook is listening'));

// Creates the endpoint for our webhook 
app.post('/webhook', (req, res) => {  
 
  let body = req.body;

  // Checks this is an event from a page subscription
  if (body.object === 'page') {

    // Iterates over each entry - there may be multiple if batched
    body.entry.forEach(function(entry) {

      // Gets the message. entry.messaging is an array, but 
      // will only ever contain one message, so we get index 0
      let webhookEvent = entry.messaging[0];
      console.log(webhookEvent);
      // Get the sender PSID
      let senderPsid = webhookEvent.sender.id;

      /*
        A person is assigned a unique page-scoped ID (PSID) 
        for each Facebook Page they start a conversation with.
        The PSID is used by your Messenger bot to identify a person when sending messages.
      */
      console.log('Sender PSID: ' + senderPsid);

      // Check if the event is a message or postback and
      // pass the event to the appropriate handler function
      if (webhookEvent.message) {
        handleMessage(senderPsid, webhookEvent.message);        
      } else if (webhookEvent.postback) {
        handlePostback(senderPsid, webhookEvent.postback);
      }
    });
  
    // Returns a '200 OK' response to all requests
    res.status(200).send('EVENT_RECEIVED');
  } else {
    // Returns a '404 Not Found' if event is not from a page subscription
    res.sendStatus(404);
  }

});

// Adds support for GET requests to our webhook
app.get('/webhook', (req, res) => {

  // Your verify token. Should be a random string.
  // let VERIFY_TOKEN = 'thebuzilife'
    
  // Parse the query params
  let mode = req.query['hub.mode'];
  let token = req.query['hub.verify_token'];
  let challenge = req.query['hub.challenge'];
    
  // Checks if a token and mode is in the query string of the request
  if (mode && token) {
  
    // Checks the mode and token sent is correct
    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      
      // Responds with the challenge token from the request
      console.log('WEBHOOK_VERIFIED');
      res.status(200).send(challenge);
    
    } else {
      // Responds with '403 Forbidden' if verify tokens do not match
      res.sendStatus(403);      
    }
  }
});

// Handles messages events
function handleMessage(senderPsid, receivedMessage) {
  let response;
  if (receivedMessage.text) {
    response = {
      "text": `You sent the message: "${receivedMessage.text}". Now fuck off!`
    }
  } else if (receivedMessage.attachments) {
    // Get the URL of the message attachment
    let attachment_url = receivedMessage.attachments[0].payload.url;
    response = {
      "attachment": {
        "type": "template",
        "payload": {
          "template_type": "generic",
          "elements": [{
            "title": "Is this the right picture?",
            "subtitle": "Tap a button to answer.",
            "image_url": attachment_url,
            "buttons": [
              {
                "type": "postback",
                "title": "Yes!",
                "payload": "yes",
              },
              {
                "type": "postback",
                "title": "No!",
                "payload": "no",
              }
            ],
          }]
        }
      }
    }
  }
  // Sends the response message
  callSendAPI(senderPsid, response); 

}

// Handles messaging_postbacks events
function handlePostback(senderPsid, receivedPostback) {
  let response;
  let payload = receivedPostback.payload

  if (payload === 'yes'){
    response = {
      "text": "Thanks!"
    }
  } else if (payload === "no") {
    response = {
      "text": "Oops, try sending another image."
    }
  }
  callSendAPI(senderPsid, response)
}

// Sends response messages via the Send API
function callSendAPI(senderPsid, response) {
  // Construct the message body
  let requestBody = {
    "recipient": {
      "id": senderPsid
    },
    "message": response
  }

  // Send the HTTP request to the Messenger Platform
  request({
    "uri": "https://graph.facebook.com/v2.6/me/messages",
    "qs": { "access_token": PAGE_ACCESS_TOKEN },
    "method": "POST",
    "json": requestBody
  }, (err, res, body) => {
    if (!err) {
      console.log('message sent!');
    } else {
      console.error("Unable to send message:" + err);
    }
  }); 
}
