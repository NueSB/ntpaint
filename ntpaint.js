import { Color } from "./lib/color.js";
import { Picker } from "./lib/picker.js";
import { Graphics, m4 } from "./lib/graphics.js";

"use strict";

var canvas = document.querySelector("#c"),
	gl = canvas.getContext("webgl2"),
    drawing = false,
    lastCoords = { x:-1, y:-1 },
    uiContainer = document.querySelector(".drawcontainer"),
    uiColorContainer = document.querySelector(".colorcontainer"),
    uiBottomToolbar = document.querySelector(".ui-bottom-toolbar"),
    uiToolIcon = document.querySelector(".overlaytool"),
    uiToolIconSpin = uiToolIcon.animate(
        [
            {transform: "rotateY(0deg)" },{transform: "rotateY(360deg)" }
        ],
        {
            duration: 1000,
            easing: "cubic-bezier(0,1.31,.76,1.02)"
        }
    ),
    uiToast = document.querySelector(".toast"),
    uiToastAnimation = uiToast.animate(
        [
            {opacity: 1},
            {opacity: 0, offset: 0.5},
            {opacity: 0}
        ],
        {
            duration: 2000,
            easing: "linear"
        }
    ),
    uiCharacterIcon = document.querySelector("#overlaychar-img"),
    uiLayerContainer = document.querySelector(".layercontainer"),
    uiLayerList = document.querySelector("#layerlist"),
    uiLayerTemplate = document.querySelector(".layer"),
    uiLayerOpacity = document.querySelector("#opacity-ctrl"),
    uiLayerAdd = document.querySelector("#add-layer"),
    uiLayerRemove = document.querySelector("#remove-layer");
//
    var canvasWidth = 1024;
    var canvasHeight = 1024;

var tempCanvas = document.createElement("canvas");
var tempCtx = tempCanvas.getContext("2d");

var subPicker = document.createElement( "div" );
    subPicker.id = "subpicker";
    uiColorContainer.appendChild(subPicker);

var mainPicker = document.createElement( "div" );
    mainPicker.id = "mainpicker";
    uiColorContainer.appendChild(mainPicker);

var colorPicker = new Picker("#colorpicker");

const TOOL = {
    PENCIL: 0,
    BUCKET: 1,
    EYEDROPPER: 2,
    ERASER: 3,
    BRUSH: 4,
    HAND: 5,
    TRANSFORM: 6
};

class Layer {
    name = "X";
    width = 0;
    height = 0;
    opacity = 1;
    blendMode = 0;
    renderTarget = 0;
    id = 0;
    canvas = null;
    ctx = null;
    uiElement = null;
    isDirty = false;

    constructor(name = "X")
    {
        this.name = name;
        // id is used for reference in the graphics api, since textures use a string. current date timestamp - layer list
        // length in case of multiple being created on a single timestep
        this.id = Date.now() + g_layers.length;
        this.renderTarget = Graphics.createRenderTarget( this.id, canvasWidth, canvasHeight );
        // might be useful later for "usable area" compression or so. unused atm
        this.width = canvasWidth;
        this.height = canvasHeight;
        this.canvas = document.createElement("canvas");
        this.ctx = this.canvas.getContext("2d");
    }

    resize(w, h)
    {

    }

    drawCanvas()
    {
        
    }
}


function clamp(x,min,max)
{
    return Math.min(Math.max(x, min), max);
}

function clamp01(x)
{
    return Math.min(Math.max(x, 0), 1);
}

function distance(a,b)
{
  return Math.sqrt( Math.pow(b.x-a.x, 2) + Math.pow(b.y-a.y,2) );
}

function keyDown(keyName)
{
  if (!g_keyStates.has(keyName))
  {
  	g_keyStates.set(keyName, {state: false, lastState: false, downTimestamp: 0, upTimestamp: 0});
    return false;
  }
	var key = g_keyStates.get(keyName);
  return key.state;
}

function keyUp(keyName)
{
  if (!g_keyStates.has(keyName))
  {
  	g_keyStates.set(keyName, {state: false, lastState: false, downTimestamp: 0, upTimestamp: 0});
    return false;
  }
	var key = g_keyStates.get(keyName);
  return !key.state;
}

function keyPressed(keyName)
{
  if (!g_keyStates.has(keyName))
  {
  	g_keyStates.set(keyName, {state: false, lastState: false, downTimestamp: 0, upTimestamp: 0});
    return false;
  }
	var key = g_keyStates.get(keyName);
  return key.state && !key.lastState;
}

const Vec2 = function(x,y)
{
	return {
  		x: x,
      y: y,

      magnitude: function()
      {
        return Math.sqrt(this.x * this.x + this.y * this.y);
      },
      normalize: function()
      {
        var mag = this.magnitude();
        return Vec2(this.x / mag, this.y / mag);
      },
      scale: function(i) { return Vec2(this.x * i, this.y * i) },
      multiply: function(vec)
      {
      	return Vec2(this.x * vec.x, this.y * vec.y);
      },
      add: function(vec)
      {
      	return Vec2(this.x + vec.x, this.y + vec.y);
      },
      sub: function(vec)
      {
      	return Vec2(this.x - vec.x, this.y - vec.y);
      },
      divide: function(vec)
      {
      	return Vec2(this.x / vec.x, this.y / vec.y);
      },
      toString: function()
      {
      	return `vec2(${this.x},${this.y})`;
      }
  }
}

function main()
{
    g_drawBlank = false;

    for (var i = 0; i < g_drawQueue.length; i++)
    {
        mainDraw( g_drawQueue[i] );
    }

    g_drawQueue = [];
    g_drawBlank = true;



    requestAnimationFrame(main);
}

// draw to the texture that contains "normal" combined layers
function drawBackbuffer( region )
{
    if (region == undefined)
    {
        region = {x: 0, y: 0, w: canvasWidth, h: canvasHeight};
    }

    Graphics.setRenderTarget("backbuffer");
    {
        Graphics.save();
        Graphics.translate(0, canvasHeight);
        Graphics.scale(1, -1);
        Graphics.drawColor = new Color("#AAAAAA");
        Graphics.fillRect(region.x, region.y, region.w, region.h);
        //Graphics.clearRect(region.x, region.y, region.w, region.h);

        for (var i = g_layers.length-1; i >= 0 ; i--)
        {
            gl.enable ( gl.BLEND );
            gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
            // ctx.globalCompositeOperation = LAYER MODE HERE
                Graphics.globalAlpha = g_layers[i].opacity;
                Graphics.drawImage( g_layers[i].renderTarget.texture, 
                    region.x, region.y, region.w, region.h, 
                    region.x, region.y, region.w, region.h );
        }
        Graphics.restore();
    }
    Graphics.setRenderTarget(null);
}

