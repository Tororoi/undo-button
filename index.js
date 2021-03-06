//Main
let fullPage = document.querySelector(".full-page");

//Set onscreen canvas and its context
let onScreenCVS = document.getElementById("onScreen");
let onScreenCTX = onScreenCVS.getContext("2d");
//original canvas width/height
let ocWidth = onScreenCVS.width;
let ocHeight = onScreenCVS.height;
//improve sharpness
let sharpness = 4;
let zoom = 1;
onScreenCVS.width = ocWidth * sharpness;
onScreenCVS.height = ocHeight * sharpness;
onScreenCTX.scale(sharpness * zoom, sharpness * zoom);

//Get the undo buttons
let undoBtn = document.getElementById("undo");
let redoBtn = document.getElementById("redo");

//Get swatch
let swatch = document.querySelector(".swatch");
let backSwatch = document.querySelector(".back-swatch");
let colorSwitch = document.querySelector(".switch");

let colorPicker = document.querySelector(".color-container");

//Get the reset buttons
let recenterBtn = document.querySelector(".recenter");
let clearBtn = document.querySelector(".clear");

//zoom buttons
let zoomCont = document.querySelector(".zoom");

//Get tool buttons
let toolsCont = document.querySelector(".tools");
let toolBtn = document.querySelector("#pencil");
toolBtn.style.background = "rgb(238, 206, 102)";

let modesCont = document.querySelector(".modes");
let modeBtn = document.querySelector("#draw");
modeBtn.style.background = "rgb(238, 206, 102)";

//Create an offscreen canvas. This is where we will actually be drawing, in order to keep the image consistent and free of distortions.
let offScreenCVS = document.createElement('canvas');
let offScreenCTX = offScreenCVS.getContext("2d");
//Set the dimensions of the drawing canvas
offScreenCVS.width = 128;
offScreenCVS.height = 128;

//Create a preview canvas. Also offscreen and same size as offscreen canvas. Used for UI such as cursors and previewing certain tools
let guiCVS = document.createElement('canvas');
let guiCTX = offScreenCVS.getContext("2d");
//Set the dimensions of the drawing canvas
guiCVS.width = offScreenCVS.width;
guiCVS.height = offScreenCVS.height;

//tool objects
const tools = {
    pencil: {
        name: "pencil",
        fn: drawSteps,
        brushSize: 1,
        options: ["perfect"]
    },
    replace: {
        name: "replace",
        fn: replaceSteps,
        brushSize: 1,
        options: ["perfect"]
    },
    // shading: {
    // user selects hsl shading color which mixes with colors that the user draws on to create dynamic shading
    // },
    line: {
        name: "line",
        fn: lineSteps,
        brushSize: 1,
        options: []
    },
    fill: {
        name: "fill",
        fn: fillSteps,
        brushSize: 1,
        options: ["contiguous"]
    },
    // gradient: {
    // Create a dithered gradient
    // },
    curve: {
        name: "curve",
        fn: curveSteps,
        brushSize: 1,
        options: []
    },
    // shapes: {
    // square, circle, and custom saved shape?
    // },
    picker: {
        name: "picker",
        fn: pickerSteps,
        brushSize: 1,
        options: []
    },
    grab: {
        name: "grab",
        fn: grabSteps,
        brushSize: 1,
        options: []
    }
}

//state
const state = {
    //timeline
    points: [],
    undoStack: [],
    redoStack: [],
    //settings
    tool: { ...tools.pencil },
    mode: "draw",
    brushColor: { color: "rgba(255,0,0,255)", r: 255, g: 0, b: 0, a: 255 },
    backColor: { color: "rgba(255,255,255,255)", r: 255, g: 255, b: 255, a: 255 },
    palette: {},
    options: {
        perfect: false,
        erase: false,
        contiguous: false
    },
    //active variables for canvas
    shortcuts: true,
    event: "none",
    clicked: false,
    clickedColor: null,
    mouseX: null,
    mouseY: null,
    mox: null, //mouse coords with offset
    moy: null,
    ratio: null,
    trueRatio: null,
    onX: null,
    onY: null,
    lastOnX: null,
    lastOnY: null,
    lastX: null,
    lastY: null,
    //x2/y2 for line tool
    lineX: null,
    lineY: null,
    //for perfect pixels
    lastDrawnX: null,
    lastDrawnY: null,
    waitingPixelX: null,
    waitingPixelY: null,
    //for replace
    colorLayerGlobal: null,
    //for moving canvas/ grab
    xOffset: 0,
    yOffset: 0,
    lastOffsetX: 0,
    lastOffsetY: 0
}

//Create an Image with a default source of the existing onscreen canvas
let img = new Image;
let source = offScreenCVS.toDataURL();

let preview = new Image;
let previewSource = guiCVS.toDataURL();

//shortcuts
document.addEventListener('keydown', handleKeyDown);
document.addEventListener('keyup', handleKeyUp);

onScreenCVS.addEventListener('wheel', handleWheel);

//Add event listeners for the mouse moving, downclick, and upclick
onScreenCVS.addEventListener('mousemove', handleMouseMove);
onScreenCVS.addEventListener('mousedown', handleMouseDown);
onScreenCVS.addEventListener('mouseup', handleMouseUp);
onScreenCVS.addEventListener('mouseout', handleMouseOut);

//Add event listeners for the toolbox
undoBtn.addEventListener('click', handleUndo);
redoBtn.addEventListener('click', handleRedo);

recenterBtn.addEventListener('click', handleRecenter);
clearBtn.addEventListener('click', handleClear);

zoomCont.addEventListener('click', handleZoom);

swatch.addEventListener('click', openColorPicker);
backSwatch.addEventListener('click', openColorPicker);
colorSwitch.addEventListener('click', switchColors);

toolsCont.addEventListener('click', handleTools);
modesCont.addEventListener('click', handleModes);

function handleKeyDown(e) {
    // console.log(e.key)
    if (state.shortcuts) {
        switch (e.code) {
            case 'KeyZ':
                if (e.metaKey) {
                    if (e.key === 'Ω') {
                        //alt+meta+z
                        handleRedo();
                    } else {
                        handleUndo();
                    }
                }
                break;
            case 'MetaLeft':
            case 'MetaRight':
                //command key
                break;
            case 'Space':
                state.tool = tools["grab"];
                onScreenCVS.style.cursor = "move";
                break;
            case 'AltLeft':
            case 'AltRight':
                //option key
                state.tool = tools["picker"];
                onScreenCVS.style.cursor = "none";
                break;
            case 'ShiftLeft':
            case 'ShiftRight':
                if (toolBtn.id === "pencil") {
                    state.tool = tools["line"];
                    onScreenCVS.style.cursor = "none";
                }
                break;
            case 'KeyS':
                let r = Math.floor(Math.random() * 256);
                let g = Math.floor(Math.random() * 256);
                let b = Math.floor(Math.random() * 256);
                setColor(r, g, b, "swatch btn");
                break;
            case 'KeyD':
                //reset old button
                modeBtn.style.background = "rgb(131, 131, 131)";
                //set new button
                modeBtn = document.querySelector("#draw");
                modeBtn.style.background = "rgb(238, 206, 102)";
                state.mode = "draw";
                break;
            case 'KeyE':
                //reset old button
                modeBtn.style.background = "rgb(131, 131, 131)";
                //set new button
                modeBtn = document.querySelector("#erase");
                modeBtn.style.background = "rgb(238, 206, 102)";
                state.mode = "erase";
                break;
            case 'KeyP':
                //reset old button
                modeBtn.style.background = "rgb(131, 131, 131)";
                //set new button
                modeBtn = document.querySelector("#perfect");
                modeBtn.style.background = "rgb(238, 206, 102)";
                state.mode = "perfect";
                break;
            case 'KeyB':
                //reset old button
                toolBtn.style.background = "rgb(131, 131, 131)";
                //set new button
                toolBtn = document.querySelector("#pencil");
                toolBtn.style.background = "rgb(238, 206, 102)";
                state.tool = tools["pencil"];
                onScreenCVS.style.cursor = "crosshair";
                break;
            case 'KeyR':
                //reset old button
                toolBtn.style.background = "rgb(131, 131, 131)";
                //set new button
                toolBtn = document.querySelector("#replace");
                toolBtn.style.background = "rgb(238, 206, 102)";
                state.tool = tools["replace"];
                onScreenCVS.style.cursor = "crosshair";
                break;
            case 'KeyL':
                //reset old button
                toolBtn.style.background = "rgb(131, 131, 131)";
                //set new button
                toolBtn = document.querySelector("#line");
                toolBtn.style.background = "rgb(238, 206, 102)";
                state.tool = tools["line"];
                onScreenCVS.style.cursor = "none";
                break;
            case 'KeyF':
                //reset old button
                toolBtn.style.background = "rgb(131, 131, 131)";
                //set new button
                toolBtn = document.querySelector("#fill");
                toolBtn.style.background = "rgb(238, 206, 102)";
                state.tool = tools["fill"];
                onScreenCVS.style.cursor = "none";
                break;
            case 'KeyC':
                //reset old button
                toolBtn.style.background = "rgb(131, 131, 131)";
                //set new button
                toolBtn = document.querySelector("#curve");
                toolBtn.style.background = "rgb(238, 206, 102)";
                state.tool = tools["curve"];
                onScreenCVS.style.cursor = "none";
                break;
            default:
            //do nothing
        }
    }
}

