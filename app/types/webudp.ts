import dgram from 'dgram';

export default interface WebUdp
{
    Host: WebUdpHost;
}

interface WebUdpHost
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
                clientId: string,
                address: string, 
                port: number 
            }
        ) => void
    ): void;

    onClientLeave(
        callback: (
            client: {
                clientId:string
            }
        ) => void
    ): void;

    onTextData(
        callback: (
            payload: {
                text: string,
                clientId: string,
                address: string,
                port: number
            }
        ) => void
    ): void;

    // TODO
    onBinaryData(
        callback: (
            payload: {
                data: ArrayBuffer,
                clientId: string,
                address: string,
                port: number
            }
        ) => void
    ): void;

    // TODO
    removeClient(): void;

    sendText(
        clientId: string,
        text: string
    ): void;

    // TODO
    sendBinary(): void;
}

interface WebUdpHostOptions
{
    maxClients: number;
}