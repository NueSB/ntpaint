import { Color } from "./color.js";

"use strict";

var canvas = document.querySelector("#c"),
		ctx = canvas.getContext("2d"),
    backbuffer = document.createElement("canvas"),
    drawing = false,
    lastCoords = { x:-1, y:-1 },
    uiContainer = document.querySelector(".drawcontainer"),
    uiBottomToolbar = document.querySelector(".ui-bottom-toolbar"),
    uiToolIcon = document.querySelector(".overlaytool"),
    uiCharacterIcon = document.querySelector("#overlaychar-img");

    backbuffer.width = 1024;
    backbuffer.height = 1024;

var mainPicker = document.createElement( "input" );
    mainPicker.type = "color";
    mainPicker.onchange = function() { setColor(0, -1) };
    uiBottomToolbar.appendChild(mainPicker);

var subPicker = document.createElement( "input" );
    subPicker.type = "color";
    subPicker.onchange = function() { setColor(1, -1) };
    uiBottomToolbar.appendChild(subPicker);

var ctx_b = backbuffer.getContext("2d");
ctx_b.clearRect(0,0,backbuffer.width, backbuffer.height);
ctx.fillText("loading gimme a sec", canvas.width/2-50, canvas.height/2);

rescaleViewCanvas();


setColor(1, Color.white);


    
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


let debugcanvas = document.createElement("canvas");
debugcanvas.height = backbuffer.height;
debugcanvas.width = backbuffer.width;
var ctx_dbg = debugcanvas.getContext("2d");
let debug = false;

// provide a custom region to clear if needed (cursor updates, etc)
function mainDraw(customClear)
{
    // framerate lock
    if ((customClear && customClear.force) ||
         Date.now() - g_lastDrawTimestamp < 1000 / FPS || !g_isLoaded)
    {
        return;
    }

    ctx.fillStyle = "#3A3A3A";
    ctx.fillRect(0,0,canvas.width, canvas.height);
    
    ctx.translate(g_viewTransform.x, g_viewTransform.y);
    ctx.scale( g_viewScale, g_viewScale );
    g_lastDrawTimestamp = Date.now();

    ctx.lineWidth = 1;

    if (!customClear || customClear.force)
    {
        ctx.clearRect(0,0, canvas.width, canvas.height);
        ctx.drawImage( backbuffer, 0, 0 );
    }
    else
    {
        ctx.clearRect(customClear.x, customClear.y, customClear.w, customClear.h);
        ctx.drawImage( backbuffer, 0, 0 );
    }


    if (debug)
    {
        ctx.clearRect(0,0, canvas.width, canvas.height);
        ctx.drawImage( backbuffer, 0, 0 );
    
        let size = 32;
        let j = 0;
        for(var i = g_undoHistory.length-1; i > Math.max(0, g_undoHistory.length - Math.floor(512/32)); i--)
        {
            ctx_dbg.putImageData(g_undoHistory[i], 0, 0);
            //ctx.fillRect(i * size + i, canvas.height - size, size, size);
            ctx.drawImage(debugcanvas, j * size + j, canvas.height - size, size, size);
            ctx.strokeStyle = (g_undoHistory.length - i) - 1 == g_undoPosition   ? "#00ff00" : "#ff0000";
            ctx.strokeRect(j * size + j, canvas.height - size, size, size);
            j++;
        }
    }
    
    ctx.strokeStyle = "#ff0000";
    ctx.strokeRect( lastCoords.x - g_BrushSize / 2, lastCoords.y - g_BrushSize / 2, g_BrushSize, g_BrushSize );
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
    ctx.scale( 1/g_viewScale, 1/g_viewScale );
    ctx.translate(-g_viewTransform.x, -g_viewTransform.y);
    
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
    if (g_currentTool <= 3 && g_currentTool >= 0)
        sprite = ["brush", "bucket", "eyedropper", "eraser"][g_currentTool];
    
    g_BrushSize = g_tools[ g_currentTool ].size;
    mainDraw( { x: lastCoords.x - g_BrushSize / 2, 
        y: lastCoords.y - g_BrushSize / 2,
        w: g_BrushSize, 
        h: g_BrushSize } );

    uiToolIcon.src = "images/"+sprite+".png"; 
}