// provide a custom region to clear if needed (cursor updates, etc)
function mainDraw(customClear)
{
    // framerate lock
    if (g_drawBlank)
    {
        if (!customClear)
            g_drawQueue = [];
        g_drawQueue.push(customClear || undefined);
        return;
    }

    Graphics.setRenderTarget(null);

    Graphics.updateTextures();
    Graphics.drawColor = new Color("#3A3A3A");
    Graphics.fillRect(0,0,canvas.width, canvas.height);
    
    Graphics.translate(g_viewTransform.x, g_viewTransform.y);
    Graphics.scale( g_viewScale, g_viewScale );

    let region = {x: 0, y: 0, w: canvas.width, h: canvas.height};

    
    //if (!customClear || customClear.force)
    {
        //Graphics.clearRect(0,0, canvas.width, canvas.height);
    }

    Graphics.drawColor = new Color("#909999");
    Graphics.fillRect(0, 0, canvasWidth, canvasHeight);
    Graphics.drawColor = Color.white;
    Graphics.tintColor = Color.white;
    Graphics.save();
    Graphics.translate(0, canvasHeight)
    Graphics.scale(1, -1);
    Graphics.drawImage( "backbuffer", 0, 0);
    Graphics.restore();
    

    /*
    if (debug)
    {
        ctx.clearRect(0,0, canvas.width, canvas.height);
        ctx.drawImage( backbuffer, 0, 0 );
    
        let size = 32;
        let j = 0;
        for(var i = g_undoHistory.length-1; i > Math.max(0, g_undoHistory.length - Math.floor(512/32)); i--)
        {
            ctx.font = "50px serif";
            ctx.fillText(g_undoHistory[i].layer.name, j * size + j, canvas.height - 256);
            //ctx.fillText(g_undoHistory[i].layer);
            ctx_dbg.putImageData(g_undoHistory[i].data, 0, 0);
            //Graphics.fillRect(i * size + i, canvas.height - size, size, size);
            ctx.drawImage(debugcanvas, j * size + j, canvas.height - size - 220, size, size);
            ctx.strokeStyle = (g_undoHistory.length - i) - 1 == g_undoPosition   ? "#00ff00" : "#ff0000";
            ctx.strokeRect(j * size + j, canvas.height - size - 220, size, size);
            j++;
        }
    }
    */
   
    Graphics.drawColor = Color.red;
    let size = -1;
    if (g_tools[g_currentTool].size)
    {
        size = g_tools[g_currentTool].size;
        Graphics.lineRect( lastCoords.x - size / 2, lastCoords.y - size / 2, size, size );    
    }

    switch(g_currentTool) // cursors, whenever that happens
    {
        default:
            break;
    }

    Graphics.drawColor = Color.green;

    let transform = g_tools[TOOL.TRANSFORM];
    let transformRegion = rect2box(transform.startPoint, 
        transform.endPoint,
    );

    if (transformRegion.w > 1 || transformRegion.h > 1)
    {
        Graphics.lineRect( transformRegion.x, transformRegion.y, transformRegion.w, transformRegion.h );

        if (transform.copiedTexture)
        {
            Graphics.drawImage( "temp-transform", 0, 0, transformRegion.w, transformRegion.h,
                transformRegion.x, transformRegion.y, transformRegion.w, transformRegion.h, 0, true );
        }

        
    }

    Graphics.scale( 1/g_viewScale, 1/g_viewScale );
    Graphics.translate(-g_viewTransform.x, -g_viewTransform.y);
}

function setBrushSize( i )
{
    g_BrushSize = i;
    g_tools[ g_currentTool ].size = g_BrushSize;
    mainDraw( { x: lastCoords.x - g_BrushSize / 2, 
                y: lastCoords.y - g_BrushSize / 2,
                w: g_BrushSize, 
                h: g_BrushSize } );
}

function setTool(i)
{
    if (i == -1) 
        g_currentTool = (g_currentTool == TOOL.PENCIL ? TOOL.BUCKET : TOOL.PENCIL);
    else 
        g_currentTool = i;

    let sprite = "err";
    if (g_currentTool <= 4 && g_currentTool >= 0)
        sprite = ["pencil", "bucket", "eyedropper", "eraser", "brush"][g_currentTool];
    
    g_BrushSize = g_tools[ g_currentTool ].size;
    mainDraw( { x: lastCoords.x - g_BrushSize / 2, 
        y: lastCoords.y - g_BrushSize / 2,
        w: g_BrushSize, 
        h: g_BrushSize } );

    setTimeout(() => { uiToolIcon.src = "images/"+sprite+".png" }, 120);
    uiToolIconSpin.cancel();
    uiToolIconSpin.play();
}

function createLayer(index, name, pushUndo=false)
{
    let layer = new Layer( !name ? "Layer " + (g_layers.length+1).toString() : name );
    g_layers.unshift( layer );
    console.log(index);
    if (index)
        array_move(g_layers, 0, index);
    
    uiLayerTemplate.style = "";
    let layerUI = uiLayerTemplate.cloneNode(true);
    var i = g_layers.length - 1;
    uiLayerTemplate.style.display = "none";

    layer.uiElement = layerUI; 
    layer.uiElement.querySelector(".layer-img").appendChild( layer.canvas );

    if (pushUndo)
    {
        const event = {
            type: "LAYER_ADD",
            layer: layer,
            id: layer.id,
            layerIndex: g_layers.indexOf( layer ),
            // new layers are always blank so no need to store image state
        };

        pushUndoHistory(event);
    }

    layerUI.querySelector("span").innerHTML = layer.name;
    layerUI.onclick = (e) => {
        // traverse back up to main layer element as clicks can select any child
        let curElement = e.target;
        while( curElement.parentElement != uiLayerList )
        {
            curElement = curElement.parentElement;
        }
        // sub 1 as the hidden template element is still there
        let i_index = Array.prototype.indexOf.call(uiLayerList.children, curElement)-1;
        console.log(i_index)
        setActiveLayer( i_index ) 
    };
    //layerUI.querySelector(".layer-img").appendChild( layer.canvas );
    
    uiLayerList.insertBefore(layerUI, uiLayerList.children[1]);
    if (index &&
        index < g_layers.length-1 &&
        index >= 0)
    {
        // adding one due to the 
        uiLayerList.insertBefore( layerUI, uiLayerList.children[index+2] );
    }

    setActiveLayer( 0 );
    
    return layer;
}

function removeLayer(layer, pushUndo=false)
{
    if (!layer)
        return;
    if (g_layers.length == 1)
    {
        clearLayer();
        return;
    }
    
    // draw -> remove1 -> remove2
    // timeline:
    // undo,
    // stack pointer is now on remove1.
    // redo from undo (or elsewhere): SP now on rem1
    //r rm event contains uuuuuuuuhhhh
    // layer data and position in the list
    // (we need this for reinitialization)
    // layer add-remove is special and procs before pushing the stack pointer backwards.
    if (pushUndo)
    {
        Graphics.setRenderTarget( g_currentLayer.id )
        const event = {
            type: "LAYER_REMOVE",
            layer: g_currentLayer,
            id: g_currentLayer.id,
            layerIndex: g_layers.indexOf( g_currentLayer ),
            data: Graphics.getImageData(0,0,g_currentLayer.width, g_currentLayer.height)
        };

        pushUndoHistory(event);
    }
    
    let index = g_layers.indexOf(layer);
    console.log(layer.uiElement);
    if (layer.uiElement.parentNode == uiLayerList)
        uiLayerList.removeChild(layer.uiElement);
    Graphics.deleteRenderTarget(layer.id);
    g_layers.splice( index, 1 );
    if (layer == g_currentLayer)
    {
        index = clamp( index, 0, g_layers.length-1 );
        setActiveLayer(index);
    }
    drawBackbuffer();
}