function handleKeyUp(e) {
    if (e.code === 'Space' || e.code === 'AltLeft' || e.code === 'AltRight' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
        state.tool = tools[toolBtn.id];
    }

    if (toolBtn.id === "grab") {
        onScreenCVS.style.cursor = "move";
    } else if (toolBtn.id === "replace" || toolBtn.id === "pencil" || toolBtn.id === "curve") {
        onScreenCVS.style.cursor = "crosshair";
    } else {
        onScreenCVS.style.cursor = "none";
    }
}

function handleWheel(e) {
    let delta = Math.sign(e.deltaY);
    //BUG: zoom is off center just a bit and drawing before moving the mouse has odd effects
    //zoom based on mouse coords
    let z;
    let rw = ocWidth / offScreenCVS.width;
    let nox = Math.round(((state.mox * state.ratio) / 5 / zoom) / rw) * rw;
    let noy = Math.round(((state.moy * state.ratio) / 5 / zoom) / rw) * rw;
    if (delta < 0) {
        z = 0.8;
        zoom *= z;
        state.xOffset += nox;
        state.yOffset += noy;
    } else if (delta > 0) {
        z = 1.25;
        state.xOffset -= nox;
        state.yOffset -= noy;
        zoom *= z;
    }
    //re scale canvas
    onScreenCTX.scale(z, z);
    state.lastOffsetX = state.xOffset;
    state.lastOffsetY = state.yOffset;
    renderImage();
}

function handleMouseMove(e) {
    state.event = "mousemove";
    //currently only square dimensions work
    state.trueRatio = onScreenCVS.offsetWidth / offScreenCVS.width * zoom;
    state.ratio = ocWidth / offScreenCVS.width * zoom;
    //coords
    state.mox = Math.floor(e.offsetX / state.trueRatio);
    state.moy = Math.floor(e.offsetY / state.trueRatio);
    state.mouseX = Math.round(state.mox - (state.xOffset / state.ratio * zoom));
    state.mouseY = Math.round(state.moy - (state.yOffset / state.ratio * zoom));
    //Hover brush
    state.onX = state.mox * state.ratio / zoom;
    state.onY = state.moy * state.ratio / zoom;
    if (state.clicked || (state.tool.name === "curve" && clickCounter > 0)) {
        //run selected tool step function
        state.tool.fn();
    } else {
        //only draw preview brush when necessary
        if (state.onX !== state.lastOnX || state.onY !== state.lastOnY) {
            onScreenCTX.clearRect(0, 0, ocWidth / zoom, ocHeight / zoom);
            drawCanvas();
            renderCursor();
            state.lastOnX = state.onX;
            state.lastOnY = state.onY;
        }
    }
}

function handleMouseDown(e) {
    state.event = "mousedown";
    state.clicked = true;
    state.trueRatio = onScreenCVS.offsetWidth / offScreenCVS.width * zoom;
    state.mox = Math.floor(e.offsetX / state.trueRatio);
    state.moy = Math.floor(e.offsetY / state.trueRatio);
    state.mouseX = Math.round(state.mox - (state.xOffset / state.ratio * zoom));
    state.mouseY = Math.round(state.moy - (state.yOffset / state.ratio * zoom));
    //run selected tool step function
    state.tool.fn();
}

function handleMouseUp(e) {
    state.event = "mouseup";
    state.clicked = false;
    state.trueRatio = onScreenCVS.offsetWidth / offScreenCVS.width * zoom;
    state.mox = Math.floor(e.offsetX / state.trueRatio);
    state.moy = Math.floor(e.offsetY / state.trueRatio);
    state.mouseX = Math.round(state.mox - (state.xOffset / state.ratio * zoom));
    state.mouseY = Math.round(state.moy - (state.yOffset / state.ratio * zoom));
    //run selected tool step function
    state.tool.fn();
    //add to undo stack
    if (state.points.length) {
        state.undoStack.push(state.points);
    }
    state.points = [];
    //Reset redostack
    state.redoStack = [];
    state.event = "none";
    img.onload = () => {
        renderCursor();
    }
}

function handleMouseOut(e) {
    if (state.clicked) {
        state.event = "mouseout";
        state.clicked = false;
        state.tool.fn();
        //add to undo stack
        if (state.points.length) {
            state.undoStack.push(state.points);
        }
        state.points = [];
        //Reset redostack
        state.redoStack = [];
        onScreenCTX.clearRect(0, 0, ocWidth / zoom, ocHeight / zoom);
        drawCanvas();
    }
    state.event = "none";
}

function renderCursor() {
    switch (state.tool.name) {
        case "grab":
            //show nothing
            break;
        case "picker":
            //empty square
            drawCursorBox();
            break;
        default:
            drawCurrentPixel();
            drawCursorBox();
    }
    function drawCursorBox() {
        //line offset to stroke offcenter;
        let ol = 0;
        onScreenCTX.beginPath();
        onScreenCTX.lineWidth = 0.5;
        onScreenCTX.strokeStyle = "black";
        //top
        onScreenCTX.moveTo(state.onX, state.onY - ol);
        onScreenCTX.lineTo(state.onX + state.ratio / zoom, state.onY - ol);
        //right
        onScreenCTX.moveTo(state.onX + ol + state.ratio / zoom, state.onY);
        onScreenCTX.lineTo(state.onX + ol + state.ratio / zoom, state.onY + state.ratio / zoom);
        //bottom
        onScreenCTX.moveTo(state.onX, state.onY + ol + state.ratio / zoom);
        onScreenCTX.lineTo(state.onX + state.ratio / zoom, state.onY + ol + state.ratio / zoom);
        //left
        onScreenCTX.moveTo(state.onX - ol, state.onY);
        onScreenCTX.lineTo(state.onX - ol, state.onY + state.ratio / zoom);
        // onScreenCTX.rect(state.onX, state.onY, state.ratio / zoom, state.ratio / zoom);
        // onScreenCTX.lineWidth = 0.5;
        // onScreenCTX.strokeStyle = "black";
        // onScreenCTX.stroke();
        // onScreenCTX.beginPath();
        // onScreenCTX.rect(state.onX + 0.5, state.onY + 0.5, state.ratio / zoom - 1, state.ratio / zoom - 1);
        // onScreenCTX.lineWidth = 0.5;
        // onScreenCTX.strokeStyle = "white";
        onScreenCTX.stroke();
    }
}

function drawCurrentPixel() {
    //draw onscreen current pixel
    if (state.mode === "erase") {
        onScreenCTX.clearRect(state.onX, state.onY, state.ratio / zoom, state.ratio / zoom);
    } else {
        onScreenCTX.fillStyle = state.brushColor.color;
        onScreenCTX.fillRect(state.onX, state.onY, state.ratio / zoom, state.ratio / zoom);
    }
}