{
    let tools = ["pencil", "bucket", "eyedropper", "eraser"];
    for (let i = 0; i < tools.length; i++)
    {
        let button = document.createElement("button");
        let j = i;
        button.innerHTML = tools[i];
        button.onclick = function() { setTool( i ) };
        uiBottomToolbar.appendChild(button);
    }

    for (let i = 1; i < 256; i += i)
    {
        let button = document.createElement("button");
        let j = i;
        button.innerHTML = i;
        button.onclick = function() { setBrushSize( j ) };
        uiBottomToolbar.appendChild(button);
    }

    let button = document.createElement("button");
    button.innerHTML = "undo";
    button.onclick = function() { undo() };
    uiBottomToolbar.appendChild(button);

    button = document.createElement("button");
    button.innerHTML = "redo";
    button.onclick = function() { redo() };
    uiBottomToolbar.appendChild(button);

    button = document.createElement("button");
    button.innerHTML = "clear";
    button.onclick = function() { clearLayer() };
    uiBottomToolbar.appendChild(button);
}

var g_viewTransform = Vec2(0,0);
var g_viewScale = 1.0;
var g_BrushSize = 2;
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
var g_undoPosition = 0;
var g_keyStates = new Map();
var g_tools = [
    {
        size: 3,
    },
    {
        size: 1,
    },
    {
        size: 1,
    },
    {
        size: 3,
    },
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
    brushket: {
        key: "B",
        ctrlKey: false,
        shiftKey: false,
        altKey: false,
        func: setTool,
        event: "press",
        args: [-1]
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
}
var g_drawQueue = [];
var g_lastDrawTimestamp = 0;
var g_brushSpacing = 1;
var g_isLoaded = false;
var g_isDragging = false;
var g_charAnimation = undefined;
var lastCoords_raw = Vec2(0,0);




Object.keys(g_actionKeys).forEach(action => {
    if (!g_keyStates.has(action.key))
        g_keyStates.set(action.key, {state: true, lastState: false, downTimestamp: Date.now(), upTimestamp: 0});
})

ctx_b.fillStyle = "#FFFFFF";
ctx_b.fillRect(0, 0, backbuffer.width, backbuffer.height);
g_undoHistory.push( ctx_b.getImageData(0,0,backbuffer.width, backbuffer.height) );

// https://stackoverflow.com/questions/6131051/is-it-possible-to-find-out-what-is-the-monitor-frame-rate-in-javascript
function calcFPS(a){function b(){if(f--)c(b);else{var e=3*Math.round(1E3*d/3/(performance.now()-g));"function"===typeof a.callback&&a.callback(e);console.log("Calculated: "+e+" frames per second")}}var c=window.requestAnimationFrame||window.webkitRequestAnimationFrame||window.mozRequestAnimationFrame;if(!c)return!0;a||(a={});var d=a.count||60,f=d,g=performance.now();b()}
var FPS = 0, err = calcFPS({count: 120, callback: fps => {
    FPS = fps; 
    g_isLoaded = true;
    ctx.drawImage(backbuffer, 0, 0)
}});

if (err)
{
    FPS = 30;
    g_isLoaded = true; 
    ctx.drawImage(backbuffer, 0, 0);
}
//
setInterval( calcFPS ({count: 120, callback: fps => {
    if (fps > FPS)
    {
        FPS = fps;
        console.log("higher fps detected, uprezzing -> " + fps)
    }
}}), 1000);

function rescaleViewCanvas()
{
    let style = window.getComputedStyle(canvas.parentNode);
    canvas.width = parseInt(style.width.slice(0, -2));
    canvas.height = parseInt(style.height.slice(0, -2));
    mainDraw( { force: true } );
}


function clearLayer()
{
    ctx_b.fillStyle = g_SubColor.hex;
    ctx_b.fillRect(0,0,backbuffer.width, backbuffer.height);
    pushUndoHistory();
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
                ctx_b.drawImage(img, position.x, position.y);
                pushUndoHistory();
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
    g_undoPosition += 1;
    if (g_undoPosition > g_undoHistory.length-1)
    {
        g_undoPosition = g_undoHistory.length-1;
    }

    ctx_b.putImageData(g_undoHistory[ g_undoHistory.length - 1 - g_undoPosition ], 0, 0);

    setCharacterIcon("nit_blink");
    g_charAnimation = setTimeout( () => { setCharacterIcon("nit1") }, 16.666666666*2 );
    mainDraw();
}

function redo()
{
    g_undoPosition -= 1;
    if (g_undoPosition < 0)
        g_undoPosition = 0;

    ctx_b.putImageData(g_undoHistory[ g_undoHistory.length - 1 - g_undoPosition ], 0, 0);

    setCharacterIcon("nit_blink");
    g_charAnimation = setTimeout( () => { setCharacterIcon("nit1") }, 16.666666666*2 );
    mainDraw();
}

function pushUndoHistory()
{
    if (g_undoPosition != 0)
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
    g_undoHistory.push( ctx_b.getImageData(0,0,backbuffer.width, backbuffer.height) );
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
    for( var i = 0; i <= Math.floor(dist / spacing); i++)
    {
        ctx_b.fillRect( Math.floor(pos.x - brushSize / 2), Math.floor(pos.y - brushSize/2), brushSize, brushSize );
        pos.x += step.x;
        pos.y += step.y;
    }
}

function setColor(colorIndex, color)
{
    switch(colorIndex)
    {
        case 0:
            if (color == -1)
            {
                color = new Color(mainPicker.value);
            }
            g_MainColor = color;
            mainPicker.value = color.hex;
            break;
        case 1:
            if (color == -1)
            {
                color = new Color(subPicker.value);
            }
            g_SubColor = color;
            subPicker.value = color.hex;
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
                var i = point.x+x >= 0 && point.x+x < canvas.width &&
                        point.y+y >= 0 && point.y+y < canvas.height;
                i = i && (bucketAnimation.filledPixels[point.x+x+(point.y+y)*canvas.width] < 1);
                //if (i) console.log(`adding! ${point.x+x},${point.y+y}!`)
                    return i;
             }
             const push = function(x,y) {
                if (Math.random() < 0.5)
                    bucketAnimation.ops.push( {x:point.x+x, y:point.y+y} );
                else 
                    bucketAnimation.ops.unshift( {x:point.x+x, y:point.y+y} );
                bucketAnimation.filledPixels[(point.x+x)+(point.y+y)*canvas.width] = 1;
             }

            //canProcess = check(0,0);

            let pixel = point.x*4 + point.y*canvas.width*4;

            if (canProcess)
            {         
                let currentColor = {r: bucketAnimation.data[ pixel ], 
                                    g: bucketAnimation.data[ pixel + 1 ], 
                                    b: bucketAnimation.data[ pixel + 2 ] };
        
                // todo: replace with a tolerance var
                if (colorDistance(bucketAnimation.srcColor, currentColor) > 10)
                {
                    //console.log(`breaking; too high color dist @ ${point.x}, ${point.y}`)
                    canProcess = false;
                }

                if (canProcess)
                {
                    //console.log(`setting @ ${point.x}, ${point.y}`)
                    
                    bucketAnimation.filledPixels[point.x+point.y*canvas.width] = 1;

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

    ctx_b.putImageData(bucketAnimation.imageData, 0, 0);
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
    bucketAnimation.active = true;
    bucketAnimation.filledPixels = new Uint8Array(backbuffer.width * backbuffer.height);
    bucketAnimation.imageData = ctx_b.getImageData(0, 0, backbuffer.width, backbuffer.height);
    bucketAnimation.data =  bucketAnimation.imageData.data;
    bucketAnimation.iterations = 0;
    bucketAnimation.iterationSkipAmt = 1;

    let pixel = x*4 + y*backbuffer.width*4;
    bucketAnimation.srcColor = {
         r:  bucketAnimation.data[ pixel ],
         g:  bucketAnimation.data[ pixel + 1 ],
         b:  bucketAnimation.data[ pixel + 2] };

    bucketAnimation.replacementColor = color;
    //console.log(`getting data @ ${x},${y}: ${JSON.stringify( bucketAnimation.srcColor)}`);
    //document.querySelector('#filltarget').style.backgroundColor = `rgba(${srcColor.r}, ${srcColor.g}, ${srcColor.b}, 255)`;

    bucketAnimation.ops = [ {x: x, y: y} ];

    FFAnimation();
}

function eyedrop(x,y, mouseIndex = 0)
{
    let pixel = x*4 + y*backbuffer.width*4;
    let data = ctx_b.getImageData(0,0,backbuffer.width, backbuffer.height).data;

    let srcColor = new Color(
        data[ pixel ],
        data[ pixel + 1 ],
        data[ pixel + 2 ],
        255
    );

    let index =  [ 0, 0, 1 ][ mouseIndex % 3 ];
    setColor(index, srcColor);
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

        // MMB shorthand eyedrop
        if (e.button != undefined)
        {
            switch (e.button)
            {
                case 0:
                    g_currentColor = g_currentTool != 3 ? g_MainColor : g_SubColor;
                break;
                
                case 1:
                    eyedrop(pos.x,pos.y, e.button);
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
            eyedrop(pos.x, pos.y, 0);
            return;
        }
    }

    ctx_b.fillStyle = g_currentColor.toString();

    setCharacterIcon("nit_think");

    switch (g_currentTool)
    {
        case 0:
            drawing = true;
            drawLine(lastCoords, pos, g_BrushSize, g_brushSpacing);
        break;

        case 1:
            executeFloodFill(pos.x, pos.y, g_currentColor);
        break;
        
        case 2:
            eyedrop(pos.x,pos.y, mouseIndex);
        break;

        case 3:
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
    backbuffer.toBlob((blob) => {
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

            return;
        }

        navigator.clipboard.write([
            new ClipboardItem({ "image/png": blob })
        ]);
    }, "image/png");
}

canvas.addEventListener("touchstart", e => { drawStart(e); })

canvas.addEventListener("touchmove", e => { drawMove(e); });

canvas.addEventListener("touchend", e => { drawEnd(e); });

canvas.addEventListener("touchcancel", e => drawEnd(e))

canvas.addEventListener("mousedown", e => drawStart(e));        

canvas.addEventListener("mousemove", e => drawMove(e) );

canvas.addEventListener("mouseup", e => { drawEnd(e) });

window.addEventListener("scroll", e=>{ e.preventDefault(); })

window.addEventListener( "wheel", e=> {
    e.preventDefault();

    if (e.shiftKey)
    {
        setBrushSize(Math.max(Math.min( g_BrushSize - Math.sign(e.deltaY) * 4, 128), 1));
        return;
    }

    let scale = g_viewScale;

    g_viewScale = Math.max(Math.min( g_viewScale - Math.sign(e.deltaY) * 0.1, 4), 0.01);
    //g_viewTransform = g_viewTransform.sub( Vec2( 0, 0 ).scale( g_viewScale) );
    if (scale != g_viewScale)
        lastCoords = lastCoords_raw.sub( g_viewTransform ).scale( 1/g_viewScale );

    
    mainDraw();
});

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
                (action.event == "down" && Date.now() - g_keyStates.get(keyName).downTimestamp > 1000/FPS) ||
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