function setActiveLayer(i)
{
    if (g_currentLayer)
        g_currentLayer.uiElement.classList.toggle("layer-active");

    if (typeof i == typeof 0)
        g_currentLayer = g_layers[ i ];
    else if (typeof i == "object")
        g_currentLayer = i;
    
    g_currentLayer.uiElement.classList.toggle("layer-active");

    uiLayerOpacity.value = Math.floor(g_currentLayer.opacity * 100);
}

// value 0-100
function setLayerOpacity( index, opacity )
{
    let layer = null;
    if (index == -1)
        layer = g_currentLayer;
    else
        layer = g_layers[index];

    layer.uiElement.querySelector(".layer-text").children[1].innerHTML = `${opacity}% normal`;
    layer.opacity = opacity / 100;
    drawBackbuffer();
}

// https://stackoverflow.com/questions/17386707/how-to-check-if-a-canvas-is-blank
function isCanvasBlank(renderTarget) 
{
    Graphics.setRenderTarget( renderTarget );
    const pixelBuffer = new Uint8Array( canvasWidth * canvasHeight * 4 );
    gl.readPixels( 0, 0, canvasWidth, canvasHeight, gl.RGBA, gl.UNSIGNED_BYTE, pixelBuffer )

    return !pixelBuffer.some(color => color !== 0);
}

var g_viewTransform = Vec2(0,0);
var g_viewScale = 1.0;
var g_BrushSize = 3;
var g_currentLine = {
    currentDist: 0,
    
}
var g_MainColor = new Color(0, 0, 0);
var g_SubColor = new Color(1, 1, 1);
var g_currentColor = g_MainColor;
var g_currentTool = 0;
var bucketAnimation = {
    srcColor: 0,
    replacementColor: 0,
    ops: 0,
    filledPixels: 0,
    data: 0,
    imageData: 0,
    iterations: 0,
    iterationSkipAmt: 1,
    active: false,
}
var g_undoHistory = [];
var g_undoMax = 128;
var g_undoPosition = 0;
var g_keyStates = new Map();
var g_tools = [
    {
        name: "pcl",
        size: 16,
        opacity: 0.2,
    },
    {
        name: "bkt",
        opacity: 1,
    },
    {
        name: "drp",
        size: 1,
        opacity: 1,
    },
    {
        name: "ers",
        size: 16,
        opacity: 1,
    },
    {
        name: "brs",
        size: 16,
        soft: false,
        textured: false,
        texture: undefined,
        opacity: 1,
    },
    {
        name: "hand",
    },
    {
        name: "transform",
        startPoint: Vec2(0,0),
        endPoint: Vec2(0,0),
        drawing: false,
        copiedTexture: false,
    }
]
var g_actionKeys = {
    undo: {
        key: "Z",
        ctrlKey: true,
        shiftKey: false,
        altKey: false,
        func: undo,
        event: "down",
    },
    redo: {
        key: "Z",
        ctrlKey: true,
        shiftKey: true,
        altKey: false,
        func: redo,
        event: "down",
    },
    swap: {
        key: "X",
        ctrlKey: false,
        shiftKey: false,
        altKey: false,
        func: swapColors,
        event: "press",
    },
    brush: {
        key: "B",
        ctrlKey: false,
        shiftKey: false,
        altKey: false,
        func: setTool,
        event: "press",
        args: [TOOL.BRUSH]
    },
    bucket: {
        key: "G",
        ctrlKey: false,
        shiftKey: false,
        altKey: false,
        func: setTool,
        event: "press",
        args: [TOOL.BUCKET]
    },
    eyedropper: {
        key: "K",
        ctrlKey: false,
        shiftKey: false,
        altKey: false,
        func: setTool,
        event: "press",
        args: [TOOL.EYEDROPPER]
    },
    drawAltStart: {
        key: "F",
        ctrlKey: false,
        shiftKey: false,
        altKey: false,
        func: drawStart,
        event: "down",
    },    
    drawAltEnd: {
        key: "F",
        ctrlKey: false,
        shiftKey: false,
        altKey: false,
        func: drawEnd,
        event: "up",
    },
    copy: {
        key: "C",
        ctrlKey: true,
        shiftKey: false,
        altKey: false,
        event: "press",
        func: exportCopy,
    },
    save: {
        key: "S",
        ctrlKey: true,
        shiftKey: false,
        altKey: false,
        event: "press",
        func: exportCopy,
        args: [true]
    },
    paste: {
        key: "V",
        ctrlKey: true,
        shiftKey: false,
        altKey: false,
        event: "press",
        func: pasteImage,
        args: [Vec2(0,0)]
    },
    dragViewDown: {
        key: " ",
        ctrlKey: false,
        shiftKey: false,
        altKey: false,
        event: "press",
        func: dragView,
        args: [true]
    },
    dragViewUp: {
        key: " ",
        ctrlKey: false,
        shiftKey: false,
        altKey: false,
        event: "up",
        func: dragView,
        args: [false]
    },
    eraser: {
        key: "E",
        ctrlKey: false,
        shiftKey: false,
        altKey: false,
        event: "press",
        func: setTool,
        args: [TOOL.ERASER]
    },
    clear: {
        key: "DELETE",
        ctrlKey: false,
        shiftKey: false,
        altKey: false,
        event: "press",
        func: clearLayer
    },
    pencil: {
        key: "D",
        ctrlKey: false,
        shiftKey: false,
        altKey: false,
        event: "press",
        func: setTool,
        args: [TOOL.PENCIL]
    },
    transform: {
        key: "T",
        ctrlKey: false,
        shiftKey: false,
        altKey: false,
        event: "press",
        func: setTool,
        args: [TOOL.TRANSFORM]
    }
}
var g_drawQueue = [];
var g_drawBlank = false; // draw "blanking period"; space between frames
var g_brushSpacing = 2;
var g_isLoaded = false;
var g_isDragging = false;
var g_charAnimation = undefined;
var lastCoords_raw = Vec2(0,0);

var g_layers = [];
var g_currentLayer = undefined;
var g_layerctx = undefined;


Object.keys(g_actionKeys).forEach(action => {
    if (!g_keyStates.has(action.key))
        g_keyStates.set(action.key, {state: true, lastState: false, downTimestamp: Date.now(), upTimestamp: 0});
})

let debug = false;

