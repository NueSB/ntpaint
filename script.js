import { Color } from "./color.js";

"use strict";

var canvas = document.querySelector("#c"),
		ctx = canvas.getContext("2d"),
    backbuffer = document.createElement("canvas"),
    drawing = false,
    lastCoords = { x:-1, y:-1 },
    spacing = 3;

backbuffer.width = canvas.width;
backbuffer.height = canvas.height;
var mainPicker = document.createElement( "input" );
    mainPicker.type = "color";
    mainPicker.onchange = function() { setColor(0, -1) };
    document.body.appendChild(mainPicker);

var subPicker = document.createElement( "input" );
    subPicker.type = "color";
    subPicker.onchange = function() { setColor(1, -1) };
    document.body.appendChild(subPicker);

setColor(1, Color.white);

var ctx_b = backbuffer.getContext("2d");
ctx_b.clearRect(0,0,backbuffer.width, backbuffer.height);

    
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


function mainDraw()
{
    ctx.lineWidth = 1;
    ctx.clearRect(0,0, canvas.width, canvas.height);
    ctx.drawImage( backbuffer, 0, 0 );
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
        
    }
}

function setBrushSize( i )
{
    g_BrushSize = i;
    mainDraw();
}

function setTool(i)
{
    if (i == -1) 
        g_currentTool = (g_currentTool == 0 ? 1 : 0);
    else 
        g_currentTool = i;
}

{
    let tools = ["pencil", "bucket", "eyedropper"];
    for (let i = 0; i < tools.length; i++)
    {
        let button = document.createElement("button");
        let j = i;
        button.innerHTML = tools[i];
        button.onclick = function() { setTool( i ) };
        document.body.appendChild(button);
    }

    for (let i = 1; i < 256; i += i)
    {
        let button = document.createElement("button");
        let j = i;
        button.innerHTML = i;
        button.onclick = function() { setBrushSize( j ) };
        document.body.appendChild(button);
    }

    let button = document.createElement("button");
    button.innerHTML = "undo";
    button.onclick = function() { undo() };
    document.body.appendChild(button);

    button = document.createElement("button");
    button.innerHTML = "redo";
    button.onclick = function() { redo() };
    document.body.appendChild(button);
}

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
}
var g_undoHistory = [];
var g_undoMax = 255;
var g_undoPosition = 0;
var g_keyStates = new Map();
var g_actionKeys = {
    undo: {
        key: "Z",
        ctrlKey: true,
        shiftKey: false,
        altKey: false,
        func: undo
    },
    redo: {
        key: "Z",
        ctrlKey: true,
        shiftKey: true,
        altKey: false,
        func: redo
    },
    swap: {
        key: "X",
        ctrlKey: false,
        shiftKey: false,
        altKey: false,
        func: swapColors
    },
    brushket: {
        key: "B",
        ctrlKey: false,
        shiftKey: false,
        altKey: false,
        func: setTool,
        args: [-1]
    },
    eyedropper: {
        key: "K",
        ctrlKey: false,
        shiftKey: false,
        altKey: false,
        func: setTool,
        args: [2]
    }
}

ctx_b.fillStyle = "#FFFFFF";
ctx_b.fillRect(0, 0, backbuffer.width, backbuffer.height);
g_undoHistory.push( ctx_b.getImageData(0,0,backbuffer.width, backbuffer.height) );

/*
mainLoop();

function mainLoop()
{
    g_keyStates.forEach(key => {
        key.lastState = key.state;
    });

    setTimeout(mainLoop, 16);
}
*/

function swapColors()
{
    let tmp = g_MainColor;
    setColor(0, g_SubColor);
    setColor(1, tmp);
}

function undo()
{
    g_undoPosition += 1;
    if (g_undoPosition >= g_undoHistory.length)
    {
        g_undoPosition -= 1;
    }

    console.log(g_undoHistory.length, g_undoPosition );
    ctx_b.putImageData(g_undoHistory[ g_undoHistory.length - 1 - g_undoPosition ], 0, 0);
    mainDraw();
}

function redo()
{
    g_undoPosition -= 1;
    if (g_undoPosition < 0)
        g_undoPosition = 0;

    ctx_b.putImageData(g_undoHistory[ g_undoHistory.length - 1 - g_undoPosition ], 0, 0);
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

    if (g_undoHistory.length < g_undoMax)
    {
        g_undoHistory.push( ctx_b.getImageData(0,0,backbuffer.width, backbuffer.height) );
    }
}

