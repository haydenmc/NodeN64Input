import { DefaultBindings } from "./Bindings.js";

export enum N64ButtonKind
{
    R_DPAD = 0,
    L_DPAD,
    D_DPAD,
    U_DPAD,
    START_BUTTON,
    Z_TRIG,
    B_BUTTON,
    A_BUTTON,
    R_CBUTTON,
    L_CBUTTON,
    D_CBUTTON,
    U_CBUTTON,
    R_TRIG,
    L_TRIG,
    Reserved1,
    Reserved2,
    LAST,
}

export enum ControlBindingKind
{
    KeyboardKey = 0,
    ControllerButton,
    ControllerAxis,
    LAST
}

export enum ControlButtonBindingAxisDirection
{
    Positive = 0,
    Negative,
    LAST
}

export interface ControlButtonBinding
{
    kind: ControlBindingKind;
    keyboardKey?: string;
    controllerButtonIndex?: number;
    pressedValueThreshold?: number;
    controllerAxisIndex?: number;
    controllerAxisDirection?: ControlButtonBindingAxisDirection;
}

export interface ControllerBindings
{
    buttonBindings: Map<N64ButtonKind, Array<ControlButtonBinding>>;
    analogAxisBindings: Map<number, Array<ControlButtonBinding>>;
}

export interface Buttons
{
    buttons: Map<N64ButtonKind, boolean>;
    xAxis:   number;
    yAxis:   number;
}

export class Controller
{
    public get N64Buttons(): Buttons {
        return this.n64Buttons;
    }

    private static readonly AXIS_PRESSED_THRESHOLD: number = 0.33;
    private static readonly ANALOG_DEADZONE: number = 0.20;

    // private address: string;
    private gamepadIndex: number;
    private gamepadActive: boolean;
    
    private n64Buttons: Buttons;
    private controllerBindings: ControllerBindings;
    private keysPressed: Set<string>;

    constructor()
    {
        this.gamepadIndex = -1;
        this.gamepadActive = false;
        this.n64Buttons = 
            {
                buttons: new Map<N64ButtonKind, boolean>(),
                xAxis: 0,
                yAxis: 0
            };
        for (let i = 0 as N64ButtonKind; i < N64ButtonKind.LAST; ++i)
        {
            this.n64Buttons.buttons.set(i, false);
        }
        this.controllerBindings = 
            {
                buttonBindings: new Map(),
                analogAxisBindings: new Map()
            };
        this.keysPressed = new Set<string>();
        
        //
        window.addEventListener(
            "keydown",
            (e) => 
                {
                    this.onKeyDown(e);
                }
        );
        window.addEventListener(
            "keyup",
            (e) =>
                {
                    this.onKeyUp(e);
                }
        );
        window.addEventListener(
            "gamepadconnected",
            (e) =>
                {
                    this.onGamepadConnected(e as GamepadEvent);
                }
        );
        window.addEventListener(
            "gamepaddisconnected",
            (e) =>
                {
                    this.onGamepadDisconnected(e as GamepadEvent);
                }
        );

        this.assignDefaultBindings();
    }

    private clearBindings(): void
    {
        this.controllerBindings.buttonBindings.clear();
        this.controllerBindings.analogAxisBindings.clear();
    }

    private assignDefaultBindings(): void
    {
        this.loadBindings(DefaultBindings.DefaultKeyboardBindings);
        this.loadBindings(DefaultBindings.DefaultControllerBindings);
    }

    private loadBindings(bindings: ControllerBindings): void
    {
        // Load button bindings
        for (let button of bindings.buttonBindings.keys())
        {
            let newBindings = bindings.buttonBindings.get(button) as ControlButtonBinding[];
            if (!(this.controllerBindings.buttonBindings.has(button)))
            {
                this.controllerBindings.buttonBindings.set(button, new Array());
            }
            let currentBindings = 
                this.controllerBindings.buttonBindings.get(button) as 
                Array<ControlButtonBinding>;
            currentBindings.push(...newBindings);
        }

        // Load analog axes bindings
        for (let axis of bindings.analogAxisBindings.keys())
        {
            let newBindings = bindings.analogAxisBindings.get(axis) as ControlButtonBinding[];
            if (!(this.controllerBindings.analogAxisBindings.has(axis)))
            {
                this.controllerBindings.analogAxisBindings.set(axis, new Array());
            }
            let currentBindings = 
                this.controllerBindings.analogAxisBindings.get(axis) as 
                Array<ControlButtonBinding>;
            currentBindings.push(...newBindings);
        }
    }

