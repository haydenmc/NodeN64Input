import WuSocket from "./WuSocket.js";

interface Buttons
{
    R_DPAD:       boolean;
    L_DPAD:       boolean;
    D_DPAD:       boolean;
    U_DPAD:       boolean;

    START_BUTTON: boolean;

    Z_TRIG:       boolean;
    B_BUTTON:     boolean;
    A_BUTTON:     boolean;

    R_CBUTTON:    boolean;
    L_CBUTTON:    boolean;
    D_CBUTTON:    boolean;
    U_CBUTTON:    boolean;

    R_TRIG:       boolean;
    L_TRIG:       boolean;

    Reserved1:    boolean;
    Reserved2:    boolean;

    X_AXIS:       number;
    Y_AXIS:       number;
}

class Controller
{
    private readonly REPORT_HZ: number = 15; // updates per second
    private readonly FPS_INTERVAL: number = 1000 / this.REPORT_HZ;
    private readonly AXIS_PRESSED_THRESHOLD: number = 0.33;

    private address: string;
    private gamepadIndex: number;
    private gamepadActive: boolean;
    private lastQueryTime: number;
    private n64Buttons: Buttons;
    private wuSocket: WuSocket;

    constructor(address: string)
    {
        this.address = address;
        this.gamepadIndex = -1;
        this.gamepadActive = false;
        this.lastQueryTime = 0;
        this.n64Buttons = 
            {
                R_DPAD:       false,
                L_DPAD:       false,
                D_DPAD:       false,
                U_DPAD:       false,

                START_BUTTON: false,

                Z_TRIG:       false,
                B_BUTTON:     false,
                A_BUTTON:     false,

                R_CBUTTON:    false,
                L_CBUTTON:    false,
                D_CBUTTON:    false,
                U_CBUTTON:    false,

                R_TRIG:       false,
                L_TRIG:       false,

                Reserved1:    false,
                Reserved2:    false,

                X_AXIS:       0,
                Y_AXIS:       0
            };
        this.wuSocket = new WuSocket(address);

        window.addEventListener(
            "gamepadconnected",
            (e) =>
                {
                    let gamepadEvent = e as GamepadEvent;
                    this.selectGamepad(gamepadEvent.gamepad);
                }
        );
    }

    private selectGamepad(gamepad: Gamepad): void
    {
        if (gamepad === null)
        {
            console.warn("null gamepad");
            return;
        }
        this.gamepadIndex = gamepad.index;
        console.log("Gamepad connected: %s", gamepad.id);
        if (!this.gamepadActive)
        {
            this.gamepadActive = true;
            window.requestAnimationFrame(() => this.queryGamepadState());
        }
    }

    private queryGamepadState(): void
    {
        if (!this.gamepadActive)
        {
            return;
        }

        window.requestAnimationFrame(() => this.queryGamepadState());

        let now = Date.now();
        let elapsed = now - this.lastQueryTime;

        if (elapsed > this.FPS_INTERVAL)
        {
            let gamepads = navigator.getGamepads();
            if ((this.gamepadIndex > gamepads.length) ||
                (gamepads[this.gamepadIndex] === null))
            {
                this.gamepadActive = false;
            }
            else
            {
                this.sendGamepadState(gamepads[this.gamepadIndex] as Gamepad);
            }
            this.lastQueryTime = now - (elapsed % this.FPS_INTERVAL);
        }
    }

    private sendGamepadState(gamepad: Gamepad): void
    {
        // Map values
        this.n64Buttons = 
            {
                R_DPAD:       gamepad.buttons[15].pressed, // Xbox dpad right
                L_DPAD:       gamepad.buttons[14].pressed, // Xbox dpad left
                D_DPAD:       gamepad.buttons[13].pressed, // Xbox dpad down
                U_DPAD:       gamepad.buttons[12].pressed, // Xbox dpad up

                START_BUTTON: gamepad.buttons[9].pressed,  // Xbox menu

                Z_TRIG:       gamepad.buttons[5].pressed,  // Xbox RB
                B_BUTTON:     gamepad.buttons[2].pressed,  // Xbox X
                A_BUTTON:     gamepad.buttons[0].pressed,  // Xbox A

                R_CBUTTON:    (gamepad.axes[2].valueOf() >  this.AXIS_PRESSED_THRESHOLD), // Xbox R analog
                L_CBUTTON:    (gamepad.axes[2].valueOf() < -this.AXIS_PRESSED_THRESHOLD), // Xbox R analog
                D_CBUTTON:    (gamepad.axes[3].valueOf() >  this.AXIS_PRESSED_THRESHOLD), // Xbox R analog
                U_CBUTTON:    (gamepad.axes[3].valueOf() < -this.AXIS_PRESSED_THRESHOLD), // Xbox R analog

                R_TRIG:       (gamepad.buttons[7].value > this.AXIS_PRESSED_THRESHOLD), // Xbox RT
                L_TRIG:       (gamepad.buttons[6].value > this.AXIS_PRESSED_THRESHOLD), // Xbox LT

                Reserved1:    false,
                Reserved2:    false,

                X_AXIS:       gamepad.axes[0].valueOf(), // Xbox L analog
                Y_AXIS:       gamepad.axes[1].valueOf()  // Xbox R analog
            };

        let buffer = this.buttonsToBuffer(this.n64Buttons);
        let bufferView = new Uint8Array(buffer);

        console.log("buffer: %d %d %d %d", bufferView[0], bufferView[1], bufferView[2], bufferView[3]);
        this.wuSocket.sendBuffer(buffer);
    }

    private buttonsToBuffer(n64Buttons: Buttons): ArrayBuffer
    {
        let buffer = new ArrayBuffer(32);
        let view = new Uint8Array(buffer);

        // First 8 bits is DPAD, Start, Z, B, and A
        let val = 0 >>> 0; // hack for unsigned int
        val |= (Number(this.n64Buttons.R_DPAD)       << 7)
        val |= (Number(this.n64Buttons.L_DPAD)       << 6)
        val |= (Number(this.n64Buttons.D_DPAD)       << 5)
        val |= (Number(this.n64Buttons.U_DPAD)       << 4)
        val |= (Number(this.n64Buttons.START_BUTTON) << 3)
        val |= (Number(this.n64Buttons.Z_TRIG)       << 2)
        val |= (Number(this.n64Buttons.B_BUTTON)     << 1)
        val |= (Number(this.n64Buttons.A_BUTTON)    >>> 0)
        view[0] = val;

        // Second 8 bits is C buttons, triggers, and reserved values
        val = 0 >>> 0;
        val |= (Number(this.n64Buttons.R_CBUTTON) << 7)
        val |= (Number(this.n64Buttons.L_CBUTTON) << 6)
        val |= (Number(this.n64Buttons.D_CBUTTON) << 5)
        val |= (Number(this.n64Buttons.U_CBUTTON) << 4)
        val |= (Number(this.n64Buttons.R_TRIG)    << 3)
        val |= (Number(this.n64Buttons.L_TRIG)    << 2)
        view[1] = val;

        // Final 2 bytes are analog sticks.
        view[2] = (((this.n64Buttons.X_AXIS + 1.0) / 2.0) * 255) // X axis
        view[3] = (((this.n64Buttons.Y_AXIS + 1.0) / 2.0) * 255) // Y axis

        return buffer;
    }
}

new Controller(window.location.protocol + "//" + window.location.hostname + ":" + window.location.port);