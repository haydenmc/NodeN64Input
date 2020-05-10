import { Controller, Buttons, N64ButtonKind } from "./Controller.js";
import WuSocket from "./WuSocket.js";

enum ConnectionState
{
    Disconnected,
    Connected,
    Playing
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
    messageId: number,
    queuePosition?: number,
    controllerNumber?: number,
    expirationTime?: string
}

export default class Client
{
    public static get Current(): Client
    {
        if (Client.current === null)
        {
            Client.current = new Client();
        }
        return Client.current;
    }

    private static current: Client | null = null;

    private readonly MIXER_CHANNEL: string = "Mixperiments";
    private static readonly REPORT_HZ: number = 20; // updates per second
    private static readonly FPS_INTERVAL: number = 1000 / Client.REPORT_HZ;

    private controller: Controller;
    private lastUpdateTime: number;

    private wuSocket: WuSocket;
    private connectionState: ConnectionState;
    private expirationTime: Date | null;
    private expirationUpdateTimer: number;
    
    constructor()
    {
        this.controller = new Controller();
        this.wuSocket = new WuSocket(
            `${window.location.protocol}//${window.location.hostname}:${window.location.port}`);
        this.connectionState = ConnectionState.Disconnected;
        this.expirationTime = null;
        this.expirationUpdateTimer = -1;
        this.wuSocket.OnOpen = () => {
            this.onWuSocketOpen();
        };
        this.wuSocket.OnMessage = (messageEvent: MessageEvent) => {
            this.onWuSocketMessage(messageEvent);
        };
        this.lastUpdateTime = 0;
    }

    public Start(): void
    {
        this.bindElements();
        if (!(window.location.hash.includes("nomixer")))
        {
            this.initMixer();
        }
        window.requestAnimationFrame(() => this.onFrame());
    }

    private updateStatus(message: string): void
    {
        let statusPane = document.querySelector("div#status .main");
        if (statusPane)
        {
            statusPane.innerHTML = message;
        }
    }

    private updateSubStatus(message: string): void
    {
        let subStatusPane = document.querySelector("div#status .sub");
        if (subStatusPane)
        {
            subStatusPane.innerHTML = message;
        }
    }

    private join(): void
    {
        document.body.classList.add("connected");
        this.updateStatus("Connecting...");
        this.wuSocket.Connect();
    }

    private leave(): void
    {
        document.body.classList.remove("connected");
        document.body.classList.remove("playing");
        this.connectionState = ConnectionState.Disconnected;
        this.wuSocket.Disconnect();
    }

    private updateExpirationTimer(): void
    {
        if (this.expirationTime)
        {
            let totalSeconds = Math.floor(((this.expirationTime.getTime()) - (new Date().getTime())) / 1000);
            if (totalSeconds <= 0)
            {
                this.updateSubStatus(`Time is up!`);
                this.expirationTime = null;
            }
            else
            {
                let minutes = Math.floor(totalSeconds / 60);
                let seconds = totalSeconds % 60;
                let timestamp = `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
                this.updateSubStatus(`Time left: ${timestamp}`);
                setTimeout(() => this.updateExpirationTimer(), 1000);
            }
        }
    }
    
    private onWuSocketMessage(messageEvent: MessageEvent): void
    {
        let payload = messageEvent.data as string;
        try
        {
            let parsed = JSON.parse(payload);
            if (Number.isFinite(parsed.eventKind))
            {
                let event = parsed as ServerEvent;
                switch (event.eventKind)
                {
                    case ServerEventKind.QueueUpdate:
                        let queuePosition = event.queuePosition as number;
                        this.updateStatus(`Waiting to Play...`)
                        this.updateSubStatus(`Queue Position: ${queuePosition + 1}`);
                        break;
                    case ServerEventKind.YouArePlaying:
                        let controllerNumber = event.controllerNumber as number;
                        this.updateStatus(`You are P${controllerNumber + 1}!`);
                        if (event.expirationTime && event.expirationTime !== "")
                        {
                            this.expirationTime = new Date(event.expirationTime);
                            this.updateExpirationTimer();
                        }
                        else
                        {
                            this.expirationTime = null;
                            this.updateSubStatus(`No time limit :)`);
                        }
                        this.connectionState = ConnectionState.Playing;
                        document.body.classList.add("playing");
                        break;
                    case ServerEventKind.Dropped:
                        this.leave();
                        break;
                    default:
                        console.warn(`Unexpected server event '${event.eventKind}'.`);
                }
            }
        }
        catch (e)
        {
            console.error(`Couldn't parse payload from server:\n${e}`);
        }
    }

    private onWuSocketOpen(): void
    {
        this.connectionState = ConnectionState.Connected;
        this.updateStatus("Connected!");
        // Request to put us in the queue
        this.sendRequest({
            requestKind: ClientRequestKind.EnterQueue
        });
    }

    private sendRequest(request: ClientRequest): void
    {
        let payload = JSON.stringify(request);
        this.wuSocket.sendMessage(payload);
    }

    private onFrame(): void
    {
        this.controller.UpdateControllerState();
        let controllerVisuals = document.querySelectorAll(".controller > svg");
        for (let controllerVisual of controllerVisuals)
        {
            this.updateControllerVisuals(
                this.controller.N64Buttons,
                controllerVisual as SVGElement);
        }
        window.requestAnimationFrame(() => this.onFrame());

        let now = Date.now();
        let elapsed = now - this.lastUpdateTime;

        if (elapsed > Client.FPS_INTERVAL)
        {
            // SEND UPDATE HERE
            if (this.connectionState === ConnectionState.Playing)
            {
                this.wuSocket.sendBuffer(Controller.ButtonsToBuffer(this.controller.N64Buttons));
            }
            this.lastUpdateTime = now - (elapsed % Client.FPS_INTERVAL);
        }
    }

