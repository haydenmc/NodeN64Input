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
    private readonly ANALOG_DEADZONE: number = 0.20;

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
        this.wuSocket = new WuSocket(this.address);

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
            document.querySelector("div.controller")?.classList.remove("waiting");
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

        // Update our visual
        let controllerVisual = document.querySelector(".controller svg") as SVGElement;
        if (controllerVisual)
        {
            this.updateControllerVisuals(this.n64Buttons, controllerVisual);
        }

        let buffer = this.buttonsToBuffer(this.n64Buttons);
        let bufferView = new Uint8Array(buffer);

        console.log("buffer: %d %d %d %d", bufferView[0], bufferView[1], bufferView[2], bufferView[3]);
        this.wuSocket.sendBuffer(buffer);
    }

    private updateControllerVisuals(buttons: Buttons, controllerSvgElement: SVGElement): void
    {
        // Analog stick
        let analogStick: SVGPathElement = controllerSvgElement.querySelector("#analogStick") as SVGPathElement;
        analogStick.style.transform = `translate(${buttons.X_AXIS * 3}px, ${buttons.Y_AXIS * 3}px)`;
        if ((Math.abs(buttons.X_AXIS) > this.ANALOG_DEADZONE) || (Math.abs(buttons.Y_AXIS) > this.ANALOG_DEADZONE))
        {
            analogStick.style.fill = "var(--button-highlight-color)";
        }
        else
        {
            analogStick.style.fill = "#ffffff";
        }

        // Buttons!
        this.updateButtonVisual(buttons.R_DPAD,       controllerSvgElement, "dpadRight"    );
        this.updateButtonVisual(buttons.L_DPAD,       controllerSvgElement, "dpadLeft"     );
        this.updateButtonVisual(buttons.D_DPAD,       controllerSvgElement, "dpadDown"     );
        this.updateButtonVisual(buttons.U_DPAD,       controllerSvgElement, "dpadUp"       );
        this.updateButtonVisual(buttons.START_BUTTON, controllerSvgElement, "startButton"  );
        this.updateButtonVisual(buttons.Z_TRIG,       controllerSvgElement, "zButton"      );
        this.updateButtonVisual(buttons.B_BUTTON,     controllerSvgElement, "bButton"      );
        this.updateButtonVisual(buttons.A_BUTTON,     controllerSvgElement, "aButton"      );
        this.updateButtonVisual(buttons.R_CBUTTON,    controllerSvgElement, "cRightButton" );
        this.updateButtonVisual(buttons.L_CBUTTON,    controllerSvgElement, "cLeftButton"  );
        this.updateButtonVisual(buttons.D_CBUTTON,    controllerSvgElement, "cDownButton"  );
        this.updateButtonVisual(buttons.U_CBUTTON,    controllerSvgElement, "cUpButton"    );
        this.updateButtonVisual(buttons.R_TRIG,       controllerSvgElement, "rightShoulder");
        this.updateButtonVisual(buttons.L_TRIG,       controllerSvgElement, "leftShoulder" );
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

    private buttonsToBuffer(n64Buttons: Buttons): ArrayBuffer
    {
        let buffer = new ArrayBuffer(32);
        let view = new Uint8Array(buffer);

        // First 8 bits is DPAD, Start, Z, B, and A
        let val = 0 >>> 0; // hack for unsigned int
        val |= (Number(this.n64Buttons.A_BUTTON)     << 7)
        val |= (Number(this.n64Buttons.B_BUTTON)     << 6)
        val |= (Number(this.n64Buttons.Z_TRIG)       << 5)
        val |= (Number(this.n64Buttons.START_BUTTON) << 4)
        val |= (Number(this.n64Buttons.U_DPAD)       << 3)
        val |= (Number(this.n64Buttons.D_DPAD)       << 2)
        val |= (Number(this.n64Buttons.L_DPAD)       << 1)
        val |= (Number(this.n64Buttons.R_DPAD)       >>> 0)
        view[0] = val;

        // Second 8 bits is C buttons, triggers, and reserved values
        val = 0 >>> 0;
        val |= (Number(this.n64Buttons.L_TRIG)    << 5)
        val |= (Number(this.n64Buttons.R_TRIG)    << 4)
        val |= (Number(this.n64Buttons.U_CBUTTON) << 3)
        val |= (Number(this.n64Buttons.D_CBUTTON) << 2)
        val |= (Number(this.n64Buttons.L_CBUTTON) << 1)
        val |= (Number(this.n64Buttons.R_CBUTTON) >>> 0)
        view[1] = val;

        // Final 2 bytes are analog sticks which are stored as signed chars,
        // so we need to finagle them into unsigned chars
        let xAxis: number = 0;
        let yAxis: number = 0;

        if (Math.abs(this.n64Buttons.X_AXIS) > this.ANALOG_DEADZONE)
        {
            xAxis = ((this.n64Buttons.X_AXIS / 1.0) * 127);
        }
        if (Math.abs(this.n64Buttons.Y_AXIS) > this.ANALOG_DEADZONE)
        {
            yAxis = ((this.n64Buttons.Y_AXIS / 1.0) * -127);
        }

        view[2] = xAxis; // X axis
        view[3] = yAxis; // Y axis (invert)

        return buffer;
    }
}

new Controller(window.location.protocol + "//" + window.location.hostname + ":" + window.location.port);