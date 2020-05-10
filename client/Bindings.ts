import { Controller, N64ButtonKind, ControlButtonBinding, ControlBindingKind, ControllerBindings, ControlButtonBindingAxisDirection } from "./Controller.js";

export abstract class DefaultBindings {
    public static readonly DefaultKeyboardBindings: ControllerBindings = 
    {
        buttonBindings: new Map([
            [
                N64ButtonKind.A_BUTTON,
                [{
                    kind: ControlBindingKind.KeyboardKey,
                    keyboardKey: "j"
                }]
            ],
            [
                N64ButtonKind.B_BUTTON,
                [{
                    kind: ControlBindingKind.KeyboardKey,
                    keyboardKey: "k"
                }]
            ],
            [
                N64ButtonKind.Z_TRIG,
                [{
                    kind: ControlBindingKind.KeyboardKey,
                    keyboardKey: " "
                }]
            ],
            [
                N64ButtonKind.START_BUTTON,
                [{
                    kind: ControlBindingKind.KeyboardKey,
                    keyboardKey: "Enter"
                }]
            ],
            [
                N64ButtonKind.U_CBUTTON,
                [{
                    kind: ControlBindingKind.KeyboardKey,
                    keyboardKey: "ArrowUp"
                }]
            ],
            [
                N64ButtonKind.D_CBUTTON,
                [{
                    kind: ControlBindingKind.KeyboardKey,
                    keyboardKey: "ArrowDown"
                }]
            ],
            [
                N64ButtonKind.L_CBUTTON,
                [{
                    kind: ControlBindingKind.KeyboardKey,
                    keyboardKey: "ArrowLeft"
                }]
            ],
            [
                N64ButtonKind.R_CBUTTON,
                [{
                    kind: ControlBindingKind.KeyboardKey,
                    keyboardKey: "ArrowRight"
                }]
            ],
        ]),
        analogAxisBindings: new Map([
            [
                0, // X axis
                [
                    {
                        kind: ControlBindingKind.KeyboardKey,
                        keyboardKey: "d",
                        controllerAxisDirection: ControlButtonBindingAxisDirection.Positive
                    },
                    {
                        kind: ControlBindingKind.KeyboardKey,
                        keyboardKey: "a",
                        controllerAxisDirection: ControlButtonBindingAxisDirection.Negative
                    }
                ]
            ],
            [
                1, // Y axis
                [
                    {
                        kind: ControlBindingKind.KeyboardKey,
                        keyboardKey: "s",
                        controllerAxisDirection: ControlButtonBindingAxisDirection.Positive
                    },
                    {
                        kind: ControlBindingKind.KeyboardKey,
                        keyboardKey: "w",
                        controllerAxisDirection: ControlButtonBindingAxisDirection.Negative
                    }
                ]
            ],
        ]),
    }

