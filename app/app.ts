import fs from 'fs';
import express from 'express';
import https from 'https';
import dgram from 'dgram';
import cors from 'cors';
import bodyParser from 'body-parser';
import {WebUdp, WebUdpHost} from './types/webudp';
const WebUDP: WebUdp = require("../lib/WebUDP.node");

const HOST = "206.55.174.75";
const PORT = 9000;
const CONTROL_PORT = 9001;
const MAX_CLIENTS = 512;
const TIME_LIMIT_SECONDS = 30; // 360

interface UdpClient
{
    clientId: number;
    address: string;
    port: number;
    lastMessageSentId: number;
}

interface ControllerAssignment
{
    client: UdpClient;
    assignedTime: Date;
    expirationTime: Date | null;
    expirationTimer: NodeJS.Timeout | null;
}

interface ControllerQueueEntry
{
    client: UdpClient;
    queuedTime: Date;
}

enum ClientRequestKind
{
    EnterQueue = 0,
    Leave = 1
}

interface ClientRequest
{
    requestKind: ClientRequestKind
}

enum ServerEventKind
{
    Error = 0,
    QueueUpdate = 1,
    YouArePlaying = 2,
    Dropped = 3
}

interface ServerEvent
{
    eventKind: ServerEventKind,
    messageId?: number,
    queuePosition?: number,
    controllerNumber?: number,
    expirationTime?: string
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

    private udpClients: Map<number, UdpClient>;
    private controllerAssignments: Map<number, ControllerAssignment>;
    private controllerQueue: Array<ControllerQueueEntry>;

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

        this.udpClients = new Map();
        this.controllerAssignments = new Map();
        this.controllerQueue = new Array();

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

    private onUdpClientJoined(clientId: number, address: string, port: number): void
    {
        this.udpClients.set(clientId, {
            clientId: clientId,
            address: address,
            port: port,
            lastMessageSentId: 0
        });
        console.log(`client ${clientId} @ ${address}:${port} joined. Client count: ${this.udpClients.size}`);
    }

    private onUdpClientLeft(clientId: number): void
    {
        this.dropClient(clientId);
        if (this.udpClients.has(clientId))
        {
            this.udpClients.delete(clientId);
        }
        else
        {
            console.warn(`Couldn't find record for ${clientId}.`);
        }
        console.log(`client ${clientId} left. Client count: ${this.udpClients.size}`);
    }

    private onUdpTextDataReceived(text: string, clientId: number, address: string, port: number): void
    {
        // Try to parse json as client request
        let parsed = JSON.parse(text);
        if (Number.isFinite(parsed.requestKind))
        {
            let request = parsed as ClientRequest;
            switch (request.requestKind)
            {
                case ClientRequestKind.EnterQueue:
                    this.onClientRequestEnterQueue(clientId, request);
                    break;
                case ClientRequestKind.Leave:
                    this.onClientRequestLeave(clientId, request);
                    break;
                default:
                    console.warn(`Invalid request kind '${request.requestKind}' ` + 
                        `from client '${clientId}'.`);
            }
        }
    }

    private sendEventToClient(clientId: number, event: ServerEvent): void
    {
        if (this.udpClients.has(clientId))
        {
            let client = this.udpClients.get(clientId) as UdpClient;
            event.messageId = client.lastMessageSentId + 1;
            let payload = JSON.stringify(event);
            this.webUdpHost.sendText(clientId, payload);
            ++client.lastMessageSentId;
        }
        else
        {
            console.error(`Event cannot be sent to invalid client id '${clientId}'.`);
        }
    }

    private onClientRequestEnterQueue(clientId: number, request: ClientRequest): void
    {
        // Enter the queue, then re-evaluate queue
        if (this.udpClients.has(clientId))
        {
            if (this.controllerQueue.filter(v => v.client.clientId == clientId).length <= 0)
            {
                let queuePosition = this.controllerQueue.push({
                    client: this.udpClients.get(clientId) as UdpClient,
                    queuedTime: new Date()
                });
                console.log(`Client '${clientId}' has entered the queue.`);
                this.sendEventToClient(clientId, {
                    eventKind: ServerEventKind.QueueUpdate,
                    queuePosition: queuePosition - 1
                });
                this.evaluateQueue();
            }
        }
        else
        {
            console.error(`Received queue request from invalid client id '${clientId}'.`);
        }
    }

    private dropClient(clientId: number): void
    {
        if (this.udpClients.has(clientId))
        {
            let client = this.udpClients.get(clientId) as UdpClient;
            // Is this player playing?
            for (let controllerNum of this.controllerAssignments.keys())
            {
                let assignment = 
                    this.controllerAssignments.get(controllerNum) as ControllerAssignment;
                if (assignment.client.clientId == clientId)
                {
                    this.controllerAssignments.delete(controllerNum);
                }
            }
            // Is this player queued?
            this.controllerQueue = 
                this.controllerQueue.filter((val) => (val.client.clientId != clientId));

            this.sendEventToClient(clientId, {
                eventKind: ServerEventKind.Dropped
            });

            console.log(`Client '${clientId}' has been dropped.`);

            this.evaluateQueue();
        }
        else
        {
            console.error(`Received leave request from invalid client id '${clientId}'.`);
        }
    }

    private onClientRequestLeave(clientId: number, request: ClientRequest): void
    {
        this.dropClient(clientId);
    }