    private onKeyDown(event: KeyboardEvent): void
    {
        if (!this.keysPressed.has(event.key))
        {
            this.keysPressed.add(event.key)
        }
    }

    private onKeyUp(event: KeyboardEvent): void
    {
        if (this.keysPressed.has(event.key))
        {
            this.keysPressed.delete(event.key);
        }
    }

    private onGamepadConnected(event: GamepadEvent): void
    {
        let gamepad = event.gamepad;
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
        }
    }

    private onGamepadDisconnected(event: GamepadEvent): void
    {
        // todo
    }

    public UpdateControllerState(): void
    {
        // Do we have a gamepad connected?
        let activeGamepad: Gamepad | null = null;
        if (this.gamepadActive)
        {
            let gamepads = navigator.getGamepads();
            if (gamepads !== null)
            {
                for (let gamepad of gamepads)
                {
                    if (gamepad?.index === this.gamepadIndex)
                    {
                        activeGamepad = gamepad;
                        break;
                    }
                }
            }
        }
        // Reset all button values
        for (let i = 0 as N64ButtonKind; i < N64ButtonKind.LAST; ++i)
        {
            this.n64Buttons.buttons.set(i, false);
        }
        // Set buttons per bindings
        for (let n64Button of this.controllerBindings.buttonBindings.keys())
        {
            let bindings = this.controllerBindings.buttonBindings.get(n64Button) as ControlButtonBinding[];
            let buttonValue = false;
            for (let binding of bindings)
            {
                let bindingValue = false;
                switch (binding.kind)
                {
                    case ControlBindingKind.KeyboardKey:
                        bindingValue = this.keysPressed.has(binding.keyboardKey as string);
                        break;
                    case ControlBindingKind.ControllerButton:
                        if (activeGamepad)
                        {
                            bindingValue = 
                                activeGamepad.buttons[binding.controllerButtonIndex as number].value >= 
                                (binding.pressedValueThreshold as number);
                        }
                        break;
                    case ControlBindingKind.ControllerAxis:
                        if (activeGamepad)
                        {
                            if (binding.controllerAxisDirection == 
                                ControlButtonBindingAxisDirection.Positive)
                            {
                                bindingValue = 
                                    activeGamepad.axes[binding.controllerAxisIndex as number].valueOf() >= 
                                    (binding.pressedValueThreshold as number);
                            }
                            else
                            {
                                bindingValue = 
                                    activeGamepad.axes[binding.controllerAxisIndex as number].valueOf() <= 
                                    -(binding.pressedValueThreshold as number);
                            }
                        }
                        break;
                    default:
                        console.warn(`Unexpected button binding ${binding.kind} ` + 
                            `for button ${n64Button}`);
                }
                buttonValue = (buttonValue || bindingValue);
            }
            this.n64Buttons.buttons.set(n64Button, buttonValue);
        }

        // Set axes per bindings
        // N64 only has two axes (1 analog stick)
        for (let axis of this.controllerBindings.analogAxisBindings.keys())
        {
            let bindings = this.controllerBindings.analogAxisBindings.get(axis) as ControlButtonBinding[];
            let bindingValue = 0.0;
            for (let binding of bindings)
            {
                switch (binding.kind)
                {
                    case ControlBindingKind.ControllerAxis:
                        if (activeGamepad)
                        {
                            let axisIndex = binding.controllerAxisIndex as number;
                            if (axisIndex < activeGamepad.axes.length)
                            {
                                bindingValue += activeGamepad.axes[axisIndex].valueOf();
                            }
                            else
                            {
                                console.warn(`Gamepad ${activeGamepad.id} has no axis ` + 
                                    `${axisIndex} - only ` + 
                                    `${activeGamepad.axes.length} axes available.`);
                            }
                        }
                        break;
                    case ControlBindingKind.ControllerButton:
                        if (activeGamepad)
                        {
                            let buttonIndex = binding.controllerButtonIndex as number;
                            if (buttonIndex < activeGamepad.buttons.length)
                            {
                                if (binding.controllerAxisDirection === ControlButtonBindingAxisDirection.Positive)
                                {
                                    bindingValue += activeGamepad.buttons[buttonIndex].value;
                                }
                                else
                                {
                                    bindingValue += -1 * (activeGamepad.buttons[buttonIndex].value);
                                }
                            }
                            else
                            {
                                console.warn(`Gamepad ${activeGamepad.id} has no button ` + 
                                    `${buttonIndex} - only ` + 
                                    `${activeGamepad.buttons.length} buttons available.`);
                            }
                        }
                        break;
                    case ControlBindingKind.KeyboardKey:
                        if (this.keysPressed.has(binding.keyboardKey as string))
                        {
                            if (binding.controllerAxisDirection === ControlButtonBindingAxisDirection.Positive)
                            {
                                bindingValue += 1.0; // TODO: ramp up over time?
                            }
                            else if (binding.controllerAxisDirection === ControlButtonBindingAxisDirection.Negative)
                            {
                                bindingValue += -1.0; // TODO: ramp up over time?
                            }
                        }
                        break;
                    default:
                        console.warn(`Unexpected axis binding ${binding.kind} ` + 
                            `for axis ${axis}`);
                        break;
                }
            }
            if (axis === 0)
            {
                this.n64Buttons.xAxis = bindingValue;
            }
            else if (axis === 1)
            {
                this.n64Buttons.yAxis = bindingValue;
            }
        }
    }

    public static ButtonsToBuffer(n64Buttons: Buttons): ArrayBuffer
    {
        let buffer = new ArrayBuffer(32);
        let view = new Uint8Array(buffer);

        // First 8 bits is DPAD, Start, Z, B, and A
        let ab = n64Buttons.buttons.get(N64ButtonKind.A_BUTTON    ) as boolean;
        let bb = n64Buttons.buttons.get(N64ButtonKind.B_BUTTON    ) as boolean;
        let zb = n64Buttons.buttons.get(N64ButtonKind.Z_TRIG      ) as boolean;
        let sb = n64Buttons.buttons.get(N64ButtonKind.START_BUTTON) as boolean;
        let du = n64Buttons.buttons.get(N64ButtonKind.U_DPAD      ) as boolean;
        let dd = n64Buttons.buttons.get(N64ButtonKind.D_DPAD      ) as boolean;
        let dl = n64Buttons.buttons.get(N64ButtonKind.L_DPAD      ) as boolean;
        let dr = n64Buttons.buttons.get(N64ButtonKind.R_DPAD      ) as boolean;

        let val = 0 >>> 0; // hack for unsigned int
        val |= (Number(ab)  << 7)
        val |= (Number(bb)  << 6)
        val |= (Number(zb)  << 5)
        val |= (Number(sb)  << 4)
        val |= (Number(du)  << 3)
        val |= (Number(dd)  << 2)
        val |= (Number(dl)  << 1)
        val |= (Number(dr) >>> 0)
        view[0] = val;

        // Second 8 bits is C buttons, triggers, and reserved values
        let lt = n64Buttons.buttons.get(N64ButtonKind.L_TRIG   ) as boolean;
        let rt = n64Buttons.buttons.get(N64ButtonKind.R_TRIG   ) as boolean;
        let cu = n64Buttons.buttons.get(N64ButtonKind.U_CBUTTON) as boolean;
        let cd = n64Buttons.buttons.get(N64ButtonKind.D_CBUTTON) as boolean;
        let cl = n64Buttons.buttons.get(N64ButtonKind.L_CBUTTON) as boolean;
        let cr = n64Buttons.buttons.get(N64ButtonKind.R_CBUTTON) as boolean;

        val = 0 >>> 0;
        val |= (Number(lt)  << 5)
        val |= (Number(rt)  << 4)
        val |= (Number(cu)  << 3)
        val |= (Number(cd)  << 2)
        val |= (Number(cl)  << 1)
        val |= (Number(cr) >>> 0)
        view[1] = val;

        // Final 2 bytes are analog sticks which are stored as signed chars,
        // so we need to finagle them into unsigned chars
        let xAxis: number = 0;
        let yAxis: number = 0;

        if (Math.abs(n64Buttons.xAxis) > Controller.ANALOG_DEADZONE)
        {
            xAxis = ((n64Buttons.xAxis / 1.0) * 127);
        }
        if (Math.abs(n64Buttons.yAxis) > Controller.ANALOG_DEADZONE)
        {
            yAxis = ((n64Buttons.yAxis / 1.0) * -127);
        }

        view[2] = xAxis; // X axis
        view[3] = yAxis; // Y axis (invert)

        return buffer;
    }
}