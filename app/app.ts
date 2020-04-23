import express from 'express';
import dgram from 'dgram';
import cors from 'cors';
import bodyParser from 'body-parser';
import WebUdp from './types/webudp';
const WebUDP: WebUdp = require("../lib/WebUDP.node");

const HOST = "206.55.174.75";
const PORT = 9000;
const CONTROL_PORT = 9001;
const MAX_CLIENTS = 512;

// Create a new express application instance
const app: express.Application = express();
app.use(cors());
app.use(bodyParser.text());

// WebUDP Server
let udp = dgram.createSocket("udp4");
let host = new WebUDP.Host(HOST, PORT, {
  maxClients: MAX_CLIENTS
});

// UDP client for relaying controls to mupen
const client = dgram.createSocket('udp4');

host.setUDPWriteFunction(
    (msg, {port, address}) =>
    {
        udp.send(msg, port, address);
    }
);

host.onClientJoin(
    ({clientId, address, port}) => 
    {
        console.log(`client id=${clientId} ${address}:${port} joined`);
    }
);

host.onClientLeave(
    ({clientId}) => 
    {
        console.log(`client id=${clientId} left`);
    }
);

host.onTextData(
    ({text, clientId, address, port}) => 
    {
        console.log(`received text data from client ${clientId}: ${text}`);
        host.sendText(clientId, text);
    }
);

host.onBinaryData(
    ({data, clientId, address, port}) =>
    {
        if (data.byteLength == 32)
        {
            let view = new Uint8Array(data);
            console.log(view[0].toString(2).padStart(8, '0') + 
                view[1].toString(2).padStart(8, '0') + 
                view[2].toString(2).padStart(8, '0') + 
                view[3].toString(2).padStart(8, '0'));

            // Relay to mupen
            client.send(view, CONTROL_PORT, "127.0.0.1");
        }
        else
        {
            console.log("Received binary data from client %d length %d", clientId, data.byteLength);
        }
    }
);

app.use("/", express.static(__dirname + '/static'));

app.post(
    "/",
    (req, res) => 
    {
        let sdp = host.exchangeSDP(req.body);
        if (!sdp) {
            res.status(400).end();
            return;
        }
    
        res.send(sdp); 
    }
);
  
udp.on(
    "message",
    (msg, addr) =>
    {
        host.handleUDP(msg, addr);
    }
);

app.listen(
    PORT,
    () =>
    {
        console.log('Example app listening on port ' + PORT + '!');
    }
);
udp.bind(PORT);

setInterval(
    () => 
    {
        host.serve();
    },
    10
);