function drawLine(start,end,brushSize,spacing)
{
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
                var i = point.x+x > 0 && point.x+x <= canvas.width &&
                        point.y+y > 0 && point.y+y <= canvas.height;
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
        //ctx_b.putImageData(bucketAnimation.imageData, 0, 0);

        //console.log(bucketAnimation.ops.length);

    //console.log(bucketAnimation.ops.length);
    ctx_b.putImageData(bucketAnimation.imageData, 0, 0);
    mainDraw();
    bucketAnimation.iterations = 0;
    bucketAnimation.iterationSkipAmt *= 1.3;
    
    if (bucketAnimation.ops.length > 0) 
        window.requestAnimationFrame(FFAnimation);
    else 
        pushUndoHistory();
}

// normal flood fill. only kept for reference
function executeFloodFill(x, y, color)
{
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
    console.log(`getting data @ ${x},${y}: ${JSON.stringify( bucketAnimation.srcColor)}`);
    //document.querySelector('#filltarget').style.backgroundColor = `rgba(${srcColor.r}, ${srcColor.g}, ${srcColor.b}, 255)`;


    bucketAnimation.ops = [ {x: x, y: y} ];

    FFAnimation();
}

function drawStart(e)
{
    e.preventDefault();

    if (e.button != undefined)
    {
        g_currentColor = [ g_MainColor, g_MainColor, g_SubColor ][ e.button % 3 ]
    } 
    else g_currentColor = g_MainColor;

    let x = e.clientX - canvas.offsetLeft;
    let y = e.clientY - canvas.offsetTop;

    if (e.touches)
    {
        x = e.touches[0].clientX - canvas.offsetLeft;
        y = e.touches[0].clientY - canvas.offsetTop;
    }

    ctx_b.fillStyle = g_currentColor.toString();
	
    lastCoords.x = x;
    lastCoords.y = y;

    switch (g_currentTool)
    {
        case 0:
            drawing = true;
            drawLine(lastCoords, Vec2(x, y), g_BrushSize, g_BrushSize/2);
        break;

        case 1:
            executeFloodFill(x, y, g_currentColor);
        break;
        
        case 2:
            let pixel = x*4 + y*backbuffer.width*4;
            let data = ctx_b.getImageData(0,0,backbuffer.width, backbuffer.height).data;

            let srcColor = new Color(
                data[ pixel ],
                data[ pixel + 1 ],
                data[ pixel + 2 ],
                255
            );
            console.log(pixel);
            console.log(data);
            console.log(srcColor);

            let index = (e.button != undefined) ? [ 0, 0, 1 ][ e.button % 3 ] : 0;
            setColor(index, srcColor);
        break;
    }
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
    
    if (drawing)
    {
        drawLine(lastCoords, Vec2(x, y), g_BrushSize, g_BrushSize/2);
    }
    lastCoords = Vec2(x, y);
    mainDraw();
}

function drawEnd(e)
{
    e.preventDefault();

    let x = e.clientX - canvas.offsetLeft;
    let y = e.clientY - canvas.offsetTop;

    if (e.touches)
    {
        // we just don't have the final coords on touch end, so stop immediately
        drawing = false;
    }

	if (drawing)
    {
        drawLine(lastCoords, Vec2(x, y), g_BrushSize, g_BrushSize/2);
        pushUndoHistory();
    }

    drawing = false;
    mainDraw();
}

canvas.addEventListener("touchstart", e => {

    drawStart(e);
})

canvas.addEventListener("touchmove", e => {

    drawMove(e); 
});

canvas.addEventListener("touchend", e => {

    drawEnd(e);
});

canvas.addEventListener("touchcancel", e => drawEnd(e))


canvas.addEventListener("mousedown", e => drawStart(e));

canvas.addEventListener("mousemove", e => drawMove(e) );

window.addEventListener("mouseup", e => { drawEnd(e) });

window.addEventListener( "wheel", e=>
{
    g_BrushSize = Math.max(Math.min( g_BrushSize - Math.sign(e.deltaY) * 4, 128), 1);
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
        g_keyStates.set(keyName, {state: true, lastState: false, downTimestamp: Date.now(), upTimestamp: 0});
    
    if (!g_keyStates.get(keyName).state) 
        g_keyStates.get(keyName).downTimestamp = Date.now();
    
    let actionList = Object.keys(g_actionKeys);
    for( let i = 0; i < actionList.length; i++)
    {
        let action = g_actionKeys[actionList[i]];

        if (action.key == keyName &&
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
    
    key.preventDefault();
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
    
    g_keyStates.get(keyName).upTimestamp = Date.now();
    g_keyStates.get(keyName).state = false;
});
    