function handleUndo() {
    if (state.undoStack.length > 0) {
        actionUndoRedo(state.redoStack, state.undoStack);
    }
}

function handleRedo() {
    if (state.redoStack.length >= 1) {
        actionUndoRedo(state.undoStack, state.redoStack);
    }
}

function handleRecenter(e) {
    onScreenCTX.scale(1 / zoom, 1 / zoom);
    zoom = 1;
    state.xOffset = 0;
    state.yOffset = 0;
    state.lastOffsetX = 0;
    state.lastOffsetY = 0;
    renderImage();
}

function handleClear() {
    addToTimeline("clear", 0, 0);
    state.undoStack.push(state.points);
    state.points = [];
    state.redoStack = [];
    offScreenCTX.clearRect(0, 0, offScreenCVS.width, offScreenCVS.height);
    source = offScreenCVS.toDataURL();
    renderImage();
}

function handleZoom(e) {
    //BUG: offcenter
    //general zoom based on center
    if (e.target.closest(".square")) {
        let zoomBtn = e.target.closest(".square");
        let z;
        let rw = ocWidth / offScreenCVS.width;
        let nox = Math.round((ocWidth / 10 / zoom) / rw) * rw;
        let noy = Math.round((ocHeight / 10 / zoom) / rw) * rw;
        if (zoomBtn.id === "minus") {
            z = 0.8;
            zoom *= z;
            state.xOffset += nox;
            state.yOffset += noy;
        } else if (zoomBtn.id === "plus") {
            z = 1.25;
            state.xOffset -= nox;
            state.yOffset -= noy;
            zoom *= z;
        }
        //re scale canvas
        onScreenCTX.scale(z, z);
        state.lastOffsetX = state.xOffset;
        state.lastOffsetY = state.yOffset;
        renderImage();
    }
}

function handleTools(e) {
    if (e.target.closest(".tool")) {
        //failsafe for hacking tool ids
        if (tools[e.target.closest(".tool").id]) {
            //reset old button
            toolBtn.style.background = "rgb(131, 131, 131)";
            //get new button and select it
            toolBtn = e.target.closest(".tool");
            toolBtn.style.background = "rgb(238, 206, 102)";
            state.tool = tools[toolBtn.id];
            if (toolBtn.id === "grab") {
                onScreenCVS.style.cursor = "move";
            } else if (toolBtn.id === "replace" || toolBtn.id === "pencil" || toolBtn.id === "curve") {
                onScreenCVS.style.cursor = "crosshair";
            } else {
                onScreenCVS.style.cursor = "none";
            }
        }
    }
}

function handleModes(e) {
    if (e.target.closest(".mode")) {
        //reset old button
        modeBtn.style.background = "rgb(131, 131, 131)";
        //get new button and select it
        modeBtn = e.target.closest(".mode");
        modeBtn.style.background = "rgb(238, 206, 102)";
        state.mode = modeBtn.id;
    }
}

function addToTimeline(tool, x, y) {
    //use current state for variables
    //pencil, replace
    state.points.push({
        //x/y are sometimes objects with multiple values
        x: x,
        y: y,
        size: state.tool.brushSize,
        color: { ...state.brushColor },
        tool: tool,
        action: state.tool.fn,
        mode: state.mode
    });
    source = offScreenCVS.toDataURL();
    renderImage();
}

//Action functions
//controller for draw
function drawSteps() {
    switch (state.event) {
        case "mousedown":
            actionDraw(state.mouseX, state.mouseY, state.brushColor, state.tool.brushSize, state.mode);
            state.lastX = state.mouseX;
            state.lastY = state.mouseY;
            state.lastDrawnX = state.mouseX;
            state.lastDrawnY = state.mouseY;
            state.waitingPixelX = state.mouseX;
            state.waitingPixelY = state.mouseY;
            addToTimeline(state.tool.name, state.mouseX, state.mouseY);
            break;
        case "mousemove":
            drawCurrentPixel();
            if (state.lastX !== state.mouseX || state.lastY !== state.mouseY) {
                renderImage();
                drawCurrentPixel();
                //draw between points when drawing fast
                if (Math.abs(state.mouseX - state.lastX) > 1 || Math.abs(state.mouseY - state.lastY) > 1) {
                    //add to options, only execute if "continuous line" is on
                    actionLine(state.lastX, state.lastY, state.mouseX, state.mouseY, state.brushColor, offScreenCTX, state.mode);
                    addToTimeline("line", { x1: state.lastX, x2: state.mouseX }, { y1: state.lastY, y2: state.mouseY });
                } else {
                    //perfect will be option, not mode
                    if (state.mode === "perfect") {
                        perfectPixels(state.mouseX, state.mouseY);
                    } else {
                        actionDraw(state.mouseX, state.mouseY, state.brushColor, state.tool.brushSize, state.mode);
                        addToTimeline(state.tool.name, state.mouseX, state.mouseY);
                    }
                }
            }
            // save last point
            state.lastX = state.mouseX;
            state.lastY = state.mouseY;
            break;
        case "mouseup":
            //only needed if perfect pixels option is on
            actionDraw(state.mouseX, state.mouseY, state.brushColor, state.tool.brushSize, state.mode);
            addToTimeline(state.tool.name, state.mouseX, state.mouseY);
            break;
        default:
        //do nothing
    }
}

function perfectPixels(currentX, currentY) {
    //if currentPixel not neighbor to lastDrawn, draw waitingpixel
    if (Math.abs(currentX - state.lastDrawnX) > 1 || Math.abs(currentY - state.lastDrawnY) > 1) {
        actionDraw(state.waitingPixelX, state.waitingPixelY, state.brushColor, state.tool.brushSize, state.mode);
        //update queue
        state.lastDrawnX = state.waitingPixelX;
        state.lastDrawnY = state.waitingPixelY;
        state.waitingPixelX = currentX;
        state.waitingPixelY = currentY;
        //add to points stack
        //can't be replaced by current timeline function due to wrong x,y values
        state.points.push({
            //for line
            startX: state.lastX,
            startY: state.lastY,
            //for everything
            x: state.lastDrawnX,
            y: state.lastDrawnY,
            size: state.tool.brushSize,
            color: { ...state.brushColor },
            tool: state.tool.name,
            action: state.tool.fn,
            mode: state.mode
        });
        source = offScreenCVS.toDataURL();
        renderImage();
    } else {
        state.waitingPixelX = currentX;
        state.waitingPixelY = currentY;
    }
}

function actionDraw(coordX, coordY, currentColor, size, currentMode) {
    offScreenCTX.fillStyle = currentColor.color;
    switch (currentMode) {
        case "erase":
            offScreenCTX.clearRect(Math.ceil(coordX - size / 2), Math.ceil(coordY - size / 2), size, size);
            break;
        default:
            offScreenCTX.fillRect(Math.ceil(coordX - size / 2), Math.ceil(coordY - size / 2), size, size);
    }
}

//controller function to run action appropriately
function lineSteps() {
    switch (state.event) {
        case "mousedown":
            state.lastX = state.mouseX;
            state.lastY = state.mouseY;
            break;
        case "mousemove":
            //draw line from origin point to current point onscreen
            //only draw when necessary
            if (state.onX !== state.lastOnX || state.onY !== state.lastOnY) {
                onScreenCTX.clearRect(0, 0, ocWidth / zoom, ocHeight / zoom);
                drawCanvas();
                actionLine(state.lastX + (state.xOffset / state.ratio * zoom), state.lastY + (state.yOffset / state.ratio * zoom), state.mox, state.moy, state.brushColor, onScreenCTX, state.mode, state.ratio / zoom);
                state.lastOnX = state.onX;
                state.lastOnY = state.onY;
            }
            break;
        case "mouseup":
            actionLine(state.lastX, state.lastY, state.mouseX, state.mouseY, state.brushColor, offScreenCTX, state.mode);
            addToTimeline(state.tool.name, { x1: state.lastX, x2: state.mouseX }, { y1: state.lastY, y2: state.mouseY });
            //seriously, why do I need this? img.onload should've fired when I called renderImage from addToTimeline
            window.setTimeout(renderImage, 0);
            break;
        default:
        //do nothing
    }
}