{
    let debugcanvas = document.createElement("canvas");
    debugcanvas.height = canvasHeight;
    debugcanvas.width = canvasWidth;
    var ctx_dbg = debugcanvas.getContext("2d");



    let icon = document.createElement("img");
    icon.src = "images/placeholder.png";
    for (let i = 0; i < g_tools.length; i++)
    {
        let button = document.createElement("button");
        button.innerHTML += g_tools[i].name;
        button.appendChild(icon.cloneNode());
        button.onclick = function() { setTool( i ) };
        uiBottomToolbar.appendChild(button);
    }

    for (let i = 1; i < 256; i += i)
    {
        let button = document.createElement("button");
        button.innerHTML += i.toString().padStart(3, "0");
        button.appendChild(icon.cloneNode());
        button.onclick = function() { setBrushSize( i ) };
        uiBottomToolbar.appendChild(button);
    }

    let button = document.createElement("button");
    button.innerHTML = "undo";
    button.appendChild(icon).cloneNode();
    button.onclick = function() { undo() };
    uiBottomToolbar.appendChild(button);

    button = document.createElement("button");
    button.innerHTML = "redo";
    button.appendChild(icon.cloneNode());
    button.onclick = function() { redo() };
    uiBottomToolbar.appendChild(button);

    button = document.createElement("button");
    button.innerHTML = "clear";
    button.appendChild(icon.cloneNode());
    button.onclick = function() { clearLayer() };
    uiBottomToolbar.appendChild(button);

    uiLayerOpacity.addEventListener("input", e=>
        {
            setLayerOpacity( -1, e.target.value );
        }
    );

    
    Graphics.setup( gl );
    
    // misc texture. use for many things! primarily line drawing
    Graphics.createRenderTarget( "temp", canvasWidth, canvasHeight );
    Graphics.textures["temp-transform"] = {
        width: 2,
        height: 2,
        texture: Graphics.createGLTexture(2,2)
    };

    rescaleViewCanvas();
    
    Graphics.createRenderTarget("backbuffer", canvasWidth, canvasHeight);

    

    for (var i = 0; i < 1; i++)
    {
        createLayer( undefined, "Layer " + (i+1) );
    }

    uiLayerAdd.addEventListener("click", e=>{ createLayer(undefined, undefined, true) } );    
    uiLayerRemove.addEventListener("click", e=>{ removeLayer(g_currentLayer, true) } );

    let sortable = new Sortable(uiLayerList, 
        {
            animation: 150,
            onUpdate: function(e)
            {
                let targetLayer = g_layers[e.oldDraggableIndex-1];
                pushUndoHistory( {
                    type: "REORDER",
                    layer: targetLayer,
                    id: targetLayer.id,
                    old: e.oldDraggableIndex-1,
                    new: e.newDraggableIndex-1
                } ); 

                array_move(g_layers, 
                    e.oldDraggableIndex-1,
                    e.newDraggableIndex-1);
                drawBackbuffer();
            }
        }
    );


    
    setActiveLayer( 0 );

    Graphics.setRenderTarget("backbuffer");
    Graphics.loadTexture( tempCanvas, "tempCanvas" );
    
    setColor(0, Color.black);
    setColor(1, Color.white);
    setTool(0);

    main();
    
    g_isLoaded = true;
    displayToast("loaded!");
    
    mainDraw();
    drawBackbuffer();
}


function displayToast(message)
{
    uiToast.innerHTML = message;
    uiToastAnimation.cancel();
    uiToastAnimation.play();
}

function rescaleViewCanvas()
{
    let style = window.getComputedStyle(canvas.parentNode);
    canvas.width = parseInt(style.width.slice(0, -2));
    canvas.height = parseInt(style.height.slice(0, -2));

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport( 0, 0, canvas.width, canvas.height );

    if (g_isLoaded)
        mainDraw( { force: true } );
}


function clearLayer(pushUndo = true)
{
    Graphics.setRenderTarget( g_currentLayer.id );
    Graphics.clearRect(0,0,g_currentLayer.width, g_currentLayer.height);
    Graphics.setRenderTarget( null );
    if (pushUndo)
        pushUndoHistory();
    drawBackbuffer();
    mainDraw();
}

function dragView(isDragging)
{
    g_isDragging = isDragging;
    if (!isDragging && uiCharacterIcon.src == window.location+"images/nit_pull.png")
    {
        setCharacterIcon("nit1");
    }
    else
        if (isDragging) setCharacterIcon("nit_pull");
}

function setCharacterIcon(name)
{
    if (uiCharacterIcon.src == window.location+`images/${name}.png`)
        return;

    clearTimeout(g_charAnimation);
    g_charAnimation = undefined;
    uiCharacterIcon.src = `images/${name}.png`;
}

async function pasteImage(position) 
{
    try {
      const clipboardItems = await navigator.clipboard.read();
      for (const clipboardItem of clipboardItems) {
        if (clipboardItem.types.includes('image/png')) 
        { // Or 'image/jpeg'
          const blob = await clipboardItem.getType('image/png');
          const reader = new FileReader();
          reader.onload = () => {
            const img = document.createElement('img');
            img.onload = function() {
                Graphics.setRenderTarget( g_currentLayer.id );
                
                tempCanvas.width = img.width;
                tempCanvas.height = img.height;
                let region = { x:0,y:0,w:img.width,h:img.height };
                Graphics.textures["temp-transform"].width = region.w;
                Graphics.textures["temp-transform"].height = region.h;
                                
                // start a transform session
                tempCtx.scale(1, -1);
                tempCtx.drawImage(img, 0, 0, img.width, -img.height);
                tempCtx.scale(1, -1);
                
                setTool( TOOL.TRANSFORM );
                let transform = g_tools[TOOL.TRANSFORM];
                transform.drawing = false;
                transform.startPoint = Vec2(0,0);
                transform.endPoint = Vec2( img.width, img.height );

                gl.bindTexture(gl.TEXTURE_2D, Graphics.textures["temp-transform"].texture);
                gl.texImage2D( gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, tempCanvas);
                transform.copiedTexture = true;
            };
            img.src = reader.result;
          };
          reader.readAsDataURL(blob);
          return;
        }
      }
    } catch (err) {
      console.error('Failed to read image from clipboard:', err);
    }
  }

function swapColors()
{
    let tmp = g_MainColor;
    setColor(0, g_SubColor);
    setColor(1, tmp);
}

function dbg_logUndoHistory()
{
    console.clear();
    for( var i = g_undoHistory.length-1; i >= 0; i--)
    {
        let undoValue = g_undoHistory[i];
        console.log(`${i == g_undoHistory.length-1-g_undoPosition ? "->\t":"\t"} ${i}: ${ undoValue.type }; ID = ${undoValue.id}`);
    }
    console.log("----------------------");
}

// UNDO LOGIC:
// the undo history is stored as a queue system (first in last out) containing objects like so:
// { type: X, ... }
// the undo pointer starts at 0 (last element) and moves backwards from there. 1 is the 2nd from last, etc
// undo acts on the current pointed value, while redo acts on the previous.
// any layer-related operations need to store the layer being acted on's ID as to not lose
// its reference when undo/redo creates or destroys that layer.
// (U/R will destroy or recreate layers as needed, and iterate through all undo entries to update that ID)