    public static readonly DefaultControllerBindings: ControllerBindings = 
    {
        buttonBindings: new Map([
            [
                N64ButtonKind.A_BUTTON,
                [
                    {
                        kind: ControlBindingKind.ControllerButton,
                        controllerButtonIndex: 0, // A on Xbox
                        pressedValueThreshold: 1
                    }
                ]
            ],
            [
                N64ButtonKind.B_BUTTON,
                [
                    {
                        kind: ControlBindingKind.ControllerButton,
                        controllerButtonIndex: 2, // X on Xbox
                        pressedValueThreshold: 1
                    },
                    {
                        kind: ControlBindingKind.ControllerButton,
                        controllerButtonIndex: 1, // B on Xbox
                        pressedValueThreshold: 1
                    },
                ]
            ],
            [
                N64ButtonKind.Z_TRIG,
                [
                    {
                        kind: ControlBindingKind.ControllerButton,
                        controllerButtonIndex: 5, // RB on Xbox
                        pressedValueThreshold: 1
                    },
                    {
                        kind: ControlBindingKind.ControllerButton,
                        controllerButtonIndex: 4, // LB on Xbox
                        pressedValueThreshold: 1
                    }
                ]
            ],
            [
                N64ButtonKind.START_BUTTON,
                [
                    {
                        kind: ControlBindingKind.ControllerButton,
                        controllerButtonIndex: 9, // Menu on Xbox
                        pressedValueThreshold: 1
                    },
                    {
                        kind: ControlBindingKind.ControllerButton,
                        controllerButtonIndex: 8, // View on Xbox
                        pressedValueThreshold: 1
                    }
                ]
            ],
            [
                N64ButtonKind.U_DPAD,
                [
                    {
                        kind: ControlBindingKind.ControllerButton,
                        controllerButtonIndex: 12, // DPad Up on Xbox
                        pressedValueThreshold: 1
                    }
                ]
            ],
            [
                N64ButtonKind.D_DPAD,
                [
                    {
                        kind: ControlBindingKind.ControllerButton,
                        controllerButtonIndex: 13, // DPad Down on Xbox
                        pressedValueThreshold: 1
                    }
                ]
            ],
            [
                N64ButtonKind.L_DPAD,
                [
                    {
                        kind: ControlBindingKind.ControllerButton,
                        controllerButtonIndex: 14, // DPad Left on Xbox
                        pressedValueThreshold: 1
                    }
                ]
            ],
            [
                N64ButtonKind.R_DPAD,
                [
                    {
                        kind: ControlBindingKind.ControllerButton,
                        controllerButtonIndex: 15, // DPad Right on Xbox
                        pressedValueThreshold: 1
                    }
                ]
            ],
            [
                N64ButtonKind.L_TRIG,
                [
                    {
                        kind: ControlBindingKind.ControllerButton,
                        controllerButtonIndex: 6, // LT on Xbox
                        pressedValueThreshold: 0.5
                    }
                ]
            ],
            [
                N64ButtonKind.R_TRIG,
                [
                    {
                        kind: ControlBindingKind.ControllerButton,
                        controllerButtonIndex: 7, // RT on Xbox
                        pressedValueThreshold: 0.5
                    }
                ]
            ],
            [
                N64ButtonKind.U_CBUTTON,
                [
                    {
                        kind: ControlBindingKind.ControllerAxis,
                        pressedValueThreshold: 0.5,
                        controllerAxisIndex: 3, // Right stick Y axis on Xbox
                        controllerAxisDirection: ControlButtonBindingAxisDirection.Negative
                    }
                ]
            ],
            [
                N64ButtonKind.D_CBUTTON,
                [
                    {
                        kind: ControlBindingKind.ControllerAxis,
                        pressedValueThreshold: 0.5,
                        controllerAxisIndex: 3, // Right stick Y axis on Xbox
                        controllerAxisDirection: ControlButtonBindingAxisDirection.Positive
                    }
                ]
            ],
            [
                N64ButtonKind.L_CBUTTON,
                [
                    {
                        kind: ControlBindingKind.ControllerAxis,
                        pressedValueThreshold: 0.5,
                        controllerAxisIndex: 2, // Right stick X axis on Xbox
                        controllerAxisDirection: ControlButtonBindingAxisDirection.Negative
                    }
                ]
            ],
            [
                N64ButtonKind.R_CBUTTON,
                [
                    {
                        kind: ControlBindingKind.ControllerAxis,
                        pressedValueThreshold: 0.5,
                        controllerAxisIndex: 2, // Right stick X axis on Xbox
                        controllerAxisDirection: ControlButtonBindingAxisDirection.Positive
                    }
                ]
            ],
        ]),

        analogAxisBindings: new Map([
            [
                0, // X axis
                [
                    {
                        kind: ControlBindingKind.ControllerAxis,
                        controllerAxisIndex: 0
                    }
                ]
            ],
            [
                1, // Y axis
                [
                    {
                        kind: ControlBindingKind.ControllerAxis,
                        controllerAxisIndex: 1
                    }
                ]
            ],
        ])
    }
}