function actionLine(sx, sy, tx, ty, currentColor, ctx, currentMode, scale = 1) {
    ctx.fillStyle = currentColor.color;
    let drawPixel = (x, y, w, h) => { return currentMode === "erase" ? ctx.clearRect(x, y, w, h) : ctx.fillRect(x, y, w, h) };
    //create triangle object
    let tri = {}
    function getTriangle(x1, y1, x2, y2, ang) {
        if (Math.abs(x1 - x2) > Math.abs(y1 - y2)) {
            tri.x = Math.sign(Math.cos(ang));
            tri.y = Math.tan(ang) * Math.sign(Math.cos(ang));
            tri.long = Math.abs(x1 - x2);
        } else {
            tri.x = Math.tan((Math.PI / 2) - ang) * Math.sign(Math.cos((Math.PI / 2) - ang));
            tri.y = Math.sign(Math.cos((Math.PI / 2) - ang));
            tri.long = Math.abs(y1 - y2);
        }
    }
    // finds the angle of (x,y) on a plane from the origin
    function getAngle(x, y) {
        return Math.atan(y / (x == 0 ? 0.01 : x)) + (x < 0 ? Math.PI : 0);
    }
    let angle = getAngle(tx - sx, ty - sy); // angle of line
    getTriangle(sx, sy, tx, ty, angle);

    for (let i = 0; i < tri.long; i++) {
        let thispoint = { x: Math.round(sx + tri.x * i), y: Math.round(sy + tri.y * i) };
        // for each point along the line
        drawPixel(thispoint.x * scale, // round for perfect pixels
            thispoint.y * scale, // thus no aliasing
            scale, scale); // fill in one pixel, 1x1

    }
    //fill endpoint
    drawPixel(Math.round(tx) * scale, // round for perfect pixels
        Math.round(ty) * scale, // thus no aliasing
        scale, scale); // fill in one pixel, 1x1
}

//helper for replace and fill to get color on canvas
function getColor(x, y, colorLayer) {
    let canvasColor = {};

    let startPos = (y * offScreenCVS.width + x) * 4;
    //clicked color
    canvasColor.r = colorLayer.data[startPos];
    canvasColor.g = colorLayer.data[startPos + 1];
    canvasColor.b = colorLayer.data[startPos + 2];
    canvasColor.a = colorLayer.data[startPos + 3];
    canvasColor.color = `rgba(${canvasColor.r},${canvasColor.g},${canvasColor.b},${canvasColor.a})`
    return canvasColor;
}

//controller for replace
function replaceSteps() {
    switch (state.event) {
        case "mousedown":
            //get global colorlayer data to use while mouse is down
            state.colorLayerGlobal = offScreenCTX.getImageData(0, 0, offScreenCVS.width, offScreenCVS.height);
            actionReplace();
            state.lastX = state.mouseX;
            state.lastY = state.mouseY;
            // state.lastDrawnX = state.mouseX;
            // state.lastDrawnY = state.mouseY;
            // state.waitingPixelX = state.mouseX;
            // state.waitingPixelY = state.mouseY;
            //get rid of onscreen cursor
            source = offScreenCVS.toDataURL();
            renderImage();
            break;
        case "mousemove":
            //only execute when necessary
            //draw onscreen current pixel if match to backColor
            // can't add smoother lines until line replace method is added
            if (state.lastX !== state.mouseX || state.lastY !== state.mouseY) {
                actionReplace();
                if (Math.abs(state.mouseX - state.lastX) > 1 || Math.abs(state.mouseY - state.lastY) > 1) {
                    //add to options, only execute if "continuous line" is on
                    lineReplace(state.lastX, state.lastY, state.mouseX, state.mouseY, state.brushColor, offScreenCTX, state.mode);
                } else {
                    //perfect will be option, not mode
                    // if (state.mode === "perfect") {
                    //     perfectPixels(state.mouseX, state.mouseY);
                    // } else {
                    actionReplace();
                    // }
                }
            }
            // save last point
            state.lastX = state.mouseX;
            state.lastY = state.mouseY;
            break;
        case "mouseup":
            //only needed if perfect pixels option is on
            actionReplace();
            //re-render image to allow onscreen cursor to render
            renderImage();
            break;
        default:
        //do nothing
    }
}

function lineReplace(sx, sy, tx, ty, currentColor, ctx, currentMode) {
    ctx.fillStyle = currentColor.color;
    //create triangle object
    let tri = {}
    function getTriangle(x1, y1, x2, y2, ang) {
        if (Math.abs(x1 - x2) > Math.abs(y1 - y2)) {
            tri.x = Math.sign(Math.cos(ang));
            tri.y = Math.tan(ang) * Math.sign(Math.cos(ang));
            tri.long = Math.abs(x1 - x2);
        } else {
            tri.x = Math.tan((Math.PI / 2) - ang) * Math.sign(Math.cos((Math.PI / 2) - ang));
            tri.y = Math.sign(Math.cos((Math.PI / 2) - ang));
            tri.long = Math.abs(y1 - y2);
        }
    }
    // finds the angle of (x,y) on a plane from the origin
    function getAngle(x, y) { return Math.atan(y / (x == 0 ? 0.01 : x)) + (x < 0 ? Math.PI : 0); }
    let angle = getAngle(tx - sx, ty - sy); // angle of line
    getTriangle(sx, sy, tx, ty, angle);

    for (let i = 0; i < tri.long; i++) {
        let thispoint = { x: Math.round(sx + tri.x * i), y: Math.round(sy + tri.y * i) };
        // for each point along the line
        let clickedColor = getColor(thispoint.x, thispoint.y, state.colorLayerGlobal);
        if (clickedColor.color === state.backColor.color) {
            actionDraw(thispoint.x, thispoint.y, state.brushColor, state.tool.brushSize, currentMode);
            addToTimeline(state.tool.name, thispoint.x, thispoint.y);
        }
    }
    //fill endpoint
    let clickedColor = getColor(Math.round(tx), Math.round(ty), state.colorLayerGlobal);
    if (clickedColor.color === state.backColor.color) {
        actionDraw(Math.round(tx), Math.round(ty), state.brushColor, state.tool.brushSize, currentMode);
        addToTimeline(state.tool.name, Math.round(tx), Math.round(ty));
    }
}

function actionReplace() {
    //sample color and replace if match
    state.clickedColor = getColor(state.mouseX, state.mouseY, state.colorLayerGlobal);
    if (state.clickedColor.color === state.backColor.color) {
        actionDraw(state.mouseX, state.mouseY, state.brushColor, state.tool.brushSize, state.mode);
        addToTimeline(state.tool.name, state.mouseX, state.mouseY);
    }
}

//controller for fill
function fillSteps() {
    switch (state.event) {
        case "mousedown":
            actionFill(state.mouseX, state.mouseY, state.brushColor, state.mode);
            addToTimeline(state.tool.name, state.mouseX, state.mouseY);
            break;
        case "mouseup":
            //re-render image to allow onscreen cursor to render
            renderImage();
        default:
        //do nothing
    }
}