function undo()
{
    if (debug) 
        dbg_logUndoHistory();
    // bounds check
    if (g_undoHistory.length == 0 || g_undoPosition == g_undoHistory.length)
    {
        console.log("undo bounds break")
        return;
    }
    let undoValue = g_undoHistory[g_undoHistory.length - 1 - g_undoPosition];

    displayToast("undo! " + undoValue.type);

    switch(undoValue.type)
    {
        case "DRAW":
            setActiveLayer( undoValue.layer );
            Graphics.setRenderTarget( undoValue.id );
            // find first drawing back from this value
            let foundEntry = false;
            for(var i = g_undoPosition+1; i < g_undoHistory.length; i++)
            {
                let entry = g_undoHistory[g_undoHistory.length - 1 - i];
                if (entry.id == undoValue.id && (entry.type == "DRAW" || entry.type == "LAYER_ADD"))
                {
                    undoValue = entry;
                    foundEntry = entry.type != "LAYER_ADD";
                    break;
                }
            }
            if (!foundEntry)
            {
                clearLayer(false);
            } else
                Graphics.putImageData(undoValue.data, 0, 0);
            break;
        
        case "LAYER_ADD":
            if (debug)
            {
                console.log("UNDO LAYER ADD: LAYER=");
                console.log(undoValue.layer);
            }
            // remove the layer that was just added and go to the last selected layer
            removeLayer( undoValue.layer );

            break;
        
        case "LAYER_REMOVE":
            // add the layer that was removed in this event and switch to it
            let layer = createLayer( undoValue.layerIndex, undoValue.layer.name );

            g_undoHistory.forEach(entry => {
                if (entry.id == undoValue.id)
                {
                    if (debug)
                    {
                        console.log( `\tid change: ${entry.id} -> ${layer.id}` );
                    }
                    entry.id = layer.id;
                    if (entry.layer) entry.layer = layer;
                    if (entry.layerIndex) entry.layerIndex = g_layers.indexOf( layer );
                }
            });

            setActiveLayer( undoValue.layerIndex );
            Graphics.setRenderTarget( layer.id );
            Graphics.putImageData(undoValue.data, 0, 0);

            // rebuild layer refs
            undoValue.layer = layer;
            undoValue.id = layer.id;
            undoValue.layerIndex = g_layers.indexOf( layer );

            break;

        case "REORDER":
            uiLayerList.insertBefore(undoValue.layer.uiElement, uiLayerList.children[undoValue.old+1])
            array_move(g_layers, 
                undoValue.new,
                undoValue.old);
            break;
        
        default:
            console.error("ERROR: invalid undo type " + undoValue.type);
            break;
    }
    
    g_undoPosition += 1 ;

    setCharacterIcon("nit_blink");
    g_charAnimation = setTimeout( () => { setCharacterIcon("nit1") }, 16.666666666*2 );
    drawBackbuffer();
    mainDraw();

    if (debug) 
        dbg_logUndoHistory();
}

function redo()
{
    if (debug) 
        dbg_logUndoHistory();
    // bounds check
    if (g_undoHistory.length == 0 || g_undoPosition == 0)
        return;

    g_undoPosition -= 1;

    let undoValue = g_undoHistory[g_undoHistory.length - 1 - g_undoPosition];

    if (debug)
        console.log(`redo: processing ${undoValue.type} op. undopos = ${g_undoPosition}`);

    displayToast("redo! " + undoValue.type);

    let s = "";

    switch(undoValue.type)
    {
        case "DRAW":
            setActiveLayer( undoValue.layer );
            Graphics.setRenderTarget( g_currentLayer.id );
            Graphics.putImageData(undoValue.data, 0, 0);
            break;
        
        case "LAYER_REMOVE":
            // remove that layer again
            removeLayer( undoValue.layer );
            break;
        
        case "LAYER_ADD":
            // readd the layer. no need to recreate data as new layers are blank
            let layer = createLayer( undoValue.layerIndex, undoValue.layer.name );
            setActiveLayer( undoValue.layerIndex );
            

            g_undoHistory.forEach((entry, index) => {
                s += `\nidx:${index}; id:${entry.id}`;
                if (entry.id == undoValue.id && index != g_undoHistory.length-1-g_undoPosition)
                {
                    s += `\n\tid change: ${entry.id} -> ${layer.id}`;
                    entry.id = layer.id;
                    entry.layer = layer;
                    entry.layerIndex = g_layers.indexOf( layer );
                }
            });

            undoValue.layer = layer;
            undoValue.id = layer.id;
            undoValue.layerIndex = g_layers.indexOf( layer );
            break;

        case "REORDER":
            uiLayerList.insertBefore(undoValue.layer.uiElement, uiLayerList.children[undoValue.new+1])
            array_move(g_layers, 
                undoValue.old,
                undoValue.new);
            break;
        
        default:
            console.error("ERROR: invalid undo type " + undoValue.type);
            break;
    }

    setCharacterIcon("nit_blink");
    g_charAnimation = setTimeout( () => { setCharacterIcon("nit1") }, 16.666666666*2 );
    drawBackbuffer();
    mainDraw();

    if (debug)
    {
        dbg_logUndoHistory();
        console.log(s);
    }
}

function pushUndoHistory(event)
{
    if (g_undoPosition > 0)
    {
        for( var i = 0; i < g_undoPosition; i++)
        {
            g_undoHistory.pop();
        }
        g_undoPosition = 0;
    }

    if (g_undoHistory.length >= g_undoMax)
    {
        g_undoHistory.shift();
    }

    Graphics.setRenderTarget( g_currentLayer.id );
    if (!event)
    {
        event = {
            type: "DRAW",
            layer: g_currentLayer,
            id: g_currentLayer.id,
            data: Graphics.getImageData(0,0,g_currentLayer.width, g_currentLayer.height)
        };
    }
    g_undoHistory.push(event);

    if (debug) 
        dbg_logUndoHistory();
}

function drawLine(start,end,brushSize,spacing)
{
    let dist = distance( start, end );
    spacing = 1;
    let step = Vec2( end.x - start.x, end.y - start.y )
                            .normalize()
                            .scale( spacing );
    let pos = Vec2(start.x, start.y);
    
    // stamp every N units along line
    // 0-255
    let brushDensity = 1;
    Graphics.setRenderTarget( g_currentLayer.id );


    for( var i = 0; i <= Math.floor(dist / spacing); i++)
    {
        //add to points stack
        Graphics.pushInstanceData( 
            Math.floor(pos.x - brushSize / 2), 
            Math.floor(pos.y - brushSize/2), 
            brushSize, 
            brushSize,
            new Color(
                g_currentColor.r,
                g_currentColor.g,
                g_currentColor.b,
                brushDensity
            )
        );
        
        pos.x += step.x;
        pos.y += step.y;
    }
    
    gl.blendFuncSeparate(gl.ONE, gl.ZERO, gl.ONE, gl.ONE);
    Graphics.setRenderTarget("temp");
    Graphics.clearRect(0,0,canvasWidth, canvasHeight);
    Graphics.drawInstanceRects();

    // brush opacity, CSP-style
    Graphics.globalAlpha = 1.0;
    gl.enable(gl.BLEND);
    Graphics.setRenderTarget( g_currentLayer.id );


    gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE);
    if (g_currentTool == TOOL.ERASER)
        gl.blendEquation(gl.FUNC_REVERSE_SUBTRACT);
    Graphics.drawImage("temp", 0, 0, canvasWidth, canvasHeight, 0, canvasHeight, canvasWidth, -canvasHeight);
    Graphics.globalAlpha = 1.0;

    gl.blendEquation( gl.FUNC_ADD ); 
    Graphics.setRenderTarget( null );

    let region = rect2box(start, end, brushSize);

    drawBackbuffer();
    
    /*
    if (debug)
        ctx_b.strokeRect(region.x, region.y, region.w, region.h);
    */
    //requestAnimationFrame(drawBackbuffer.bind(this, region));

    //g_layerctx.globalAlpha = 1;
}

// converts a (start, end) rect to a (x,y,w,h) rect.
function rect2box(start, end, padding=0)
{
    let region = { x: start.x < end.x ? start.x : end.x,
        y: start.y < end.y ? start.y : end.y,
        w: Math.abs(start.x - end.x),
        h: Math.abs(start.y - end.y) }

    region.x = Math.floor(region.x) - padding/2;
    region.y = Math.floor(region.y) - padding/2;
    region.w = Math.floor(region.w) + padding;
    region.h = Math.floor(region.h) + padding;

    return region;
}