    private evaluateQueue(): void
    {
        // Fill any available slots
        let queueHasShifted = false;
        for (let i = 0; i < 4; ++i)
        {
            if (!(this.controllerAssignments.has(i)))
            {
                if (this.controllerQueue.length > 0)
                {
                    let queueEntry = this.controllerQueue.shift() as ControllerQueueEntry;
                    this.controllerAssignments.set(i, {
                        client: queueEntry.client,
                        assignedTime: new Date(),
                        expirationTime: null,
                        expirationTimer: null
                    });
                    this.sendEventToClient(queueEntry.client.clientId, {
                        eventKind: ServerEventKind.YouArePlaying,
                        controllerNumber: i,
                        expirationTime: ""
                    });
                    console.log(`Client '${queueEntry.client.clientId}' ` + 
                        `assigned control ${i}.`);
                    queueHasShifted = true;
                }
            }
        }
        if (queueHasShifted)
        {
            // let everyone else know they've moved up in the queue
            for (let j = 0; j < this.controllerQueue.length; ++j)
            {
                let client = this.controllerQueue[j].client;
                this.sendEventToClient(client.clientId, {
                    eventKind: ServerEventKind.QueueUpdate,
                    queuePosition: j
                });
            }
        }

        // If there are folks waiting to play, assign timers to the oldest players
        // First, figure out which players are already being timed, and which are not.
        let timedAssignments: Map<number, ControllerAssignment> = new Map();
        let untimedAssignments: Map<number, ControllerAssignment> = new Map();
        for (let entry of this.controllerAssignments.entries())
        {
            if (entry[1].expirationTime === null)
            {
                untimedAssignments.set(entry[0], entry[1]);
            }
            else
            {
                timedAssignments.set(entry[0], entry[1]);
            }
        }

        console.log(`${this.controllerQueue.length} clients in play queue.`);

        // Are there more players waiting than # set to expire?
        if (timedAssignments.size < this.controllerQueue.length)
        {
            let numNewAssignments = Math.min(
                untimedAssignments.size, this.controllerQueue.length);
            let untimedAssignmentList = Array.from(untimedAssignments.entries());
            untimedAssignmentList = untimedAssignmentList
                .sort((a, b) => a[1].assignedTime.getTime() - b[1].assignedTime.getTime());
            for (let i = 0; i < numNewAssignments; ++i)
            {
                let assignment = untimedAssignmentList[0];
                let newTime = new Date();
                newTime.setSeconds(newTime.getSeconds() + TIME_LIMIT_SECONDS);
                assignment[1].expirationTime = newTime;
                this.sendEventToClient(assignment[1].client.clientId, {
                    eventKind: ServerEventKind.YouArePlaying,
                    controllerNumber: assignment[0],
                    expirationTime: newTime.toISOString()
                });
                assignment[1].expirationTimer = setTimeout(
                    () => this.timerExpired(assignment[1].client.clientId),
                    TIME_LIMIT_SECONDS * 1000);
                console.log(`Client '${assignment[1].client.clientId}' ` + 
                    `@ Control ${assignment[0]} set to expire at ${newTime.toLocaleTimeString()}.`);
            }
        }
        // Do we have too many people set to expire?
        else if (timedAssignments.size > this.controllerQueue.length)
        {
            // Find the 'youngest' players with timers and reset them
            let numExcessTimed = Math.abs(timedAssignments.size - this.controllerQueue.length);
            let timedAssignmentList = Array.from(timedAssignments.entries());
            timedAssignmentList = timedAssignmentList
                .sort((a, b) => a[1].assignedTime.getTime() - b[1].assignedTime.getTime())
                .reverse();
            for (let i = 0; i < numExcessTimed; ++i)
            {
                let assignment = timedAssignmentList[0];
                assignment[1].expirationTime = null;
                if (assignment[1].expirationTimer)
                {
                    clearTimeout(assignment[1].expirationTimer);
                }
                this.sendEventToClient(assignment[1].client.clientId, {
                    eventKind: ServerEventKind.YouArePlaying,
                    controllerNumber: assignment[0],
                    expirationTime: ""
                });
                console.log(`Client '${assignment[1].client.clientId}' ` + 
                    `@ Control ${assignment[0]} expiration cancelled.`);
            }
        }
    }

    private timerExpired(clientId: number): void
    {
        this.dropClient(clientId);
    }

    private onUdpBinaryDataReceived(data: ArrayBuffer, clientId: number, address: string, port: number): void
    {
        if (data.byteLength == 32)
        {
            // Looks like controller input. Is this player assigned?
            let controllerNumber = -1;
            let clientAssignment: ControllerAssignment | null = null;
            for (let assignment of this.controllerAssignments.entries())
            {
                if (assignment[1].client.clientId == clientId)
                {
                    controllerNumber = assignment[0];
                    clientAssignment = assignment[1];
                    break;
                }
            }
            if (clientAssignment !== null)
            {
                controllerNumber = controllerNumber >>> 0; // unsigned int

                let view = new Uint8Array(data);

                // TODO: Reset these bits... security flaw...
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

                // Relay to mupen
                this.udpSocket.send(view, this.emulatorInputPort, "127.0.0.1");
            }
            
        }
        else
        {
            this.dropClient(clientId);
            this.webUdpHost.removeClient(clientId);
            console.log(`unexpected binary data from client ${clientId} length ${data.byteLength}`);
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