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

class Layer {
    name = "X";
    width = 0;
    height = 0;
    opacity = 1;
    blendMode = 0;
    renderTarget = 0;
    id = 0;
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
    }

    resize(w, h)
    {

    }
}


function clamp(x,min,max)
{
    return Math.max( Math.min(x, max), min);
}

function clamp01(x)
{
    return Math.max( Math.min(x, 1), 0);
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
        Graphics.drawColor = new Color("#DDDDDD");
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
    let size = g_tools[g_currentTool].size;
    Graphics.lineRect( lastCoords.x - size / 2, lastCoords.y - size / 2, size, size );
    switch(g_currentTool)
    {
        case 0:
            break;
        case 1:
            break;
        case 2:
            break;
        case 3:
            break;
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
        g_currentTool = (g_currentTool == 0 ? 1 : 0);
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
    let layer = new Layer( !name ? "Layer " + (g_layers.length-1).toString() : name );
    g_layers.push( layer );
    console.log(index);
    if (index)
        array_move(g_layers, g_layers.length-1, index);
    
    uiLayerTemplate.style = "";
    let layerUI = uiLayerTemplate.cloneNode(true);
    var i = g_layers.length - 1;
    uiLayerTemplate.style.display = "none";

    layer.uiElement = layerUI; 

    if (pushUndo)
    {
        const event = {
            type: "LAYER_ADD",
            layer: layer,
            index: g_layers.indexOf( layer ),
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
    
    uiLayerList.appendChild(layerUI);
    if (index &&
        index < g_layers.length-1 &&
        index >= 0)
    {
        uiLayerList.insertBefore( layerUI, uiLayerList.children[index+1] );
    }
    
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
            layerIndex: g_layers.indexOf( g_currentLayer ),
            data: Graphics.getImageData(0,0,g_currentLayer.width, g_currentLayer.height)
        };

        pushUndoHistory(event);
    }
    
    uiLayerList.removeChild(layer.uiElement);
    Graphics.deleteRenderTarget(layer.id);
    g_layers.splice( g_layers.indexOf(layer), 1 );
    if (layer == g_currentLayer)
    {
        setActiveLayer(0);
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
var g_BrushSizePrev = 3;
var g_MainColor = new Color(0, 0, 0);
var g_SubColor = new Color(255, 255, 255);
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
var g_undoPosition = -1;
var g_keyStates = new Map();
var g_tools = [
    {
        name: "pcl",
        size: 16,
        opacity: 0.2,
    },
    {
        name: "bkt",
        size: 1,
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
        size: 16,
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
        args: [4]
    },
    bucket: {
        key: "G",
        ctrlKey: false,
        shiftKey: false,
        altKey: false,
        func: setTool,
        event: "press",
        args: [1]
    },
    eyedropper: {
        key: "K",
        ctrlKey: false,
        shiftKey: false,
        altKey: false,
        func: setTool,
        event: "press",
        args: [2]
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
        args: [3]
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
        key: "P",
        ctrlKey: false,
        shiftKey: false,
        altKey: false,
        event: "press",
        func: setTool,
        args: [0]
    }
}
var g_drawQueue = [];
var g_drawBlank = false; // draw "blanking period"; space between frames
var g_brushSpacing = 1;
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

{
    let debugcanvas = document.createElement("canvas");
    debugcanvas.height = canvasHeight;
    debugcanvas.width = canvasWidth;
    var ctx_dbg = debugcanvas.getContext("2d");
    let debug = false;


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
    
    rescaleViewCanvas();
    
    Graphics.createRenderTarget("backbuffer", canvasWidth, canvasHeight);

    setColor(0, Color.black);
    setColor(1, Color.white);
    setTool(0);

    main();
    displayToast("loaded!");
    

    for (var i = 0; i < 4; i++)
    {
        createLayer( undefined, ["top", "mid", "mid2", "bottom"][i] );
    }

    uiLayerAdd.addEventListener("click", e=>{ createLayer(undefined, undefined, true) } );    
    uiLayerRemove.addEventListener("click", e=>{ removeLayer(g_currentLayer, true) } );

    let sortable = new Sortable(uiLayerList, 
        {
            animation: 150,
            onUpdate: function(e)
            {
                console.log(e.oldDraggableIndex, e.newDraggableIndex);
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
        
    // FIXME: readpixels
    /*
    g_undoHistory.push( {
        layer: g_currentLayer, 
        data: g_layerctx.getImageData(0,0,g_currentLayer.width, g_currentLayer.height)
    } );
    */

    g_isLoaded = true;
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


function clearLayer()
{
    Graphics.setRenderTarget( g_currentLayer.id );
    Graphics.clearRect(0,0,g_currentLayer.width, g_currentLayer.height);
    Graphics.setRenderTarget( null );
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
                Graphics.textures["tempCanvas"].width = img.width;
                Graphics.textures["tempCanvas"].height = img.height;
                
                tempCtx.drawImage(img, 0, 0);
                
                gl.bindTexture( gl.TEXTURE_2D, Graphics.textures["tempCanvas"].texture );
                gl.texImage2D( gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, tempCanvas);
                
                Graphics.setRenderTarget( g_currentLayer.id );

                Graphics.drawImage( "tempCanvas", position.x, position.y);
                pushUndoHistory();
                drawBackbuffer();
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

function undo()
{
    console.log(g_undoPosition);
    // bounds check
    if (g_undoHistory.length == 0 || g_undoPosition > g_undoHistory.length-1)
        return;

    // choose to apply state based on current history value or previous.
    // 'at current' is the state you're in when you've redone so many times you're at
    // the front of the list.
    // in this state, you want to not calculate the init value and instead use the normal 
    // "one next to this one" undovalue.
    // we don't want to redo operations, so this is a special edgecase where the pointer is 'OOB'.
    // as a workaround, we pass a dummy init value
    let atCurrent = g_undoPosition == -1;

    let initState = atCurrent ? {type: "NULL"} : g_undoHistory[g_undoHistory.length - 1 - g_undoPosition];
    let initFlag = false;
    initFlag = (initState.type == "LAYER_ADD" || initState.type == "LAYER_REMOVE");

    // we skip an extra space if we're at the end of the queue. 
    // otherwise, an extra undo step is needed to get to the previous state
    // todo: look further into this, leaving alone as this breaks "check on this step" undo ops
    g_undoPosition += !initFlag ? 1 : 0;

    let undoValue;
    if (g_undoPosition <= g_undoHistory.length-1)
    {
        console.log(g_undoPosition);
        undoValue = g_undoHistory[ g_undoHistory.length - 1 - g_undoPosition ];
        console.log(undoValue);
    }    
    else
        undoValue = initState;

    // undo type is the event that was logged. the state to go back to
    // when you log an undo event, the thing logged is the Change that was made at that point in time.
    // undoing will remove that change
    
    // let's say you have a list like this
    // you draw a line, add a layer, switch to that layer and draw on that one too
    // your history will look like this:
    // DRAW -> LAYER_ADD -> DRAW (empty) -> DRAW
    // line -> remove L  -> blank canvas -> line 2
    
    switch(undoValue.type)
    {
        case "DRAW":
            setActiveLayer( undoValue.layer );
            Graphics.setRenderTarget( g_currentLayer.id );
            Graphics.putImageData(undoValue.data, 0, 0);
            break;
        
        case "LAYER_ADD":
            // remove the layer that was just added and go to the last selected layer
            removeLayer( undoValue.layer );
            break;
        
        case "LAYER_REMOVE":
            // add the layer that was removed in this event and switch to it
            let layer = createLayer( undoValue.layerIndex, undoValue.layer.name );
            setActiveLayer( undoValue.layerIndex );
            Graphics.setRenderTarget( layer.id );
            Graphics.putImageData(undoValue.data, 0, 0);

            // rebuild layer refs
            undoValue.layer = layer;
            undoValue.layerIndex = g_layers.indexOf( layer );

            break;
        
        default:
            console.error("ERROR: invalid undo type " + undoValue.type);
            break;
    }
    
    g_undoPosition += initFlag ? 1 : 0;

    setCharacterIcon("nit_blink");
    g_charAnimation = setTimeout( () => { setCharacterIcon("nit1") }, 16.666666666*2 );
    drawBackbuffer();
    mainDraw();
}

function redo()
{
    console.log(g_undoPosition);
    // bounds check
    if (g_undoHistory.length == 0 || g_undoPosition < 0)
        return;

    let atBeginning = g_undoPosition == g_undoHistory.length;

    let initState = atBeginning ? {type: "NULL"} : g_undoHistory[g_undoHistory.length - 1 - g_undoPosition];
    let initFlag = false;
    initFlag = (initState.type == "LAYER_ADD" || initState.type == "LAYER_REMOVE");
    
    g_undoPosition -= !initFlag ? 1 : 0;

    let undoValue;
    if (g_undoPosition >= 0)
        undoValue = g_undoHistory[ g_undoHistory.length - 1 - g_undoPosition ];
    else
        undoValue = initState;

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
            // readd the layer
            let layer = createLayer( undoValue.layerIndex, undoValue.layer.name );
            setActiveLayer( undoValue.layerIndex );

            undoValue.layer = layer;
            undoValue.layerIndex = g_layers.indexOf( layer );
            break;
        
        default:
            console.error("ERROR: invalid undo type " + undoValue.type);
            break;
    }

    g_undoPosition -= initFlag ? 1 : 0; 

    setCharacterIcon("nit_blink");
    g_charAnimation = setTimeout( () => { setCharacterIcon("nit1") }, 16.666666666*2 );
    drawBackbuffer();
    mainDraw();
}

function pushUndoHistory(event)
{
    if (g_undoPosition > 0)
    {
        for( var i = 0; i < g_undoPosition; i++)
        {
            g_undoHistory.pop();
        }
        g_undoPosition = -1;
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
            data: Graphics.getImageData(0,0,g_currentLayer.width, g_currentLayer.height)
        };
    }
    g_undoHistory.push(event);
    
    console.log(g_undoHistory);
}

function drawLine(start,end,brushSize,spacing)
{
    spacing  = 1/g_BrushSize * g_brushSpacing;
    let dist = distance( start, end );
    let step = Vec2( end.x - start.x, end.y - start.y )
                            .normalize()
                            .scale( spacing );
    let pos = Vec2(start.x, start.y);
    
    // stamp every N units along line
    //ctx_b.globalAlpha = 0.01;//g_tools[g_currentTool].opacity;
    
    /*
    if (g_currentTool == 3)
        g_layerctx.globalCompositeOperation = "destination-out";
    else
        g_layerctx.globalCompositeOperation = "source-over";
    */

    //g_layerctx.globalCompositeOperation = "source-over";

    Graphics.setRenderTarget( g_currentLayer.id );


    for( var i = 0; i <= Math.floor(dist / spacing); i++)
    {
        Graphics.pushInstanceData( 
            Math.floor(pos.x - brushSize / 2), 
            Math.floor(pos.y - brushSize/2), 
            brushSize, 
            brushSize,
            g_currentColor
        );
        
        pos.x += step.x;
        pos.y += step.y;
    }

    gl.enable(gl.BLEND);
    gl.blendEquation( g_currentTool == 3 ? gl.FUNC_REVERSE_SUBTRACT  : gl.FUNC_ADD); 
    gl.blendFunc( gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA );

    Graphics.drawInstanceRects();

    gl.blendEquation( gl.FUNC_ADD ); 
    Graphics.setRenderTarget( null );

    let region = { x: start.x < end.x ? start.x : end.x,
                   y: start.y < end.y ? start.y : end.y,
                   w: Math.abs(start.x - end.x),
                   h: Math.abs(start.y - end.y) }

    region.x = Math.floor(region.x) - brushSize/2;
    region.y = Math.floor(region.y) - brushSize/2;
    region.w = Math.floor(region.w) + brushSize;
    region.h = Math.floor(region.h) + brushSize;

    drawBackbuffer();

    /*
    if (debug)
        ctx_b.strokeRect(region.x, region.y, region.w, region.h);
    */
    //requestAnimationFrame(drawBackbuffer.bind(this, region));

    //g_layerctx.globalAlpha = 1;
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

                    bucketAnimation.data[ pixel ] = bucketAnimation.replacementColor.r;
                    bucketAnimation.data[pixel+1] = bucketAnimation.replacementColor.g;
                    bucketAnimation.data[pixel+2] = bucketAnimation.replacementColor.b;
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
    console.log(data);
    let srcColor = new Color(
        data[ pixel ],
        data[ pixel + 1 ],
        data[ pixel + 2 ],
        255
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

    if (g_currentTool == 3)
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
                    g_currentColor = g_currentTool != 3 ? g_MainColor : g_SubColor;
                break;
                
                case 1:
                    dragView(true);
                return;

                case 2:
                    g_currentColor = g_currentTool != 3 ? g_SubColor : g_MainColor;
                break;

                default:
                    g_currentColor = g_currentTool != 3 ? g_MainColor : g_SubColor;
                break;
            }
            mouseIndex = e.button;
        } 
        else g_currentColor = g_currentTool == 3 ? g_SubColor : g_MainColor;

        
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
        case 1:
            executeFloodFill(pos.x, pos.y, g_currentColor);
        break;
        
        case 2:
            eyedrop(pos.x,pos.y, mouseIndex);
        break;

        case 4:
        if (e && e.pressure)
        {
            // smoothing; could use more samples
            g_BrushSize = 1 + Math.floor(
                (g_BrushSize + e.pressure * g_tools[g_currentTool].size) / 2
            );
        }
        case 3:
            //g_currentLayer.globalCompositeOperation = "destination-out";

        default:
            drawing = true;
            
            // push a new undo state to revert to blank canvas
            if (isCanvasBlank( g_currentLayer.id ))
            {
                pushUndoHistory();
            }
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

        if (g_currentTool == 4  && e && e.pressure)
        {
            g_BrushSize = 1 + Math.floor(
                (g_BrushSize + e.pressure * g_tools[g_currentTool].size) / 2
            );
        }
        
        drawLine(lastCoords, pos, g_BrushSize, g_brushSpacing);
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
    console.log(data);
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
canvas.addEventListener("pointermove", e => { window.requestAnimationFrame(drawMove.bind(this,e)) });
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