function boxIntersect(x, y, xscl, yscl, dx, dy, dxscl, dyscl)
{
  return Math.abs((x + xscl / 2) - (dx + dxscl / 2)) * 2 < (xscl + dxscl) &&
    Math.abs((y + yscl / 2) - (dy + dyscl / 2)) * 2 < (yscl + dyscl);
}


function setColor(colorIndex, color)
{
    switch(colorIndex)
    {
        case 0:
            g_MainColor = color;
            mainPicker.style.backgroundColor = color.hex;
            break;
        case 1:
            g_SubColor = color;
            subPicker.style.backgroundColor = color.hex;
            break;
        default:
            break;
    }
}

function pseudo(seed, modulo) 
{
    str = `${(2**31-1&Math.imul(48271,seed))/2**31}`.split('').slice(-10).join('') % modulo;
    return str
}

// returns distance squared between two colors. could use a perceptual model later
function colorDistance(a, b)
{
    return Math.pow(b.r - a.r, 2) +
           Math.pow(b.g - a.g, 2) +
           Math.pow(b.b - a.b, 2);
}

function FFAnimation()
{
    //console.log("base")
    var i = 0;
    
    while(i <= bucketAnimation.iterationSkipAmt)
    {
        //console.log("process it")
        let canProcess = true;

        if (bucketAnimation.ops.length > 0)
        {
            //console.log("process op")
            let point = bucketAnimation.ops.shift();
            const check = function(x,y) { 
                var i = point.x+x >= 0 && point.x+x < g_currentLayer.width &&
                        point.y+y >= 0 && point.y+y < g_currentLayer.height;
                i = i && (bucketAnimation.filledPixels[point.x+x+(point.y+y)*g_currentLayer.width] < 1);
                //if (i) console.log(`adding! ${point.x+x},${point.y+y}!`)
                    return i;
             }
             const push = function(x,y) {
                if (Math.random() < 0.5)
                    bucketAnimation.ops.push( {x:point.x+x, y:point.y+y} );
                else 
                    bucketAnimation.ops.unshift( {x:point.x+x, y:point.y+y} );
                bucketAnimation.filledPixels[(point.x+x)+(point.y+y)*g_currentLayer.width] = 1;
             }

            //canProcess = check(0,0);

            let pixel = point.x*4 + point.y*g_currentLayer.width*4;

            if (canProcess)
            {         
                let currentColor = {r: bucketAnimation.data[ pixel ], 
                                    g: bucketAnimation.data[ pixel + 1 ], 
                                    b: bucketAnimation.data[ pixel + 2 ],
                                    a: bucketAnimation.data[ pixel + 3 ] };
        
                // todo: replace with a tolerance var
                if (colorDistance(bucketAnimation.srcColor, currentColor) > 10
                    || Math.abs(bucketAnimation.srcColor.a - currentColor.a) > 10)
                {
                    //console.log(`breaking; too high color dist @ ${point.x}, ${point.y}`)
                    canProcess = false;
                }

                if (canProcess)
                {
                    //console.log(`setting @ ${point.x}, ${point.y}`)
                    
                    bucketAnimation.filledPixels[point.x+point.y*g_currentLayer.width] = 1;

                    bucketAnimation.data[ pixel ] = bucketAnimation.replacementColor.r * 255;
                    bucketAnimation.data[pixel+1] = bucketAnimation.replacementColor.g * 255;
                    bucketAnimation.data[pixel+2] = bucketAnimation.replacementColor.b * 255;
                    bucketAnimation.data[pixel+3] = 255;
        
                    var j = bucketAnimation.ops.length;
                    if (check(-1,  0)) push( -1, 0 );
                    if (check( 1,  0)) push( 1, 0 );
                    if (check( 0, -1)) push( 0, -1 );
                    if (check( 0,  1)) push( 0, 1 );
                    //console.log( `delta: ${bucketAnimation.ops.length-j}` );
                }
            }
        }
        i++;
    }

    Graphics.setRenderTarget( g_currentLayer.id );
    Graphics.putImageData(bucketAnimation.imageData, 0, 0);
    
    drawBackbuffer();
    mainDraw();

    bucketAnimation.iterations = 0;
    bucketAnimation.iterationSkipAmt *= 1.3;
    
    if (bucketAnimation.ops.length > 0) 
        window.requestAnimationFrame(FFAnimation);
    else
    {
        pushUndoHistory();
        setCharacterIcon("nit1");
        bucketAnimation.active = false;
    }
}

// normal flood fill. only kept for reference
function executeFloodFill(x, y, color)
{
    // again; flip coords, flipped texture
    
    Graphics.setRenderTarget( g_currentLayer.id );
    x = Math.floor(x), y = Math.floor(g_currentLayer.height-y);
    bucketAnimation.active = true;
    bucketAnimation.filledPixels = new Uint8Array(g_currentLayer.width * g_currentLayer.height);
    bucketAnimation.imageData = Graphics.getImageData(0, 0, g_currentLayer.width, g_currentLayer.height);
    bucketAnimation.data =  bucketAnimation.imageData.data;
    bucketAnimation.iterations = 0;
    bucketAnimation.iterationSkipAmt = 1;

    let pixel = x*4 + y*g_currentLayer.width*4;
    bucketAnimation.srcColor = {
         r:  bucketAnimation.data[ pixel ],
         g:  bucketAnimation.data[ pixel + 1 ],
         b:  bucketAnimation.data[ pixel + 2],
         a:  bucketAnimation.data[ pixel + 3 ] };

    bucketAnimation.replacementColor = color;
    //console.log(`getting data @ ${x},${y}: ${JSON.stringify( bucketAnimation.srcColor)}`);
    //document.querySelector('#filltarget').style.backgroundColor = `rgba(${srcColor.r}, ${srcColor.g}, ${srcColor.b}, 255)`;

    bucketAnimation.ops = [ {x: x, y: y} ];

    FFAnimation();
}

function eyedrop(x,y, mouseIndex = 0)
{
    // texture is flipped in memory, flip sample pos
    x = Math.floor(x), y = Math.floor(g_currentLayer.height-y);

    let pixel = x*4 + y*g_currentLayer.width*4;
    Graphics.setRenderTarget( g_currentLayer.id ); 
    let data = Graphics.getImageData(0,0,g_currentLayer.width, g_currentLayer.height).data;
    let srcColor = new Color(
        data[ pixel ]/255,
        data[ pixel + 1 ]/255,
        data[ pixel + 2 ]/255,
        1
    );

    let index =  [ 0, 0, 1 ][ mouseIndex % 3 ];
    setColor(index, srcColor);

    colorPicker.setColor( srcColor );
    setCharacterIcon("nit_blink");
    g_charAnimation = setTimeout( () => { setCharacterIcon("nit1") }, 16.666666666*2 );
}

