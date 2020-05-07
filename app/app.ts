import fs from 'fs';
import express from 'express';
import https from 'https';
import dgram from 'dgram';
import cors from 'cors';
import bodyParser from 'body-parser';
import {WebUdp, WebUdpHost} from './types/webudp';
const WebUDP: WebUdp = require("../lib/WebUDP.node");

const MIXERCHANNEL = "Mixperiments";
const HOST = "206.55.174.75";
const PORT = 9000;
const CONTROL_PORT = 9001;
const MAX_CLIENTS = 512;

interface UdpClient
{
    clientId: string;
    address: string;
    port: number;

    isPlaying: boolean;
    playerNumber: number;
}

class App
{
    private httpsServer: https.Server;
    private host: string;
    private port: number;
    private emulatorInputPort: number;
    private maxClients: number;
    private expressApp: express.Application;
    private webUdpHost: WebUdpHost;
    private udpSocket: dgram.Socket;

    private udpClients: Map<string, UdpClient>;

    constructor(
        host: string,
        port: number,
        emulatorInputPort: number,
        maxClients: number = 512,
        keyFilePath: string,
        certFilePath: string)
    {
        let creds = {
            key: fs.readFileSync(keyFilePath),
            cert: fs.readFileSync(certFilePath)
        };
        this.host = host;
        this.port = port;
        this.emulatorInputPort = emulatorInputPort;
        this.maxClients = maxClients;

        this.udpClients = new Map<string, UdpClient>();

        this.udpSocket = dgram.createSocket("udp4");
        this.webUdpHost = this.initWebUdp();
        this.expressApp = this.initExpress();
        this.httpsServer = https.createServer(creds, this.expressApp);

        this.httpsServer.listen(PORT);
    }

    private initWebUdp(): WebUdpHost
    {
        if (!this.udpSocket)
        {
            Error("initWebUdp requires that udpSocket is present.");
        }

        let returnVal = new WebUDP.Host(this.host, this.port, {
            maxClients: this.maxClients
        });

        returnVal.setUDPWriteFunction(
            (msg, {port, address}) =>
            {
                this.udpSocket.send(msg, port, address);
            }
        );
        
        returnVal.onClientJoin(
            ({clientId, address, port}) => this.onUdpClientJoined(clientId, address, port)
        );
        
        returnVal.onClientLeave(
            ({clientId}) => this.onUdpClientLeft(clientId)
        );
        
        returnVal.onTextData(
            ({text, clientId, address, port}) => this.onUdpTextDataReceived(text, clientId, address, port)
        );
        
        returnVal.onBinaryData(
            ({data, clientId, address, port}) => this.onUdpBinaryDataReceived(data, clientId, address, port)
        );

        this.udpSocket.on(
            "message",
            (msg, addr) =>
            {
                returnVal.handleUDP(msg, addr);
            }
        );

        this.udpSocket.bind(PORT);

        setInterval(
            () => 
            {
                returnVal.serve();
            },
            10
        );

        return returnVal;
    }

    private initExpress(): express.Application
    {
        if (!this.webUdpHost)
        {
            Error("initExpress requires that webUdpHost is present.");
        }
        let returnVal = express();
        returnVal.use(cors());
        returnVal.use(bodyParser.text());

        returnVal.use("/", express.static(__dirname + '/static'));

        returnVal.post(
            "/",
            (req, res) => 
            {
                let sdp = this.webUdpHost.exchangeSDP(req.body);
                if (!sdp) {
                    res.status(400).end();
                    return;
                }
            
                res.send(sdp); 
            }
        );

        return returnVal;
    }

    private onUdpClientJoined(clientId: string, address: string, port: number): void
    {
        this.udpClients.set(clientId, {
            clientId: clientId,
            address: address,
            port: port,
            isPlaying: false,
            playerNumber: -1
        });
        console.log(`client ${clientId} @ ${address}:${port} joined. Player count: ${this.udpClients.size}`);
        this.evaluatePlayerAssignments();
    }

    private onUdpClientLeft(clientId: string): void
    {
        if (this.udpClients.has(clientId))
        {
            this.udpClients.delete(clientId);
        }
        else
        {
            console.warn(`Couldn't find record for ${clientId}.`);
        }
        console.log(`client ${clientId} left. Player count: ${this.udpClients.size}`);
        this.evaluatePlayerAssignments();
    }

    private onUdpTextDataReceived(text: string, clientId: string, address: string, port: number): void
    {
        console.log(`received text data from client ${clientId}: ${text}`);
    }

    private onUdpBinaryDataReceived(data: ArrayBuffer, clientId: string, address: string, port: number): void
    {
        if (data.byteLength == 32)
        {
            // Looks like controller input. Is this player assigned?
            let client = this.udpClients.get(clientId);
            if (client && client.isPlaying)
            {
                let controllerNumber = client.playerNumber >>> 0; // unsigned int

                let view = new Uint8Array(data);

                // Flip some bits for controller #
                if (controllerNumber == 1)
                {
                    view[1] |= (1 << 6);
                }
                else if (controllerNumber == 2)
                {
                    view[1] |= (1 << 7);
                }
                else if (controllerNumber == 3)
                {
                    view[1] |= (1 << 7);
                    view[1] |= (1 << 6);
                }

                // console.log(`CONTROL ${controllerNumber}: ` + 
                //     view[0].toString(2).padStart(8, '0') + 
                //     view[1].toString(2).padStart(8, '0') + 
                //     view[2].toString(2).padStart(8, '0') + 
                //     view[3].toString(2).padStart(8, '0'));

                // Relay to mupen
                this.udpSocket.send(view, this.emulatorInputPort, "127.0.0.1");
            }
            
        }
        else
        {
            console.log(`unexpected binary data from client ${clientId} length ${data.byteLength}`);
        }
    }

    private evaluatePlayerAssignments(): void
    {
        // First, evaluate who has already been assigned a slot
        let players = new Array<UdpClient>(4);
        this.udpClients.forEach((client, clientId) => {
            if (client.isPlaying && client.playerNumber >= 0 && client.playerNumber <= 3)
            {
                if (players[client.playerNumber])
                {
                    // Already taken? Whoops. Un-assign the dupe.
                    client.playerNumber = -1;
                    client.isPlaying = false;
                    console.warn(`Duplicate client assigned for controller ${client.playerNumber} - un-assigning client ${clientId}`);
                }
                else
                {
                    players[client.playerNumber] = client;
                }
            }
        });

        // Assign available slots out
        for (let i = 0; i < players.length; ++i)
        {
            if (!players[i])
            {
                // Find first non-assigned client to give this slot to
                for (const client of this.udpClients.values())
                {
                    if (!client.isPlaying)
                    {
                        client.isPlaying = true;
                        client.playerNumber = i;
                        console.log(`assigned client ${client.clientId} controller ${i}`)
                        break;
                    }
                }
            }
        }
    }
}

let keyFilePath = null;
let certFilePath = null;
var args = process.argv.slice(2);
for (let i = 0; i < args.length; ++i)
{
    if ((args[i] === "--key") && ((i + 1) < args.length))
    {
        keyFilePath = args[i + 1];
    }
    else if ((args[i] === "--cert") && ((i + 1) < args.length))
    {
        certFilePath = args[i + 1];
    }
}

if ((keyFilePath === null) || (certFilePath === null))
{
    throw "Must specify --key and --cert for HTTPS";
}

var application = new App(HOST, PORT, CONTROL_PORT, MAX_CLIENTS, keyFilePath, certFilePath);