//For undo ability, store starting coords and settings and pass them into actionFill
function actionFill(startX, startY, currentColor, currentMode) {
    //exit if outside borders
    if (startX < 0 || startX >= offScreenCVS.width || startY < 0 || startY >= offScreenCVS.height) {
        return;
    }
    //get imageData
    state.colorLayerGlobal = offScreenCTX.getImageData(0, 0, offScreenCVS.width, offScreenCVS.height);

    state.clickedColor = getColor(startX, startY, state.colorLayerGlobal);

    if (currentMode === "erase") currentColor = { color: "rgba(0,0,0,0)", r: 0, g: 0, b: 0, a: 0 };

    //exit if color is the same
    if (currentColor.color === state.clickedColor.color) {
        return;
    }
    //Start with click coords
    let pixelStack = [[startX, startY]];
    let newPos, x, y, pixelPos, reachLeft, reachRight;
    floodFill();
    function floodFill() {
        newPos = pixelStack.pop();
        x = newPos[0];
        y = newPos[1];

        //get current pixel position
        pixelPos = (y * offScreenCVS.width + x) * 4;
        // Go up as long as the color matches and are inside the canvas
        while (y >= 0 && matchStartColor(pixelPos)) {
            y--;
            pixelPos -= offScreenCVS.width * 4;
        }
        //Don't overextend
        pixelPos += offScreenCVS.width * 4;
        y++;
        reachLeft = false;
        reachRight = false;
        // Go down as long as the color matches and in inside the canvas
        while (y < offScreenCVS.height && matchStartColor(pixelPos)) {

            colorPixel(pixelPos);

            if (x > 0) {
                if (matchStartColor(pixelPos - 4)) {
                    if (!reachLeft) {
                        //Add pixel to stack
                        pixelStack.push([x - 1, y]);
                        reachLeft = true;
                    }
                } else if (reachLeft) {
                    reachLeft = false;
                }
            }

            if (x < offScreenCVS.width - 1) {
                if (matchStartColor(pixelPos + 4)) {
                    if (!reachRight) {
                        //Add pixel to stack
                        pixelStack.push([x + 1, y]);
                        reachRight = true;
                    }
                } else if (reachRight) {
                    reachRight = false;
                }
            }
            y++;
            pixelPos += offScreenCVS.width * 4;
        }

        if (pixelStack.length) {
            floodFill();
        }
    }

    //render floodFill result
    offScreenCTX.putImageData(state.colorLayerGlobal, 0, 0);

    //helpers
    function matchStartColor(pixelPos) {
        let r = state.colorLayerGlobal.data[pixelPos];
        let g = state.colorLayerGlobal.data[pixelPos + 1];
        let b = state.colorLayerGlobal.data[pixelPos + 2];
        let a = state.colorLayerGlobal.data[pixelPos + 3];
        return (r === state.clickedColor.r && g === state.clickedColor.g && b === state.clickedColor.b && a === state.clickedColor.a);
    }

    function colorPixel(pixelPos) {
        state.colorLayerGlobal.data[pixelPos] = currentColor.r;
        state.colorLayerGlobal.data[pixelPos + 1] = currentColor.g;
        state.colorLayerGlobal.data[pixelPos + 2] = currentColor.b;
        //not ideal
        state.colorLayerGlobal.data[pixelPos + 3] = currentColor.a;
    }
}

//temp
let clickCounter = 0;
let px1, py1, px2, py2, px3, py3;

function curveSteps() {
    switch (state.event) {
        case "mousedown":
            clickCounter += 1;
            if (clickCounter > 3) clickCounter = 1;
            switch (clickCounter) {
                case 1:
                    px1 = state.mouseX;
                    py1 = state.mouseY;
                    break;
                case 2:
                    px2 = state.mouseX;
                    py2 = state.mouseY;
                    break;
                case 3:
                    // px3 = state.mouseX;
                    // py3 = state.mouseY;
                    break;
                default:
                //do nothing
            }
            //definitive step occurs on offscreen canvas
            // actionCurve(x1, y1, x2, y2, x3, y3, clickCounter, state.brushColor, offScreenCTX, state.mode);
            // drawCanvas();
            break;
        case "mousemove":
            //draw line from origin point to current point onscreen
            //only draw when necessary
            if (state.onX !== state.lastOnX || state.onY !== state.lastOnY) {
                // onScreenCTX.clearRect(0, 0, ocWidth / zoom, ocHeight / zoom);
                //BUG: curve flickers due to delay when drawCanvas renders the background image and when the preview curve is drawn again. Solve by using a dedicated preview canvas
                drawCanvas();
                //onscreen preview
                actionCurve(px1 + (state.xOffset / state.ratio * zoom), py1 + (state.yOffset / state.ratio * zoom), px2 + (state.xOffset / state.ratio * zoom), py2 + (state.yOffset / state.ratio * zoom), px3 + (state.xOffset / state.ratio * zoom), py3 + (state.yOffset / state.ratio * zoom), clickCounter, state.brushColor, onScreenCTX, state.mode, state.ratio / zoom);
                state.lastOnX = state.onX;
                state.lastOnY = state.onY;
            }
            break;
        case "mouseup" || "mouseout":
            if (clickCounter === 3) {
                px3 = state.mouseX;
                py3 = state.mouseY;
                actionCurve(px1, py1, px2, py2, px3, py3, clickCounter + 1, state.brushColor, offScreenCTX, state.mode)
                clickCounter = 0;
                //store control points for timeline
                addToTimeline(state.tool.name, { x1: px1, x2: px2, x3: px3 }, { y1: py1, y2: py2, y3: py3 });
                //seriously, why do I need this? img.onload should've fired when I called renderImage from addToTimeline
                window.setTimeout(renderImage, 0);
            }
            break;
        default:
        //do nothing
    }
}

