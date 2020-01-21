# Stockbot for Cisco Webex

You can locally host a server that hot reloads with `nodemon server.js`

POST Message to `/dev` must look like:
```
{
  "actorId": String,
  "data": {
    "id": String,
    "message": String
  }
}
```
It will respond with what the parsed message to the room would be.