function drawStart(e)
{
    g_isDragging = false;
    let x = lastCoords.x, y = lastCoords.y, mouseIndex = 0;
    let pos = Vec2(x,y)

    if (g_currentTool == TOOL.ERASER)
    {
        g_currentColor = g_SubColor;
    }

    if (e)
    {
        e.preventDefault();
        
        x = e.clientX - canvas.offsetLeft;
        y = e.clientY - canvas.offsetTop;
        
        if (e.touches)
        {
            x = e.touches[0].clientX - canvas.offsetLeft;
            y = e.touches[0].clientY - canvas.offsetTop;
        }
    
        pos = Vec2(x,y).sub(g_viewTransform).scale( 1/g_viewScale );

        // mmb drag shorthand
        if (e.button != undefined)
        {
            switch (e.button)
            {
                case 0:
                    g_currentColor = g_currentTool != TOOL.ERASER ? g_MainColor : g_SubColor;
                break;
                
                case 1:
                    dragView(true);
                return;

                case 2:
                    g_currentColor = g_currentTool != TOOL.ERASER ? g_SubColor : g_MainColor;
                break;

                default:
                    g_currentColor = g_currentTool != TOOL.ERASER ? g_MainColor : g_SubColor;
                break;
            }
            mouseIndex = e.button;
        } 
        else g_currentColor = g_currentTool == TOOL.ERASER ? g_SubColor : g_MainColor;

        
        if (e.altKey)
        {
            eyedrop(pos.x, pos.y, mouseIndex);
            return;
        }
    }

    Graphics.drawColor = g_currentColor;

    let index = 1;
    if (lastCoords.y > canvas.height * 0.8)
        index = 1;
    else if (lastCoords.y > canvas.height * 0.4)
        index = 2;
    else
        index = 3;
    
    setCharacterIcon("nit_think" + index);

    switch (g_currentTool)
    {
        case TOOL.BUCKET:
            executeFloodFill(pos.x, pos.y, g_currentColor);
        break;
        
        case TOOL.EYEDROPPER:
            eyedrop(pos.x,pos.y, mouseIndex);
        break;

        case TOOL.TRANSFORM:
            // when you click with the transform tool, you have two options:
            // move a selection,
            // or make a new one.
            // you will make a new one if you click in a region that
            // does not contain a selection.
        let transform = g_tools[TOOL.TRANSFORM];
        let region = rect2box(
            transform.startPoint, 
            transform.endPoint
        );

        if (!boxIntersect(region.x, region.y, region.w, region.h,
            pos.x, pos.y, 1, 1
        ))
        {
            if (transform.copiedTexture)
            {
                // paste image on click-off
                Graphics.setRenderTarget( g_currentLayer.id );
                let region = rect2box(transform.startPoint, transform.endPoint);
                Graphics.drawImage( "temp-transform", 0, 0, region.w, region.h,
                    region.x, region.y, region.w, region.h, 0, true );
                pushUndoHistory();
                drawBackbuffer();
            }

            transform.startPoint = pos;
            transform.drawing = true;
            transform.copiedTexture = false;
        } else
        {
            transform.moving = true;

            if (!transform.copiedTexture)
            {
                let region = rect2box(transform.startPoint, transform.endPoint);
                Graphics.setRenderTarget( g_currentLayer.id );
                gl.bindTexture(gl.TEXTURE_2D, Graphics.textures["temp-transform"].texture);
                gl.texImage2D(
                    gl.TEXTURE_2D, 0, gl.RGBA, region.w, region.h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null
                )
                Graphics.textures["temp-transform"].width = region.w;
                Graphics.textures["temp-transform"].height = region.h;
                gl.copyTexSubImage2D(gl.TEXTURE_2D, 0, 0, 0, region.x, canvasHeight-region.h-region.y, region.w, region.h);
                Graphics.clearRect(region.x, canvasHeight-region.h-region.y, region.w, region.h);
                drawBackbuffer();
                transform.copiedTexture = true;
            }
        }
        break;

        case TOOL.BRUSH:
            if (e && e.pressure)
            {
                // smoothing; could use more samples
                g_BrushSize = 1 + Math.floor(
                    (g_BrushSize + e.pressure * g_tools[g_currentTool].size) / 2
                );
            }
        
        default:
            drawing = true;
            drawLine(lastCoords, pos, g_BrushSize, g_brushSpacing);
        break;
    }

    lastCoords = pos;
}

function drawMove(e)
{
    e.preventDefault();

    let x = e.clientX - canvas.offsetLeft;
    let y = e.clientY - canvas.offsetTop;

    if (e.touches)
    {
        x = e.touches[0].clientX - canvas.offsetLeft;
        y = e.touches[0].clientY - canvas.offsetTop;
    }

    lastCoords_raw = Vec2(x,y);

    let pos = Vec2(x,y).sub(g_viewTransform).scale( 1/g_viewScale );
    
    if (g_isDragging)
    {
        g_viewTransform = g_viewTransform.add( pos.sub(lastCoords).scale( g_viewScale ) );
        setCharacterIcon("nit_pull");
        mainDraw();
        //lastCoords = pos;
        return;
    }

    if (drawing)
    {
        let index = 3;
        if (lastCoords.y > canvas.height * 0.8)
            index = 3;
        else if (lastCoords.y > canvas.height * 0.4)
            index = 2;
        else
            index = 1;
        
        setCharacterIcon("nit_think" + index);

        if (g_currentTool == TOOL.BRUSH  && e && e.pressure)
        {
            g_BrushSize = 1 + Math.floor(
                (g_BrushSize + e.pressure * g_tools[g_currentTool].size) / 2
            );
        }
        
        drawLine(lastCoords, pos, g_BrushSize, g_brushSpacing);
    }

    let transform = g_tools[TOOL.TRANSFORM];
    if (transform.drawing)
    {
        transform.endPoint = pos;
    }

    if (transform.moving)
    {
        let delta = pos.sub(lastCoords);
        transform.startPoint = transform.startPoint.add( delta );
        transform.endPoint = transform.endPoint.add( delta );
    }

    mainDraw( { x: lastCoords.x, 
        y: lastCoords.y,
        w: Math.abs(lastCoords.x - x), 
        h: Math.abs(lastCoords.y - y) } );
        

    lastCoords = pos;
}

function drawEnd(e)
{
    let x = lastCoords.x, y = lastCoords.y;

    if (e)
    {
        e.preventDefault();

        x = e.clientX - canvas.offsetLeft;
        y = e.clientY - canvas.offsetTop;
    
        if (e.touches)
        {
            x = lastCoords.x,
            y = lastCoords.y;
        }

        if (e.button && e.button == 1)
        {
            dragView(false);
        }
    }

    let pos = Vec2(x,y)

    if (e && !e.touches) 
    {
        pos = pos.sub(g_viewTransform);
        pos = pos.scale( 1/g_viewScale );
    }

	if (drawing)
    {
        drawLine(lastCoords, pos, g_BrushSize, g_brushSpacing);
        pushUndoHistory();
    }

    drawing = false;
    
    if (!bucketAnimation.active)
        setCharacterIcon("nit1");

    let transform = g_tools[TOOL.TRANSFORM];
    if (transform.drawing)
    {
        transform.endPoint = pos;
        

        transform.startPoint.x = clamp(transform.startPoint.x, 0, canvasWidth);
        transform.startPoint.y = clamp(transform.startPoint.y, 0, canvasHeight);
        transform.endPoint.x = clamp(transform.endPoint.x, 0, canvasWidth);
        transform.endPoint.y = clamp(transform.endPoint.y, 0, canvasHeight);

        transform.drawing = false;
    }
    else if (transform.moving)
    {
        transform.moving = false; 
        // apply transformation
    }
    
    /*

    */

    mainDraw( { x: lastCoords.x, 
        y: lastCoords.y,
        w: Math.abs(lastCoords.x - x), 
        h: Math.abs(lastCoords.y - y) } );
}