//Curved Lines
function actionCurve(x1, y1, x2, y2, x3, y3, stepNum, currentColor, ctx, currentMode, scale = 1) {
    //New algo to try: use bresenham's algorithm
    //look into algorithms for pixelating vector line art
    ctx.fillStyle = currentColor.color;
    function pt(p1, p2, p3, t) {
        //center control points on their pixels
        p1 += 0.5;
        p2 += 0.5;
        p3 += 0.5;
        //quadratic bezier equation to find point along curve (solves for x/y coordinates based on t) 
        // return Math.floor(p3 + Math.pow((1 - t), 2) * (p1 - p3) + Math.pow(t, 2) * (p2 - p3));
        //no rounding
        return p3 + Math.pow((1 - t), 2) * (p1 - p3) + Math.pow(t, 2) * (p2 - p3);
    }
    let tNum = 32;
    lastXt = x1;
    lastYt = y1;

    //derivative for slope
    function dpt(p1, p2, p3, t) {
        return -2 * (1 - t) * (p1 - p3) + 2 * t * (p2 - p3);
    }

    //second derivative for curvature
    function ddpt(p1, p2, p3) {
        return 2 * (p1 - p3) + 2 * (p2 - p3);
    }

    //radius of curvature for parametric functions
    function denom(dx, dy, ddx, ddy) {
        return dx * ddy - dy * ddx;
    }

    function radius(dx, dy, ddx, ddy) {
        let numerator = Math.pow(Math.pow(dx, 2) + Math.pow(dy, 2), 1.5);
        let denominator = denom(dx, dy, ddx, ddy);
        return Math.abs(numerator / denominator);
    }

    //s
    function speed(dx, dy) {
        return Math.sqrt(Math.pow(dx, 2) + Math.pow(dy, 2));
    }

    //increment t, constrained to less than one pixel distance
    function incT(dx, dy) {
        let denom = Math.sqrt(Math.pow(dx, 2) + Math.pow(dy, 2));
        let xdiff = dx / denom;
        let ydiff = dy / denom;
        let integral = Math.sqrt(Math.pow(xdiff, 2) + Math.pow(ydiff, 2));
        return { xdiff: xdiff, ydiff: ydiff };
    }

    function renderCurve(controlX, controlY) {
        function plot(x, y) {
            //rounded values
            let xt = Math.floor(x);
            let yt = Math.floor(y);

            //plot starting coordinates
            if (stepNum === 2 || stepNum === 3) {
                onScreenCTX.fillRect(xt * state.ratio / zoom, yt * state.ratio / zoom, scale, scale);
            } else if (stepNum === 4) {
                ctx.fillRect(xt, yt, scale, scale)
            }
        }

        function assert(condition, message) {
            if (!condition) {
                throw new Error(message || "Assertion failed");
            }
        }

        plotQuadBezier(x1, y1, controlX, controlY, x2, y2);

        //BUG: flatter curves don't work, add code to account for flat curves.

        function plotQuadBezier(x0, y0, x1, y1, x2, y2) { /* plot any quadratic Bezier curve */
            let x = x0 - x1, y = y0 - y1;
            let t = x0 - 2 * x1 + x2, r;
            if (x * (x2 - x1) > 0) { /* horizontal cut at P4? */
                if (y * (y2 - y1) > 0) /* vertical cut at P6 too? */
                    if (Math.abs((y0 - 2 * y1 + y2) / t * x) > Math.abs(y)) { /* which first? */
                        x0 = x2; x2 = x + x1; y0 = y2; y2 = y + y1; /* swap points */
                    } /* now horizontal cut at P4 comes first */
                t = (x0 - x1) / t;
                r = (1 - t) * ((1 - t) * y0 + 2.0 * t * y1) + t * t * y2; /* By(t=P4) */
                t = (x0 * x2 - x1 * x1) * t / (x0 - x1); /* gradient dP4/dx=0 */
                x = Math.floor(t + 0.5); y = Math.floor(r + 0.5);
                r = (y1 - y0) * (t - x0) / (x1 - x0) + y0; /* intersect P3 | P0 P1 */
                plotQuadBezierSeg(x0, y0, x, Math.floor(r + 0.5), x, y);
                r = (y1 - y2) * (t - x2) / (x1 - x2) + y2; /* intersect P4 | P1 P2 */
                x0 = x1 = x; y0 = y; y1 = Math.floor(r + 0.5); /* P0 = P4, P1 = P8 */
            }
            if ((y0 - y1) * (y2 - y1) > 0) { /* vertical cut at P6? */
                t = y0 - 2 * y1 + y2; t = (y0 - y1) / t;
                r = (1 - t) * ((1 - t) * x0 + 2.0 * t * x1) + t * t * x2; /* Bx(t=P6) */
                t = (y0 * y2 - y1 * y1) * t / (y0 - y1); /* gradient dP6/dy=0 */
                x = Math.floor(r + 0.5); y = Math.floor(t + 0.5);
                r = (x1 - x0) * (t - y0) / (y1 - y0) + x0; /* intersect P6 | P0 P1 */
                plotQuadBezierSeg(x0, y0, Math.floor(r + 0.5), y, x, y);
                r = (x1 - x2) * (t - y2) / (y1 - y2) + x2; /* intersect P7 | P1 P2 */
                x0 = x; x1 = Math.floor(r + 0.5); y0 = y1 = y; /* P0 = P6, P1 = P7 */
            }
            plotQuadBezierSeg(x0, y0, x1, y1, x2, y2); /* remaining part */
        }

        //bresenham's algorithm for bezier limited to gradients without sign change.
        function plotQuadBezierSeg(x0, y0, x1, y1, x2, y2) {
            let sx = x2 - x1, sy = y2 - y1;
            let xx = x0 - x1, yy = y0 - y1, xy;         /* relative values for checks */
            let dx, dy, err, cur = xx * sy - yy * sx;                    /* curvature */

            assert(xx * sx <= 0 && yy * sy <= 0, "sign of gradient must not change");  /* sign of gradient must not change */

            if (sx * sx + sy * sy > xx * xx + yy * yy) { /* begin with longer part */
                x2 = x0; x0 = sx + x1; y2 = y0; y0 = sy + y1; cur = -cur;  /* swap P0 P2 */
            }
            if (cur != 0) {                                    /* no straight line */
                xx += sx; xx *= sx = x0 < x2 ? 1 : -1;           /* x step direction */
                yy += sy; yy *= sy = y0 < y2 ? 1 : -1;           /* y step direction */
                xy = 2 * xx * yy; xx *= xx; yy *= yy;          /* differences 2nd degree */
                if (cur * sx * sy < 0) {                           /* negated curvature? */
                    xx = -xx; yy = -yy; xy = -xy; cur = -cur;
                }
                dx = 4.0 * sy * cur * (x1 - x0) + xx - xy;             /* differences 1st degree */
                dy = 4.0 * sx * cur * (y0 - y1) + yy - xy;
                xx += xx; yy += yy; err = dx + dy + xy;                /* error 1st step */
                while (dy < dx) { /* gradient negates -> algorithm fails */
                    plot(x0, y0);                                     /* plot curve */
                    if (x0 == x2 && y0 == y2) return;  /* last pixel -> curve finished */
                    y1 = 2 * err < dx;                  /* save value for test of y step */
                    if (2 * err > dy) { x0 += sx; dx -= xy; err += dy += yy; } /* x step */
                    if (y1) { y0 += sy; dy -= xy; err += dx += xx; } /* y step */
                }
            }
            /* plot remaining part to end */
            if (stepNum === 2 || stepNum === 3) {
                //create triangle object
                let tri = {}
                function getTriangle(x1, y1, x2, y2, ang) {
                    if (Math.abs(x1 - x2) > Math.abs(y1 - y2)) {
                        tri.x = Math.sign(Math.cos(ang));
                        tri.y = Math.tan(ang) * Math.sign(Math.cos(ang));
                        tri.long = Math.abs(x1 - x2);
                    } else {
                        tri.x = Math.tan((Math.PI / 2) - ang) * Math.sign(Math.cos((Math.PI / 2) - ang));
                        tri.y = Math.sign(Math.cos((Math.PI / 2) - ang));
                        tri.long = Math.abs(y1 - y2);
                    }
                }
                // finds the angle of (x,y) on a plane from the origin
                function getAngle(x, y) {
                    return Math.atan(y / (x == 0 ? 0.01 : x)) + (x < 0 ? Math.PI : 0);
                }
                let angle = getAngle(x2 - x0, y2 - y0); // angle of line
                getTriangle(x0, y0, x2, y2, angle);

                for (let i = 0; i < tri.long; i++) {
                    let thispoint = { x: Math.round(x0 + tri.x * i), y: Math.round(y0 + tri.y * i) };
                    // for each point along the line
                    plot(thispoint.x, thispoint.y)
                }
                //fill endpoint
                plot(x2, y2);
            } else if (stepNum === 4) {
                actionLine(x0, y0, x2, y2, state.brushColor, ctx, state.mode);
            }
        }
    }

    function renderCurve2(controlX, controlY) {
        let xNext, yNext;
        let t = 0;
        while (t <= 0.5) {
            let truext = pt(x1, x2, controlX, t);
            let trueyt = pt(y1, y2, controlY, t);

            //derivatives
            let dxt = dpt(x1, x2, controlX, t);
            let dyt = dpt(y1, y2, controlY, t);
            let ddxt = ddpt(x1, x2, controlX);
            let ddyt = ddpt(y1, y2, controlY);

            let sign = Math.sign(denom(dxt, dyt, ddxt, ddyt));
            let rad = radius(dxt, dyt, ddxt, ddyt);
            let s = speed(dxt, dyt);
            let circlex = truext - sign * (dyt / s) * rad;
            let circley = trueyt - sign * (-dxt / s) * rad;

            //rounded values
            let xt = Math.floor(truext);
            let yt = Math.floor(trueyt);

            let nextxt = pt(x1, x2, controlX, t + 0.01);
            let nextyt = pt(y1, y2, controlY, t + 0.01);

            let dist = Math.sqrt(Math.pow(nextxt - truext, 2) + Math.pow(nextyt - trueyt, 2)) * 2;

            t += 0.01 / dist;

            if ((xNext && yNext) && (xt !== xNext || yt !== yNext)) {
                //skip this t value
                continue;
            }

            //BUG: calculation breaks down for sharp curves due to small size of tangent circle
            //running curve rendering from t=1 simultaneously so it meets in the middle at t=0.5 is not enough
            //Needs a better way to calculate next pixel for sharp curves
            //bresenham's algorithm using the circle to estimate. 
            let m1 = Math.abs(Math.sqrt(Math.pow(xt + 1.5 - circlex, 2) + Math.pow(yt + 0.5 - circley, 2)) - rad);
            let m2 = Math.abs(Math.sqrt(Math.pow(xt + 1.5 - circlex, 2) + Math.pow(yt + 1.5 - circley, 2)) - rad);
            let m3 = Math.abs(Math.sqrt(Math.pow(xt + 0.5 - circlex, 2) + Math.pow(yt + 1.5 - circley, 2)) - rad);
            let m4 = Math.abs(Math.sqrt(Math.pow(xt - 0.5 - circlex, 2) + Math.pow(yt + 1.5 - circley, 2)) - rad);
            let m5 = Math.abs(Math.sqrt(Math.pow(xt - 0.5 - circlex, 2) + Math.pow(yt + 0.5 - circley, 2)) - rad);
            let m6 = Math.abs(Math.sqrt(Math.pow(xt - 0.5 - circlex, 2) + Math.pow(yt - 0.5 - circley, 2)) - rad);
            let m7 = Math.abs(Math.sqrt(Math.pow(xt + 0.5 - circlex, 2) + Math.pow(yt - 0.5 - circley, 2)) - rad);
            let m8 = Math.abs(Math.sqrt(Math.pow(xt + 1.5 - circlex, 2) + Math.pow(yt - 0.5 - circley, 2)) - rad);

            let direction = [];

            //contained logic per case to avoid matching values among all 8 m options causing errors
            switch (true) {
                case (Math.sign(dxt) === 1 && Math.sign(dyt) === 1):
                    //Q1
                    direction.push(m1, m2, m3);
                    direction.sort();
                    switch (direction[0]) {
                        case m1:
                            xNext = xt + 1;
                            yNext = yt;
                            break;
                        case m2:
                            xNext = xt + 1;
                            yNext = yt + 1;
                            break;
                        case m3:
                            xNext = xt;
                            yNext = yt + 1;
                            break;
                        default:
                        //
                    }
                    break;
                case (Math.sign(dxt) === -1 && Math.sign(dyt) === 1):
                    //Q2
                    direction.push(m3, m4, m5);
                    direction.sort();
                    switch (direction[0]) {
                        case m3:
                            xNext = xt;
                            yNext = yt + 1;
                            break;
                        case m4:
                            xNext = xt - 1;
                            yNext = yt + 1;
                            break;
                        case m5:
                            xNext = xt - 1;
                            yNext = yt;
                            break;
                        default:
                        //
                    }
                    break;
                case (Math.sign(dxt) === -1 && Math.sign(dyt) === -1):
                    //Q3
                    direction.push(m5, m6, m7);
                    direction.sort();
                    switch (direction[0]) {
                        case m5:
                            xNext = xt - 1;
                            yNext = yt;
                            break;
                        case m6:
                            xNext = xt - 1;
                            yNext = yt - 1;
                            break;
                        case m7:
                            xNext = xt;
                            yNext = yt - 1;
                            break;
                        default:
                        //
                    }
                    break;
                case (Math.sign(dxt) === 1 && Math.sign(dyt) === -1):
                    //Q4
                    direction.push(m7, m8, m1);
                    direction.sort();
                    switch (direction[0]) {
                        case m7:
                            xNext = xt;
                            yNext = yt - 1;
                            break;
                        case m8:
                            xNext = xt + 1;
                            yNext = yt - 1;
                            break;
                        case m1:
                            xNext = xt + 1;
                            yNext = yt;
                            break;
                        default:
                        //
                    }
                    break;
                default:
                    continue;
            }

            if (stepNum === 2 || stepNum === 3) {
                onScreenCTX.fillRect(xt * state.ratio / zoom, yt * state.ratio / zoom, scale, scale);
            } else if (stepNum === 4) {
                ctx.fillRect(xt, yt, scale, scale);
            }
        }
        let xlnext, ylnext;
        t = 1;
        while (t >= 0.5) {
            let truext = pt(x1, x2, controlX, t);
            let trueyt = pt(y1, y2, controlY, t);

            //derivatives
            let dxt = dpt(x1, x2, controlX, t);
            let dyt = dpt(y1, y2, controlY, t);
            let ddxt = ddpt(x1, x2, controlX);
            let ddyt = ddpt(y1, y2, controlY);

            let sign = Math.sign(denom(dxt, dyt, ddxt, ddyt));
            let rad = radius(dxt, dyt, ddxt, ddyt);
            let s = speed(dxt, dyt);
            let circlex = truext - sign * (dyt / s) * rad;
            let circley = trueyt - sign * (-dxt / s) * rad;

            //rounded values
            let xt = Math.floor(truext);
            let yt = Math.floor(trueyt);

            let nextxt = pt(x1, x2, controlX, t - 0.01);
            let nextyt = pt(y1, y2, controlY, t - 0.01);

            let dist = Math.sqrt(Math.pow(nextxt - truext, 2) + Math.pow(nextyt - trueyt, 2)) * 2;

            t -= 0.01 / dist;

            if ((xlnext && ylnext) && (xt !== xlnext || yt !== ylnext)) {
                //skip this t value
                continue;
            }

            let m1 = Math.abs(Math.sqrt(Math.pow(xt + 1.5 - circlex, 2) + Math.pow(yt + 0.5 - circley, 2)) - rad);
            let m2 = Math.abs(Math.sqrt(Math.pow(xt + 1.5 - circlex, 2) + Math.pow(yt + 1.5 - circley, 2)) - rad);
            let m3 = Math.abs(Math.sqrt(Math.pow(xt + 0.5 - circlex, 2) + Math.pow(yt + 1.5 - circley, 2)) - rad);
            let m4 = Math.abs(Math.sqrt(Math.pow(xt - 0.5 - circlex, 2) + Math.pow(yt + 1.5 - circley, 2)) - rad);
            let m5 = Math.abs(Math.sqrt(Math.pow(xt - 0.5 - circlex, 2) + Math.pow(yt + 0.5 - circley, 2)) - rad);
            let m6 = Math.abs(Math.sqrt(Math.pow(xt - 0.5 - circlex, 2) + Math.pow(yt - 0.5 - circley, 2)) - rad);
            let m7 = Math.abs(Math.sqrt(Math.pow(xt + 0.5 - circlex, 2) + Math.pow(yt - 0.5 - circley, 2)) - rad);
            let m8 = Math.abs(Math.sqrt(Math.pow(xt + 1.5 - circlex, 2) + Math.pow(yt - 0.5 - circley, 2)) - rad);

            let direction = [];

            switch (true) {
                case (Math.sign(-dxt) === 1 && Math.sign(-dyt) === 1):
                    //Q1
                    direction.push(m1, m2, m3);
                    direction.sort();
                    switch (direction[0]) {
                        case m1:
                            xlnext = xt + 1;
                            ylnext = yt;
                            break;
                        case m2:
                            xlnext = xt + 1;
                            ylnext = yt + 1;
                            break;
                        case m3:
                            xlnext = xt;
                            ylnext = yt + 1;
                            break;
                        default:
                        //
                    }
                    break;
                case (Math.sign(-dxt) === -1 && Math.sign(-dyt) === 1):
                    //Q2
                    direction.push(m3, m4, m5);
                    direction.sort();
                    switch (direction[0]) {
                        case m3:
                            xlnext = xt;
                            ylnext = yt + 1;
                            break;
                        case m4:
                            xlnext = xt - 1;
                            ylnext = yt + 1;
                            break;
                        case m5:
                            xlnext = xt - 1;
                            ylnext = yt;
                            break;
                        default:
                        //
                    }
                    break;
                case (Math.sign(-dxt) === -1 && Math.sign(-dyt) === -1):
                    //Q3
                    direction.push(m5, m6, m7);
                    direction.sort();
                    switch (direction[0]) {
                        case m5:
                            xlnext = xt - 1;
                            ylnext = yt;
                            break;
                        case m6:
                            xlnext = xt - 1;
                            ylnext = yt - 1;
                            break;
                        case m7:
                            xlnext = xt;
                            ylnext = yt - 1;
                            break;
                        default:
                        //
                    }
                    break;
                case (Math.sign(-dxt) === 1 && Math.sign(-dyt) === -1):
                    //Q4
                    direction.push(m7, m8, m1);
                    direction.sort();
                    switch (direction[0]) {
                        case m7:
                            xlnext = xt;
                            ylnext = yt - 1;
                            break;
                        case m8:
                            xlnext = xt + 1;
                            ylnext = yt - 1;
                            break;
                        case m1:
                            xlnext = xt + 1;
                            ylnext = yt;
                            break;
                        default:
                        //
                    }
                    break;
                default:
                    continue;
            }

            if (stepNum === 2 || stepNum === 3) {
                onScreenCTX.fillRect(xt * state.ratio / zoom, yt * state.ratio / zoom, scale, scale);
            } else if (stepNum === 4) {
                ctx.fillRect(xt, yt, scale, scale)
            }
        }
    }

    if (stepNum === 1) {
        //after defining x1y1
        actionLine(x1, y1, state.mox, state.moy, currentColor, onScreenCTX, currentMode, scale);
    } else if (stepNum === 2 || stepNum === 3) {
        // after defining x2y2
        //onscreen preview curve
        // bezier curve
        // tNum = Math.abs(x1 - x2) > Math.abs(y1 - y2) ? Math.floor(Math.abs(x1 - x2) * 20) : Math.floor(Math.abs(y1 - y2) * 20);
        renderCurve(state.mox, state.moy);
        // renderCurve2(state.mox, state.moy);
        // for (let i = 0; i < tNum; i++) {
        //     let truext = pt(x1, x2, state.mox, i / tNum);
        //     let trueyt = pt(y1, y2, state.moy, i / tNum);
        //     //rounded values
        //     let xt = Math.floor(truext);
        //     let yt = Math.floor(trueyt);

        //     actionLine(lastXt, lastYt, xt, yt, currentColor, onScreenCTX, currentMode, scale);
        //     lastXt = xt;
        //     lastYt = yt;
        //     // onScreenCTX.fillStyle = "black";
        //     onScreenCTX.fillRect(xt * state.ratio / zoom, yt * state.ratio / zoom, scale, scale);
        // }
        // actionLine(lastXt, lastYt, x2, y2, currentColor, onScreenCTX, currentMode, scale);
    } else if (stepNum === 4) {
        //curve after defining x3y3
        // bezier curve
        // tNum = Math.floor(Math.sqrt(Math.pow(x1-x2,2)+Math.pow(y1-y2,2)));
        // tNum = Math.abs(x1 - x2) > Math.abs(y1 - y2) ? Math.floor(Math.abs(x1 - x2) * 20) : Math.floor(Math.abs(y1 - y2) * 20);
        // console.log("tNum:", tNum)
        renderCurve(x3, y3);
        // renderCurve2(x3, y3);

        //render drawing
        source = offScreenCVS.toDataURL();
        renderImage();
    }
}

