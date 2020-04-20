export default class WuSocket
{
    private address: string;
    private peer: RTCPeerConnection | null;
    private channel: RTCDataChannel | null;
    private onMessage: ((messageEvent: MessageEvent) => void) | null;
    private onOpen: (() => void) | null;
    private open: boolean;

    constructor(address: string)
    {
        this.address = address;
        this.peer = null;
        this.channel = null;
        this.onMessage = null;
        this.onOpen = null;
        this.open = false;
        this.beginConnection();
    }

    public sendMessage(message: string): void
    {
        this.channel?.send(message);
    }

    public sendBuffer(buffer: ArrayBuffer): void
    {
        this.channel?.send(buffer);
    }

    private async beginConnection(): Promise<void>
    {
        this.peer = new RTCPeerConnection(
            {
                iceServers: [
                    { urls: ["stun:stun.l.google.com:19302"] }
                ]
            }
        );

        this.peer.onicecandidate = (e) =>
            {
                if (e.candidate)
                {
                    console.log("received ice candidate", e.candidate.candidate);
                }
                else
                {
                    console.log("all local candidates received");
                }
            };

        this.peer.ondatachannel = (e) =>
            {
                console.log("peer connection on data channel");
            };

        this.channel = this.peer.createDataChannel(
            "webudp",
            {
                ordered: false,
                maxRetransmits: 0
            }
        );
        this.channel.binaryType = "arraybuffer";

        this.channel.onopen = () =>
            {
                console.log("data channel ready");
                this.open = true;
                if (this.onOpen != null)
                {
                    this.onOpen();
                }
            };

        this.channel.onclose = () =>
            {
                this.open = false;
                console.log("data channel closed");
            };

        this.channel.onerror = (e) =>
            {
                console.log("data channel error " + e.error.message)
            };

        this.channel.onmessage = (e) =>
            {
                if (this.onMessage != null)
                {
                    this.onMessage(e);
                }
            };

        let offer: RTCSessionDescriptionInit = await this.peer.createOffer();
        await this.peer.setLocalDescription(offer);
        let fetchResult = await fetch(
            this.address,
            {
                method: "POST",
                body: this.peer.localDescription?.sdp
            }
        );
        if (fetchResult.status === 200)
        {
            let response: { answer: RTCSessionDescriptionInit, candidate: RTCIceCandidateInit } = 
                await fetchResult.json();
            
            await this.peer.setRemoteDescription(new RTCSessionDescription(response.answer));
            await this.peer.addIceCandidate(new RTCIceCandidate(response.candidate));
        }
        else
        {
            console.error("Error POSTing offer to server");
        }
    }
}