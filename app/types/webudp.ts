import dgram from 'dgram';

export interface WebUdp
{
    Host: WebUdpHost;
}

export interface WebUdpHost
{
    new(hostname: string, port: number, options: WebUdpHostOptions): WebUdpHost;

    exchangeSDP(body: string): string;

    setUDPWriteFunction(
        callback: (
            msg: string,
            source: {
                port: number,
                address: string
            }
        ) => void
    ): void;

    // TODO
    handleUDP(
        msg: Buffer,
        address: dgram.RemoteInfo
    ): void;

    // TODO
    serve(): void;
    
    onClientJoin(
        callback: (
            client: { 
                clientId: number,
                address: string, 
                port: number 
            }
        ) => void
    ): void;

    onClientLeave(
        callback: (
            client: {
                clientId:number
            }
        ) => void
    ): void;

    onTextData(
        callback: (
            payload: {
                text: string,
                clientId: number,
                address: string,
                port: number
            }
        ) => void
    ): void;

    onBinaryData(
        callback: (
            payload: {
                data: ArrayBuffer,
                clientId: number,
                address: string,
                port: number
            }
        ) => void
    ): void;

    removeClient(clientId: number): void;

    sendText(
        clientId: number,
        text: string
    ): void;

    // TODO
    sendBinary(): void;
}

interface WebUdpHostOptions
{
    maxClients: number;
}