    private updateControllerVisuals(buttons: Buttons, controllerSvgElement: SVGElement): void
    {
        // Analog stick
        let analogStick: SVGPathElement = controllerSvgElement.querySelector("#analogStick") as SVGPathElement;
        analogStick.style.transform = `translate(${buttons.xAxis * 3}px, ${buttons.yAxis * 3}px)`;
        if ((Math.abs(buttons.xAxis) > 0.3) || (Math.abs(buttons.yAxis) > 0.3))
        {
            analogStick.style.fill = "var(--button-highlight-color)";
        }
        else
        {
            analogStick.style.fill = "#ffffff";
        }

        // Buttons!
        this.updateButtonVisual(
            buttons.buttons.get(N64ButtonKind.R_DPAD) as boolean,
            controllerSvgElement, "dpadRight");
        this.updateButtonVisual(
            buttons.buttons.get(N64ButtonKind.L_DPAD) as boolean,
            controllerSvgElement, "dpadLeft");
        this.updateButtonVisual(
            buttons.buttons.get(N64ButtonKind.D_DPAD) as boolean,
            controllerSvgElement, "dpadDown");
        this.updateButtonVisual(
            buttons.buttons.get(N64ButtonKind.U_DPAD) as boolean,
            controllerSvgElement, "dpadUp");
        this.updateButtonVisual(
            buttons.buttons.get(N64ButtonKind.START_BUTTON) as boolean,
            controllerSvgElement, "startButton");
        this.updateButtonVisual(
            buttons.buttons.get(N64ButtonKind.Z_TRIG) as boolean,
            controllerSvgElement, "zButton");
        this.updateButtonVisual(
            buttons.buttons.get(N64ButtonKind.B_BUTTON) as boolean,
            controllerSvgElement, "bButton");
        this.updateButtonVisual(
            buttons.buttons.get(N64ButtonKind.A_BUTTON) as boolean,
            controllerSvgElement, "aButton");
        this.updateButtonVisual(
            buttons.buttons.get(N64ButtonKind.R_CBUTTON) as boolean,
            controllerSvgElement, "cRightButton");
        this.updateButtonVisual(
            buttons.buttons.get(N64ButtonKind.L_CBUTTON) as boolean,
            controllerSvgElement, "cLeftButton");
        this.updateButtonVisual(
            buttons.buttons.get(N64ButtonKind.D_CBUTTON) as boolean,
            controllerSvgElement, "cDownButton");
        this.updateButtonVisual(
            buttons.buttons.get(N64ButtonKind.U_CBUTTON) as boolean,
            controllerSvgElement, "cUpButton");
        this.updateButtonVisual(
            buttons.buttons.get(N64ButtonKind.R_TRIG) as boolean,
            controllerSvgElement, "rightShoulder");
        this.updateButtonVisual(
            buttons.buttons.get(N64ButtonKind.L_TRIG) as boolean,
            controllerSvgElement, "leftShoulder");
    }

    private updateButtonVisual(buttonPressed: boolean, controllerElement: SVGElement, buttonVisualId: string): void
    {
        let buttonVisual = controllerElement.querySelector(`#${buttonVisualId}`) as SVGElement;
        if (!buttonVisual)
        {
            return;
        }
        if (buttonPressed)
        {
            buttonVisual.style.fill = "var(--button-highlight-color)";
        }
        else
        {
            buttonVisual.style.fill = "none";
        }
    }

    private bindElements(): void
    {
        // About
        document.querySelector("button#aboutButton")?.addEventListener("click", (e) => {
            e.preventDefault();
            this.showDialog("aboutDialog");
        });
        document.querySelector("button#closeAboutDialog")?.addEventListener("click", (e) => {
            e.preventDefault();
            this.hideDialog("aboutDialog");
        });
        // Refresh
        document.querySelector("button#refreshMixerButton")?.addEventListener("click", (e) => {
            e.preventDefault();
            this.refreshMixer();
        });
        // Join
        document.querySelector("button#joinButton")?.addEventListener("click", (e) => {
            e.preventDefault();
            this.showDialog("joinDialog");
            (document.activeElement as HTMLElement).blur();
        });
        document.querySelector("button#closeJoinDialog")?.addEventListener("click", (e) => {
            e.preventDefault();
            this.hideDialog("joinDialog");
        });
        document.querySelector("button#joinConfirmButton")?.addEventListener("click", (e) => {
            e.preventDefault();
            this.hideDialog("joinDialog");
            this.join();
        });
    }

    private showDialog(dialogName: string): void
    {
        var dialogElement = document.querySelector(`div#${dialogName}.dialog`) as HTMLDivElement;
        if (!dialogElement) {
            console.error(`Could not find dialog '${dialogName}'.`);
            return;
        }
        dialogElement.classList.add("showing");
    }

    private hideDialog(dialogName: string): void
    {
        var dialogElement = document.querySelector(`div#${dialogName}.dialog`) as HTMLDivElement;
        if (!dialogElement) {
            console.error(`Could not find dialog '${dialogName}'.`);
            return;
        }
        dialogElement.classList.remove("showing");
    }

    private initMixer(): void
    {
        var iFrameElement = document.querySelector("iframe") as HTMLIFrameElement;
        iFrameElement.src = `https://mixer.com/embed/player/${this.MIXER_CHANNEL}?muted=0`;
    }

    private refreshMixer(): void
    {
        var iFrameElement = document.querySelector("iframe") as HTMLIFrameElement;
        if (iFrameElement)
        {
            let tmp = iFrameElement.src;
            iFrameElement.src = "";
            iFrameElement.src = tmp;
        }
    }
}

Client.Current.Start();