//Non-actions
//Color picker
function pickerSteps() {
    switch (state.event) {
        case "mousedown":
            //set color
            sampleColor(state.mouseX, state.mouseY);
            break;
        case "mousemove":
            //only draw when necessary, get color here too
            if (state.onX !== state.lastOnX || state.onY !== state.lastOnY) {
                //get color
                sampleColor(state.mouseX, state.mouseY);
                //draw square
                onScreenCTX.clearRect(0, 0, ocWidth / zoom, ocHeight / zoom);
                drawCanvas();
                renderCursor();
                state.lastOnX = state.onX;
                state.lastOnY = state.onY;
            }
            break;
        default:
        //do nothing
    }
}

//picker function, tool but not an action
function sampleColor(x, y) {
    //get imageData
    state.colorLayerGlobal = offScreenCTX.getImageData(0, 0, offScreenCVS.width, offScreenCVS.height);

    let newColor = getColor(x, y, state.colorLayerGlobal);
    //not simply passing whole color in until random color function is refined
    setColor(newColor.r, newColor.g, newColor.b, "swatch btn");
}

function setColor(r, g, b, target) {
    if (target === "swatch btn") {
        state.brushColor.color = `rgba(${r},${g},${b},255)`;
        state.brushColor.r = r;
        state.brushColor.g = g;
        state.brushColor.b = b;
        swatch.style.background = state.brushColor.color;
    } else {
        state.backColor.color = `rgba(${r},${g},${b},255)`;
        state.backColor.r = r;
        state.backColor.g = g;
        state.backColor.b = b;
        backSwatch.style.background = state.backColor.color;
    }
}