function exportCopy(save)
{
    displayToast("exporting...");
    drawBackbuffer();
    Graphics.setRenderTarget( "backbuffer" );
    let data = Graphics.getImageData(0,0,canvasWidth,canvasHeight).data;
    tempCanvas.width = canvasWidth;
    tempCanvas.height = canvasHeight;

    let imgData = tempCtx.createImageData(canvasWidth, canvasHeight);
    
    const bytesPerPixel = 4; // Assuming RGBA format
    const rowSize = canvasWidth * bytesPerPixel;
    for (let row = 0; row < canvasHeight; row++) {
        const srcStart = row * rowSize;
        const dstStart = (canvasHeight - row - 1) * rowSize;

        // Copy the row to its flipped position
        imgData.data.set(data.subarray(srcStart, srcStart + rowSize), dstStart);
    }

    tempCtx.putImageData(imgData, 0,0);


    tempCanvas.toBlob((blob) => {
        if (save)
        {
            const a = document.createElement('a');
            let url = URL.createObjectURL(blob);
            a.href = url;
            a.download = "untitled";
            const clickHandler = () => {
                setTimeout(() => {
                    URL.revokeObjectURL(url);
                    removeEventListener('click', clickHandler);    
                }, 150);
            };

            a.addEventListener('click', clickHandler, false);
            a.click();
        }

        navigator.clipboard.write([
            new ClipboardItem({ "image/png": blob })
        ]);
    }, "image/png");
    displayToast(save ? "saved!" : "copied!");
}
/*
canvas.addEventListener("touchstart", e => { drawStart(e); })
canvas.addEventListener("touchmove", e => { drawMove(e); });
window.addEventListener("touchend", e => { drawEnd(e); });
canvas.addEventListener("touchcancel", e => drawEnd(e))
canvas.addEventListener("mousedown", e => drawStart(e));        
canvas.addEventListener("mousemove", e => drawMove(e) );
canvas.addEventListener("mouseup", e => { drawEnd(e) });
*/

canvas.addEventListener("pointerdown", e => { drawStart(e) });
window.addEventListener("pointermove", e => { window.requestAnimationFrame(drawMove.bind(this,e)) });
window.addEventListener("pointerup", e => { 
    drawEnd(e); 
    colorPicker.mouseDown = false; 
});

uiContainer.addEventListener("scroll", e=>{ e.preventDefault(); })

uiContainer.addEventListener( "wheel", e=> {
    e.preventDefault();

    if (e.shiftKey)
    {
        setBrushSize(Math.max(Math.min( g_BrushSize - Math.sign(e.deltaY) * 4, 1024), 1));
        return;
    }

    let scale = g_viewScale;

    g_viewScale = Math.max(Math.min( g_viewScale - Math.sign(e.deltaY) * 0.1, 4), 0.01);
    //g_viewTransform = g_viewTransform.sub( Vec2( 0, 0 ).scale( g_viewScale) );
    if (scale != g_viewScale)
        lastCoords = lastCoords_raw.sub( g_viewTransform ).scale( 1/g_viewScale );


    gl.imageSmoothingEnabled = g_viewScale < 1;
    
    mainDraw();
}, { passive: false });

canvas.addEventListener( "contextmenu", e=> {
    e.preventDefault();
    return false;
})

window.addEventListener('keydown', (key) =>
{
    const keyName = key.key.toUpperCase();

    if (!g_keyStates.has(keyName))
        g_keyStates.set(keyName, {state: false, lastState: false, downTimestamp: 0, upTimestamp: 0});
    
    let actionList = Object.keys(g_actionKeys);
    for( let i = 0; i < actionList.length; i++)
    {
        let action = g_actionKeys[actionList[i]];

        if ((!action.event || action.event == "down" || action.event == "press") &&
            action.key == keyName &&
            (action.altKey == key.altKey) &&
            (action.ctrlKey == key.ctrlKey) &&
            (action.shiftKey == key.shiftKey) &&
            (
                (action.event == "down" && Date.now() - g_keyStates.get(keyName).downTimestamp > 1000/60) ||
                (action.event == "press" && !keyDown(action.key))
            ))
        {
            let args = [];
            if (action.args)
                args = action.args;
            action.func(...args);
        }
    }
    
    key.preventDefault();
        
    if (!keyDown(keyName)) 
        g_keyStates.get(keyName).downTimestamp = Date.now();
    
    g_keyStates.get(keyName).state = true;

});

window.addEventListener('keyup', (key) =>
{
    key.preventDefault();
    const keyName = key.key.toUpperCase();
    
    if (!g_keyStates.has(keyName))
        g_keyStates.set(keyName, {state: true, lastState: false, downTimestamp: Date.now(), upTimestamp: 0});
    
    if (!g_keyStates.get(keyName).state) 
        g_keyStates.get(keyName).downTimestamp = Date.now();

    let actionList = Object.keys(g_actionKeys);
    for( let i = 0; i < actionList.length; i++)
    {
        let action = g_actionKeys[actionList[i]];

        if (action.event == "up" &&
            action.key == keyName &&
            action.altKey == key.altKey &&
            action.ctrlKey == key.ctrlKey &&
            action.shiftKey == key.shiftKey)
        {
            let args = [];
            if (action.args)
                args = action.args;
            action.func(...args);
        }
    }
    
    g_keyStates.get(keyName).upTimestamp = Date.now();
    g_keyStates.get(keyName).state = false;
});

addEventListener("resize", e => {
    rescaleViewCanvas();
})

colorPicker.canvas.addEventListener( "pointerdown", e => { 
    colorPicker.mouseDown = true;
    let x = (e.clientX - colorPicker.element.offsetLeft) / colorPicker.size;
    let y = (e.clientY - colorPicker.element.offsetTop) / colorPicker.size;

    let rgb = colorPicker.getColor(
        clamp01(x), 
        clamp01(y)
    );
    setColor(0, new Color(rgb[0], rgb[1], rgb[2]));
 } );

// todo: tie into reg drawing (global cursor)

window.addEventListener( "pointermove", e => {
    if (!colorPicker.mouseDown) 
        return;
    let x = (e.clientX - colorPicker.element.offsetLeft) / colorPicker.size;
    let y = (e.clientY - colorPicker.element.offsetTop) / colorPicker.size;

    let rgb = colorPicker.getColor(
        clamp01(x), 
        clamp01(y)
    );
    setColor(0, new Color(rgb[0], rgb[1], rgb[2]));
} )

//https://stackoverflow.com/questions/5306680/move-an-array-element-from-one-array-position-to-another
function array_move(arr, old_index, new_index) {
    while (old_index < 0) {
        old_index += arr.length;
    }
    while (new_index < 0) {
        new_index += arr.length;
    }
    if (new_index >= arr.length) {
        var k = new_index - arr.length + 1;
        while (k--) {
            arr.push(undefined);
        }
    }
    arr.splice(new_index, 0, arr.splice(old_index, 1)[0]);
    return arr; // for testing purposes
};