function grabSteps() {
    switch (state.event) {
        case "mousemove":
            //only draw when necessary, get color here too
            state.xOffset = state.onX - state.lastOnX + state.lastOffsetX;
            state.yOffset = state.onY - state.lastOnY + state.lastOffsetY;
            renderImage();
            break;
        case "mouseup":
            state.lastOffsetX = state.xOffset;
            state.lastOffsetY = state.yOffset;
            state.lastOnX = state.onX;
            state.lastOnY = state.onY;
            break;
        case "mouseout":
            state.lastOffsetX = state.xOffset;
            state.lastOffsetY = state.yOffset;
            break;
        default:
        //do nothing
    }
}

//Main pillar of the code structure
function actionUndoRedo(pushStack, popStack) {
    pushStack.push(popStack.pop());
    offScreenCTX.clearRect(0, 0, offScreenCVS.width, offScreenCVS.height);
    redrawPoints();
    source = offScreenCVS.toDataURL();
    renderImage();
}

function redrawPoints() {
    //follows stored instructions to reassemble drawing. Costly, but only called upon undo/redo
    state.undoStack.forEach(action => {
        action.forEach(p => {
            switch (p.tool) {
                case "clear":
                    offScreenCTX.clearRect(0, 0, offScreenCVS.width, offScreenCVS.height);
                    break;
                case "fill":
                    actionFill(p.x, p.y, p.color, p.mode);
                    break;
                case "line":
                    actionLine(p.x.x1, p.y.y1, p.x.x2, p.y.y2, p.color, offScreenCTX, p.mode)
                    break;
                case "curve":
                    actionCurve(p.x.x1, p.y.y1, p.x.x2, p.y.y2, p.x.x3, p.y.y3, 4, p.color, offScreenCTX, p.mode)
                    break;
                default:
                    actionDraw(p.x, p.y, p.color, p.size, p.mode);
            }
        })
    })
}

//Once the image is loaded, draw the image onto the onscreen canvas.
function renderImage() {
    img.onload = () => {
        onScreenCTX.clearRect(0, 0, ocWidth / zoom, ocHeight / zoom);
        drawCanvas();
    }
    img.src = source;
}

function drawCanvas() {
    //Prevent blurring
    onScreenCTX.imageSmoothingEnabled = false;
    onScreenCTX.fillStyle = "gray";
    onScreenCTX.fillRect(0, 0, ocWidth / zoom, ocHeight / zoom);
    onScreenCTX.clearRect(state.xOffset, state.yOffset, ocWidth, ocHeight);
    onScreenCTX.drawImage(img, state.xOffset, state.yOffset, ocWidth, ocHeight);
    onScreenCTX.beginPath();
    onScreenCTX.rect(state.xOffset - 1, state.yOffset - 1, ocWidth + 2, ocHeight + 2);
    onScreenCTX.lineWidth = 2;
    onScreenCTX.strokeStyle = "black";
    onScreenCTX.stroke();
}

function randomizeColor(e) {
    let r = Math.floor(Math.random() * 256);
    let g = Math.floor(Math.random() * 256);
    let b = Math.floor(Math.random() * 256);
    setColor(r, g, b, e.target.className);
}

function openColorPicker(e) {
    picker.swatch = e.target.className;
    picker.update();
    //main page can't be interacted with
    fullPage.style.pointerEvents = "none";
    //disable shortcuts
    state.shortcuts = false;
    //show colorpicker
    colorPicker.style.display = "flex";
    //allow colorPicker events
    colorPicker.style.pointerEvents = "auto";
}

function switchColors(e) {
    let temp = { ...state.brushColor };
    state.brushColor = state.backColor;
    swatch.style.background = state.brushColor.color;
    state.backColor = temp;
    backSwatch.style.background = state.backColor.color;
}