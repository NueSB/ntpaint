import { Color } from "./lib/color.js";
import { Picker } from "./lib/picker.js";
import { Graphics, m4, m3 } from "./lib/graphics.js";

"use strict";

var canvas = document.querySelector("#c"),
	gl = canvas.getContext("webgl2"),
    drawing = false,
    lastCoords = { x:-1, y:-1 },
    uiContainer = document.querySelector(".drawcontainer"),
    uiColorContainer = document.querySelector(".colorcontainer"),
    uiBottomToolbar = document.querySelector(".ui-bottom-toolbar"),
    uiToolIcon = document.querySelector(".overlaytool img"),
    uiToast = document.querySelector(".toast"),
    uiCharacterIcon = document.querySelector("#overlaychar-img"),
    uiBrushToolbar = document.querySelector(".brush-toolbar"),
    uiLayerContainer = document.querySelector(".layercontainer"),
    uiLayerList = document.querySelector("#layerlist"),
    uiLayerTemplate = document.querySelector(".layer"),
    uiLayerOpacity = document.querySelector("#opacity-ctrl"),
    uiLayerAdd = document.querySelector("#add-layer"),
    uiLayerRemove = document.querySelector("#remove-layer"),
    uiBrushProps = document.querySelector("#brush-property-list"),
    uiBrushPropTemplate = document.querySelector(".brush-property"),
    uiBrushPreview = document.querySelector(".overlaytool canvas"),
    uiBrushPreviewCtx = uiBrushPreview.getContext("2d"),
    uiMenuProps = document.querySelector("#menu-property-list"),
    uiToolIconSpin = uiToolIcon.animate(
        [
            {transform: "rotateY(0deg)" },{transform: "rotateY(360deg)" }
        ],
        {
            duration: 1000,
            easing: "cubic-bezier(0,1.31,.76,1.02)"
        }
    );
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
    TRANSFORM: 5,
    LASSO: 6
};

const BRUSHPROPS = {
    SQUARE: 1,
    TEXTURED: 2,
    SOFT: 4,
}

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
    visible = true;

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

    setVisibility(s)
    {
        this.visible = s;

        this.uiElement.querySelector(".visibility-button").innerHTML = this.visible ? "o" : "-";
        if (this.visible)
        {
            this.uiElement.classList.remove("inactive")
        } else this.uiElement.classList.add("inactive");
        
        drawBackbuffer();
    }

    toggleVisibility()
    {
        this.visible = !this.visible;
        drawBackbuffer();
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

function chebyshev(a,b)
{
    return Math.max( Math.abs(b.y - a.y), Math.abs(b.x - a.x) );
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
        if (mag == 0)
        {
            return Vec2(0,0);
        }
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

    mainDraw();

    g_drawQueue = [];
    g_drawBlank = true;



    requestAnimationFrame(main);
}

// draws the combination of 2 layers together.
// args: graphics texture ids, alpha, blendmode

// 4 layer draw:
// layer 0 + layer 1 -> temp
// temp + layer 2 -> temp2
// temp2 + layer 3 -> temp

function drawLayer(layerTop, layerBottom, topalpha = 1, blendMode = 0)
{
    Graphics.setShader("layerOp");

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, Graphics.textures[layerTop].texture);
    gl.uniform1i(Graphics.currentShader.vars['layerTop'].location, 0);

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, Graphics.textures[layerBottom].texture);
    gl.uniform1i(Graphics.currentShader.vars['layerBottom'].location, 1);

    gl.uniform1f(Graphics.currentShader.vars["topAlpha"].location, topalpha);
    gl.uniform1i(Graphics.currentShader.vars["layerOperation"].location, blendMode);

    if (Graphics.textures["lut"])
    {
        gl.activeTexture(gl.TEXTURE2);
        gl.bindTexture(gl.TEXTURE_2D, Graphics.textures["lut"].texture);
        gl.uniform1i(Graphics.currentShader.vars["lut"].location, 2);   
    }
    let texmatrix = m3.translation(0, 0);
    texmatrix = m3.multiply(texmatrix, m3.scale(1, 1));
    gl.uniformMatrix3fv(Graphics.currentShader.vars['uTexMatrix'].location, false, texmatrix);
    gl.bindBuffer(gl.ARRAY_BUFFER, Graphics.posBuffer);

    Graphics.drawRect(0, 0, canvasWidth, canvasHeight, 0);
}

// draw to the texture that contains "normal" combined layers
function drawBackbuffer( region )
{
    gl.disable(gl.BLEND);

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
            if (!g_layers[i].visible)
                continue;
        
            // draw current layer image to temp layer tex,
            // then draw current line overtop that if drawing
            // (eraser needs to erase using that)
            Graphics.setRenderTarget("temp0");
            Graphics.clearRect(0,0,canvasWidth,canvasHeight);


            Graphics.setRenderTarget("temp-layer");
            Graphics.clearRect(0,0,canvasWidth,canvasHeight);
            Graphics.drawImage( g_layers[i].id.toString(), 0, 0, canvasWidth, canvasHeight, 0, 0, canvasWidth, canvasHeight, 0, false );
            if (bucketAnimation.active)
            {
                Graphics.setShader("floodFill");

                gl.activeTexture(gl.TEXTURE0);
                gl.bindTexture(gl.TEXTURE_2D, Graphics.textures[bucketAnimation.textureID].texture);

                let texmatrix = m3.translation(0, 0);
                texmatrix = m3.multiply(texmatrix, m3.scale(1, 1));
                gl.uniformMatrix3fv(Graphics.currentShader.vars['uTexMatrix'].location, false, texmatrix);
                gl.bindBuffer(gl.ARRAY_BUFFER, Graphics.posBuffer);
            
                Graphics.drawRect(0, 0, canvasWidth, canvasHeight, 0);
            }


            if (drawing && g_currentLayer.id == g_layers[i].id)
            {
                let toolOpacity = (g_tools[g_currentTool].opacity || 1);
                // if drawing,
                //    if erasing,
                //       draw current layer - erase line to temp-layer
                //    else
                //       draw current layer + temp line to temp-layer
                // then draw temp-layer + backbuffer to backbuffer
                //    draw temp layer + backbuffer to temp0, 
                //    then temp0 to backbuffer
                let blendMode = 0;

                if (g_currentTool == TOOL.ERASER)
                {
                    gl.enable(gl.BLEND);
                    gl.blendFuncSeparate(gl.ZERO, gl.ONE, gl.ONE, gl.ONE);
                    gl.blendEquation(gl.FUNC_REVERSE_SUBTRACT);
                    Graphics.globalAlpha = toolOpacity;
                    Graphics.drawImage("temp-line", 0, 0);
                    Graphics.globalAlpha = 1;
                    gl.disable(gl.BLEND);
                    
                }
                else
                {
                    Graphics.setRenderTarget("temp0");
                        drawLayer( "temp-line", "temp-layer", toolOpacity);

                    Graphics.setRenderTarget("temp-layer");
                        Graphics.drawImage("temp0", 0, 0);
                    
                }
            } 


            Graphics.setRenderTarget("temp0");
                drawLayer( "temp-layer", "backbuffer", g_layers[i].opacity);


            Graphics.setRenderTarget("backbuffer");
                Graphics.drawImage("temp0", 0, 0);
            
        }        
    }

    Graphics.setRenderTarget("backbuffer_pre");
    Graphics.drawImage("backbuffer", 0, 0);
    
    // post-processing
    Graphics.setRenderTarget("temp0");
    {
        Graphics.setShader("texture_dither");
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, Graphics.textures["backbuffer"].texture);
        gl.uniform1i(Graphics.currentShader.vars['uTexture'].location, 0);
        gl.uniform1f(Graphics.currentShader.vars["snapAmt"].location, 64.0 );

    
        let texmatrix = m3.translation(0, 0);
        texmatrix = m3.multiply(texmatrix, m3.scale(1, 1));
        gl.uniformMatrix3fv(Graphics.currentShader.vars['uTexMatrix'].location, false, texmatrix);
        gl.bindBuffer(gl.ARRAY_BUFFER, Graphics.posBuffer);

        Graphics.drawRect(0, 0, canvasWidth, canvasHeight, 0);
        
        Graphics.setRenderTarget("backbuffer");
            Graphics.drawImage("temp0", 0, 0);
    }

    Graphics.restore();
    Graphics.setRenderTarget(null);
}

function drawResizeHandles(region, handleSize, outline = false)
{
    let topleft = Vec2(region.x, region.y);
    let size = handleSize/g_viewScale;

    let flagExit = false;
    for(let i = 0; i < 3; i++)
    {
        for (let j = 0; j < 3; j++)
        {
            let str = i.toString() + j.toString();

            let offset = Vec2( [0, region.w/2, region.w][i],
                               [0, region.h/2, region.h][j]
                );
            let dist = chebyshev(lastCoords, topleft.add( offset ));
            if ( dist*dist < size*size)
            {
                flagExit = true;
                document.body.style.cursor = [
                    "nw","n","ne",
                    "w","auto","e",
                    "sw","s","se",
                ][i+j*3]+"-resize";
                //console.log(str);
                break;
            }
        }
        if (flagExit) break;
    }

    function centeredBox(x,y,size)
    {
        if (outline) 
            Graphics.fillRect(x - size / 2, y - size/2, size, size);
        else
            Graphics.lineRect(x - size / 2, y - size/2, size, size);
    }

    centeredBox(region.x, 
                region.y, 
                size);
    centeredBox(region.x + region.w / 2, 
                region.y, 
                size);
    centeredBox(region.x + region.w, 
                region.y,
                size);
    centeredBox(region.x, 
                region.y + region.h / 2, 
                size);
    centeredBox(region.x + region.w / 2,
                region.y + region.h, 
                size);
    centeredBox(region.x,
                region.y + region.h, 
                size);
    centeredBox(region.x + region.w, 
                region.y + region.h / 2, 
                size);
    centeredBox(region.x + region.w, 
                region.y + region.h, 
                size);
}

// provide a custom region to clear if needed (cursor updates, etc)*
// (inactive)
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

    document.body.style.cursor = "default";

    Graphics.setRenderTarget(null);

    Graphics.updateTextures();
    Graphics.drawColor = new Color("#3A3A3A");
    // BG (non canvas)
    Graphics.fillRect(0,0,canvas.width, canvas.height);
    
    Graphics.translate(g_viewTransform.x, g_viewTransform.y);
    Graphics.scale( g_viewScale, g_viewScale );

    let region = {x: 0, y: 0, w: canvas.width, h: canvas.height};

    
    // BG (canvas)
    Graphics.drawColor = new Color("#909999");
    Graphics.fillRect(0, 0, canvasWidth, canvasHeight);
    Graphics.drawColor = Color.white;
    Graphics.tintColor = Color.white;
    Graphics.save();
    Graphics.translate(0, canvasHeight)
    Graphics.scale(1, -1);
    Graphics.drawImage( "backbuffer", 0, 0);
    Graphics.restore();
   
    Graphics.drawColor = Color.red;
    let size = -1;
    if (g_tools[g_currentTool].size)
    {
        size = g_tools[g_currentTool].size;
        if (g_tools[g_currentTool].propFlags && g_tools[g_currentTool].propFlags & BRUSHPROPS.SQUARE)
             Graphics.lineRect( lastCoords.x - size / 2, lastCoords.y - size / 2, size, size );
        else 
            Graphics.lineCircle( lastCoords.x - size / 2, lastCoords.y - size / 2, size, size  );
    }

    switch(g_currentTool) // cursors, whenever that happens
    {
        default:
            break;
    }

    Graphics.drawColor = Color.black;

    let transform = g_tools[TOOL.TRANSFORM];
    let transformRegion = rect2box(transform.startPoint, 
        transform.endPoint,
    );

    if (transform.regionActive || transform.drawing)
    {
        Graphics.lineRect(transformRegion.x, transformRegion.y, transformRegion.w, transformRegion.h, 0);
        drawResizeHandles(transformRegion, transform.handleSize);

        if (transform.copiedTexture)
        {
            Graphics.drawImage( "temp-transform", 0, 0, transform.origSize.x, transform.origSize.y,
                transformRegion.x, transformRegion.y, transformRegion.w, transformRegion.h, 0, true );
        }
    } else 
    {
        document.body.style.cursor = "auto";
    }

    let canvasSizeHandles = 6;
    let alpha = chebyshev(lastCoords, Vec2(canvasWidth/2, canvasHeight/2)) / canvasWidth * 2 ;
    alpha = Math.min(alpha, 1);
    Graphics.drawColor = new Color(0,0,alpha);

    drawResizeHandles( 
        rect2box(
            g_canvasNewBounds.start.sub(Vec2(canvasSizeHandles/2,canvasSizeHandles/2)), 
            g_canvasNewBounds.end.add(Vec2(canvasSizeHandles, canvasSizeHandles))
        ),
        canvasSizeHandles,
        true
    );

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

    
    let tool = g_tools[g_currentTool];

    let sprite = "err";
    if (g_currentTool <= 6 && g_currentTool >= 0)
        sprite = ["pencil", "bucket", "eyedropper", "eraser", "brush", "transform", "lasso"][g_currentTool];

    uiBrushProps.textContent = "";
    if (tool.properties)
    {
        for (let j = 0; j < tool.properties.length; j++)
        {
            let prop = tool.properties[j];
            let propElement = uiBrushPropTemplate.cloneNode(true);
            propElement.style = "";
            let inputElement = propElement.querySelector("input");
            propElement.querySelector("#propname").innerHTML = prop.displayName;
            propElement.querySelector("input").addEventListener("input", e=>  { 
                prop.onChange(e); 
                window.requestAnimationFrame(updateBrushPreview);
            });
            // TODO: switch for input types (checkbox, range, etc)
            let value = 0;

            switch( prop.type )
            {
                case "dropdown":
                    // create dropdown list and disable input element
                    propElement = document.createElement("select");
                    propElement.addEventListener("change", e=> {
                        prop.onChange(e);
                        window.requestAnimationFrame(updateBrushPreview);
                    });
                    for (let x = 0; x < prop.values.length; x++)
                    {
                        let item = prop.values[x];
                        propElement.innerHTML += `<option value=${item.value}>${item.displayName}</option>`;
                    }
                    propElement.value = tool[ prop.name ];
                    break;

                case "range":
                    value = tool[prop.name]
                    * (prop.stop - prop.start) 
                    + prop.start;
                    inputElement.value = value;
                    break;

                case "checkbox":
                    value = prop.value;
                    propElement.querySelector("input").type = "checkbox";
                    inputElement.checked = value;
                    break;

                default:
                    console.error(`Unknown brush property type \'${prop.value}\'`)
                    continue;
            }

            uiBrushProps.appendChild(propElement);
        }
    }
    
    g_BrushSize = g_tools[ g_currentTool ].size;
    
    if (g_currentTool == TOOL.BRUSH) 
        g_BrushSize = 0;

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
    console.log(`create layer- index: ${index}; layer: ${layer}`);
    if (index)
        array_move(g_layers, 0, index);
    
    uiLayerTemplate.style = "";
    let layerUI = uiLayerTemplate.cloneNode(true);
    var i = g_layers.length - 1;
    uiLayerTemplate.style.display = "none";

    layer.uiElement = layerUI; 
    //layer.uiElement.querySelector(".layer-img").appendChild( layer.canvas );

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
    layerUI.querySelector(".visibility-button").onclick = (e) => {
        layer.toggleVisibility();

        pushUndoHistory({
            type: layer.visible ? "LAYER_SHOW" : "LAYER_HIDE",
            layerIndex: g_layers.indexOf(layer)
        });

        e.target.innerHTML = layer.visible ? "o" : "-";
        if (layer.visible)
        {
            layerUI.classList.remove("inactive")
        } else layerUI.classList.add("inactive");
        e.stopPropagation();
    };

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


var lastPt = null;
var lastLastPt = null;
var g_viewTransform = Vec2(512,512);
var g_isResizingCanvas = false;
var g_canvasResizeType = "move";
var g_canvasNewBounds = {start:Vec2(0,0), end:Vec2(canvasWidth, canvasHeight)};
var g_viewScale = 0.25;
var g_zoomLevel = 0;
var g_BrushSize = 3;
var g_MainColor = new Color(0, 0, 0);
var g_SubColor = new Color(1, 1, 1);
var g_currentColor = g_MainColor;
var g_currentTool = 0;
var g_currentLineDist = 0;
var g_textures = {
    /*
    "lut": {
        loaded: false,
        texture: null,
        imgElement: null,
        url: "images/lut.png"
    }
    */
};
var bucketAnimation = {
    srcColor: 0,
    replacementColor: 0,
    ops: 0,
    filledPixels: 0,
    data: 0,
    imageData: 0,
    iterations: 0,
    active: false,
    time: 0,
    lastTime: 0,
    maxTime: 500,
    textureID: "",
}
var g_animations = {
	uiBrushPropPopout: 0,
}
var g_undoHistory = [];
var g_undoMax = 128;
var g_undoPosition = 0;
var g_keyStates = new Map();
var g_tools = [
    {
        name: "pcl",
        size: 16,
        opacity: 1,
        density: 1,
        propFlags: 1,
        properties: [
            {
                name: "opacity",
                displayName: "opacity",
                type: "range",
                start: 0,
                stop: 100,
                onChange: function(e)
                {
                    this.parent.opacity = e.target.value / this.stop;
                }
            },
            {
                name: "density",
                displayName: "density",
                type: "range",
                start: 1,
                stop: 100,
                onChange: function(e)
                {
                    this.parent.density = Math.pow(e.target.value / this.stop, 3);
                }
            },
            {
                name: "square",
                displayName: "square",
                type: "checkbox",
                value: true,
                onChange: function(e)
                {
                    this.value = e.target.checked;
                    if (e.target.checked)
                        this.parent.propFlags = this.parent.propFlags | BRUSHPROPS.SQUARE;
                    else
                        this.parent.propFlags = this.parent.propFlags & ~BRUSHPROPS.SQUARE;
                }
            },
            {
                name: "soft",
                displayName: "soft",
                type: "checkbox",
                value: false,
                onChange: function(e)
                {
                    this.value = e.target.checked;
                    if (e.target.checked)
                        this.parent.propFlags = this.parent.propFlags | BRUSHPROPS.SOFT;
                    else
                        this.parent.propFlags = this.parent.propFlags & ~BRUSHPROPS.SOFT;
                }
            },
        ]

    },
    {
        name: "bkt",
        opacity: 1,
        tolerance: 10,
        sampleType: "layer",
        properties: [
            {
                name: "opacity",
                displayName: "opacity",
                type: "range",
                start: 0,
                stop: 100,
                onChange: function(e)
                {
                    this.parent.opacity = e.target.value / this.stop;
                }
            },

            {
                name: "sampleType",
                displayName: "sample type",
                type: "dropdown",
                values: [
                    {displayName: "sample layer", value: "layer"},
                    {displayName: "sample whole image", value: "image"},
                ],

                onChange: function(e)
                {
                    console.log(e.target.value);
                    this.parent.sampleType = e.target.value;
                }
            },
            
        ]
    },
    {
        name: "drp",
        size: 1,
        global: false,
        properties: [
            {
                name: "global",
                displayName: "sample whole image",
                type: "checkbox",
                value: false,
                onChange: function(e) { this.parent.global = e.target.checked; }
            },
        ]
    },
    {
        name: "ers",
        size: 16,
        opacity: 1,
        density: 1,
        propFlags: 0,
        properties: [
            {
                name: "opacity",
                displayName: "opacity",
                type: "range",
                start: 0,
                stop: 100,
                onChange: function(e)
                {
                    this.parent.opacity = e.target.value / this.stop;
                }
            },
            {
                name: "density",
                displayName: "density",
                type: "range",
                start: 1,
                stop: 100,
                onChange: function(e)
                {
                    this.parent.density = Math.pow(e.target.value / this.stop, 3);
                }
            },
            {
                name: "square",
                displayName: "square",
                type: "checkbox",
                value: false,
                onChange: function(e)
                {
                    this.value = e.target.checked;
                    if (e.target.checked)
                        this.parent.propFlags = this.parent.propFlags | BRUSHPROPS.SQUARE;
                    else
                        this.parent.propFlags = this.parent.propFlags & ~BRUSHPROPS.SQUARE;
                }
            },
            {
                name: "soft",
                displayName: "soft",
                type: "checkbox",
                value: false,
                onChange: function(e)
                {
                    this.value = e.target.checked;
                    if (e.target.checked)
                        this.parent.propFlags = this.parent.propFlags | BRUSHPROPS.SOFT;
                    else
                        this.parent.propFlags = this.parent.propFlags & ~BRUSHPROPS.SOFT;
                }
            },
        ]
    },
    {
        name: "brs",
        size: 16,
        soft: false,
        textured: false,
        texture: undefined,
        opacity: 1,
        density: 1,
        propFlags: 1,
        properties: [
            {
                name: "opacity",
                displayName: "opacity",
                type: "range",
                start: 0,
                stop: 100,
                onChange: function(e)
                {
                    this.parent.opacity = e.target.value / this.stop;
                }
            },
            {
                name: "density",
                displayName: "density",
                type: "range",
                start: 1,
                stop: 100,
                onChange: function(e)
                {
                    this.parent.density = Math.pow(e.target.value / this.stop, 3);
                }
            },
            {
                name: "square",
                displayName: "square",
                type: "checkbox",
                value: true,
                onChange: function(e)
                {
                    this.value = e.target.checked;
                    if (e.target.checked)
                        this.parent.propFlags = this.parent.propFlags | BRUSHPROPS.SQUARE;
                    else
                        this.parent.propFlags = this.parent.propFlags & ~BRUSHPROPS.SQUARE;
                }
            },
            {
                name: "soft",
                displayName: "soft",
                type: "checkbox",
                value: false,
                onChange: function(e)
                {
                    this.value = e.target.checked;
                    if (e.target.checked)
                        this.parent.propFlags = this.parent.propFlags | BRUSHPROPS.SOFT;
                    else
                        this.parent.propFlags = this.parent.propFlags & ~BRUSHPROPS.SOFT;
                }
            },
        ]
    },
    {
        name: "select",
        startPoint: Vec2(0,0),
        endPoint: Vec2(0,0),
        origSize: Vec2(0,0),
        movementType: "",
        handleSize: 9,
        drawing: false,
        copiedTexture: false,
    },
    {
        name: "lasso",
        points: [],
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
    copyAll: {
        key: "C",
        ctrlKey: true,
        shiftKey: true,
        altKey: false,
        event: "press",
        func: exportCopy,
        args: [true, false],
    },
    save: {
        key: "S",
        ctrlKey: true,
        shiftKey: false,
        altKey: false,
        event: "press",
        func: exportCopy,
        args: [true, true]
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
    },
    lasso: {
        key: "R",
        ctrlKey: false,
        shiftKey: false,
        altKey: false,
        event: "press",
        func: setTool,
        args: [TOOL.LASSO]
    },
    selectAll: {
        key: "A",
        ctrlKey: true,
        shiftKey: false,
        altKey: false,
        event: "press",
        func: function() { 
            setTool(TOOL.TRANSFORM);
            let transform = g_tools[TOOL.TRANSFORM];
            transform.regionActive = true;
            transform.startPoint = Vec2(0,0);
            transform.endPoint = Vec2(canvasWidth, canvasHeight);
            transform.origSize = Vec2(canvasWidth, canvasHeight);
            transform.drawing = false;
        },
    }
}
var g_drawQueue = [];
var g_drawBlank = false; // draw "blanking period"; space between frames
var g_brushSpacing = 2;
var g_BrushTrayVisible = false;
var g_MenuTrayVisible = false;
var g_menuCooldown = { // preventing one from instantly opening and closing the menu properties
    lastTimestamp: 0,
    cooldown: 100
};
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

function setup() {
    let debugcanvas = document.createElement("canvas");
    debugcanvas.height = canvasHeight;
    debugcanvas.width = canvasWidth;
    var ctx_dbg = debugcanvas.getContext("2d");

    /*
    let icon = document.createElement("img");
    icon.src = "images/placeholder.png";
    */
    for (let i = 0; i < g_tools.length; i++)
    {
        // provide a parent property to every brush adjustable property
        if (g_tools[i].properties)
        {
            for(let j = 0; j < g_tools[i].properties.length; j++)
            {
                g_tools[i].properties[j].parent = g_tools[i];
            }
        }

        let button = document.createElement("button");
        button.innerHTML += g_tools[i].name;
        //button.appendChild(icon.cloneNode());
        button.onclick = function() { setTool( i ) };
        uiBottomToolbar.appendChild(button);
    }

    for (let i = 1; i < 256; i += i)
    {
        let button = document.createElement("button");
        button.innerHTML += i.toString().padStart(3, "0");
        //button.appendChild(icon.cloneNode());
        button.onclick = function() { setBrushSize( i ) };
        uiBottomToolbar.appendChild(button);
    }

    let button = document.createElement("button");
    button.innerHTML = "undo";
    //button.appendChild(icon).cloneNode();
    button.onclick = function() { undo() };
    uiBottomToolbar.appendChild(button);

    button = document.createElement("button");
    button.innerHTML = "redo";
    //button.appendChild(icon.cloneNode());
    button.onclick = function() { redo() };
    uiBottomToolbar.appendChild(button);

    button = document.createElement("button");
    button.innerHTML = "clear";
    //button.appendChild(icon.cloneNode());
    button.onclick = function() { clearLayer() };
    uiBottomToolbar.appendChild(button);

    uiLayerOpacity.addEventListener("input", e=>
        {
            setLayerOpacity( -1, e.target.value );
        }
    );

    document.querySelector(".property-click-hitbox").addEventListener("click", (e) =>
    {
        if (debug) console.log("property click")
		if (!g_BrushTrayVisible)
		{
            if (debug) console.log("\tbrushtray not visible, swapping to tray mode...")
            document.querySelector(".menu-click-hitbox").style.pointerEvents = "none";
            document.querySelector(".property-click-hitbox").style.pointerEvents = "none";
			clearTimeout(g_animations.uiBrushPropPopout);
            clearTimeout(g_animations.uiBrushIconSwap);
            uiMenuProps.style.display = "none";
            uiBrushProps.style.display = "block";
            g_MenuTrayVisible = false;
	        g_BrushTrayVisible = true;
	        uiBrushToolbar.style.display = "block";
			uiBrushToolbar.style.opacity = 1;
			uiBrushToolbar.style.left = "66%";
            setCharacterIcon("nit_think1");
            uiToolIconSpin.cancel();
            uiToolIconSpin.play();
            g_animations.uiBrushIconSwap = setTimeout(()=>{ 
                if (debug) console.log("\t\t| brushpreview icon swap executed. icon display is now none");
                uiBrushPreview.style.display = g_currentTool == TOOL.BRUSH || g_currentTool == TOOL.PENCIL ? "block" : "none"; 
                uiToolIcon.style.display = "none"; 
            }, 150);
            updateBrushPreview();
            g_menuCooldown.lastTimestamp = Date.now();
		}
    });

    document.querySelector(".menu-click-hitbox").addEventListener("click", (e) =>
    {
        if (!g_MenuTrayVisible)
        {
            document.querySelector(".menu-click-hitbox").style.pointerEvents = "none";
            document.querySelector(".property-click-hitbox").style.pointerEvents = "none";
            clearTimeout(g_animations.uiBrushPropPopout);
            clearTimeout(g_animations.uiBrushIconSwap);
            uiMenuProps.style.display = "block";
            uiBrushProps.style.display = "none";
            g_MenuTrayVisible = true;
            g_BrushTrayVisible = false;
            uiBrushToolbar.style.display = "block";
            uiBrushToolbar.style.opacity = 1;
            uiBrushToolbar.style.left = "66%";
            setCharacterIcon("nit_think1");
            g_menuCooldown.lastTimestamp = Date.now();
        }
    });

    document.querySelector(".brush-toolbar").addEventListener("mouseleave", (e) =>
    {
        if (Date.now() - g_menuCooldown.cooldown <= g_menuCooldown.lastTimestamp)
            return;

        console.log("pointer out brushtoolbar");
        if (g_BrushTrayVisible)
        {
            if (debug) console.log("\tbrush tray is visible, starting interval to swap icons");
            uiToolIconSpin.cancel();
            uiToolIconSpin.play();
            g_animations.uiBrushIconSwap = setTimeout(()=>{ 
                if (debug) console.log("\t\t| swapping ui icons. tool icon is now visible"); 
                uiBrushPreview.style.display = "none"; 
                uiToolIcon.style.display = "block"; 
            }, 150);
        }
        document.querySelector(".menu-click-hitbox").style.pointerEvents = "auto";
        document.querySelector(".property-click-hitbox").style.pointerEvents = "auto";
        g_BrushTrayVisible = false;
        g_MenuTrayVisible = false;
        g_animations.uiBrushPropPopout = setTimeout(()=> { 
            if (debug) console.log("\t\t| brush properties now hidden");
            uiBrushToolbar.style.display = "none";
        }, 50 );
        uiBrushToolbar.style.opacity = 0;
        uiBrushToolbar.style.left = "70%";
        setCharacterIcon("nit1");
    });

    function addHoverScale(selector, uiElement)
    {
        document.querySelector(selector).addEventListener("pointerover", (e) =>
        {
            uiElement.style.transform = "scale(0.9,0.9)";
        });
    
        document.querySelector(selector).addEventListener("pointerleave", (e) =>
        {
            uiElement.style.transform = "";
        });
    }
    
    addHoverScale(".property-click-hitbox", uiToolIcon);
    addHoverScale(".menu-click-hitbox", uiCharacterIcon);
    
    document.querySelector(".property-click-hitbox").addEventListener("pointerover", (e) =>
    {
        uiToolIcon.style.transform = "scale(0.9,0.9)";
    });

    document.querySelector(".property-click-hitbox").addEventListener("pointerleave", (e) =>
    {
        uiToolIcon.style.transform = "";
    });

    Graphics.setup( gl );

    Graphics.createRenderTarget( "temp0", canvasWidth, canvasHeight );
    Graphics.createRenderTarget( "temp1", canvasWidth, canvasHeight );
    // misc texture. use for many things! primarily line drawing
    Graphics.createRenderTarget( "temp-line", canvasWidth, canvasHeight );
    Graphics.createRenderTarget( "temp-layer", canvasWidth, canvasHeight );
    Graphics.textures["temp-transform"] = {
        width: 2,
        height: 2,
        texture: Graphics.createGLTexture(2,2)
    };

    rescaleViewCanvas();
    
    Graphics.createRenderTarget("backbuffer", canvasWidth, canvasHeight);
    Graphics.createRenderTarget("backbuffer_pre", canvasWidth, canvasHeight);
    Graphics.createRenderTarget("brushPreview", 512, 512);
    

    for (var i = 0; i < 1; i++)
    {
        createLayer( undefined, "Layer " + (i+1) );
    }

    uiLayerAdd.addEventListener("click", e=>{ createLayer(undefined, undefined, true) } );    
    uiLayerRemove.addEventListener("click", e=>{ removeLayer(g_currentLayer, true) } );
    
    let sortable = new Sortable(uiLayerList, 
        {
            supportPointer: false, // this may need to be an option
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

    setCanvasSize(Vec2(1024,1024));
    g_zoomLevel = 22;
    g_viewScale = 0.7;
    g_viewTransform = Vec2(512,512).add(Vec2(-356,-256));

    for(let i = 0; i < Object.keys(g_textures).length; i++)
    {
        let id = Object.keys(g_textures)[i];
        let textureObj = g_textures[id];

        Graphics.loadTexture(textureObj.url, id);
    }


    if (debug)
    {
        /* sample "line draw" */
        Graphics.setRenderTarget("temp-line");

        let cScale = 280;
        let offset = 360;
        let circleMesh = new Float32Array(16*2);
        
        drawLine(
            Vec2(0,0).scale(cScale).add(Vec2(offset,offset/2)),
            Vec2(1,0).scale(cScale).add(Vec2(offset,offset/2)),
            3,
            1
        );

        drawLine(
            Vec2(1,0).scale(cScale).add(Vec2(offset,offset/2)),
            Vec2(1,1).scale(cScale).add(Vec2(offset,offset/2)),
            3,
            1
        );

        drawLine(
            Vec2(1,1).scale(cScale).add(Vec2(offset,offset/2)),
            Vec2(0,1).scale(cScale).add(Vec2(offset,offset/2)),
            3,
            1
        );

        drawLine(
            Vec2(0,1).scale(cScale).add(Vec2(offset,offset/2)),
            Vec2(0,0).scale(cScale).add(Vec2(offset,offset/2)),
            3,
            1
        );


        Graphics.setRenderTarget("temp0");
        {
            Graphics.clearRect(0,0,canvasWidth, canvasHeight);
            drawLayer( "temp-line", g_currentLayer.id, (g_tools[g_currentTool].opacity || 1));
        }

        dbg_JFA();
    };
}

setup();


function dbg_JFA()
{
    Graphics.setRenderTarget( "temp1" );
    {
        Graphics.setShader("JFA_INIT");
        {
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, Graphics.renderTargets[g_currentLayer.id].texture.texture);

            let texmatrix = m3.translation(0, 0);
            texmatrix = m3.multiply(texmatrix, m3.scale(1, 1));
            gl.uniformMatrix3fv(Graphics.currentShader.vars['uTexMatrix'].location, false, texmatrix);
            gl.bindBuffer(gl.ARRAY_BUFFER, Graphics.posBuffer);
        
            Graphics.drawRect(0, 0, canvasWidth, canvasHeight, 0);
        }

        Graphics.setRenderTarget("temp0")
        {
            Graphics.drawImage("temp1", 0, 0, );
        }
        
        //let i = 4;
        for(let i = 9; i >= 1; i--)
        {
            Graphics.setRenderTarget("temp1");
            Graphics.setShader("JFA_PASS");
            {
                gl.activeTexture(gl.TEXTURE0);
                gl.bindTexture(gl.TEXTURE_2D, Graphics.renderTargets["temp0"].texture.texture);
                gl.uniform1i(Graphics.currentShader.vars["spacing"].location, Math.pow(2,i));
                let texmatrix = m3.translation(0, 0);
                texmatrix = m3.multiply(texmatrix, m3.scale(1, -1));
                gl.uniformMatrix3fv(Graphics.currentShader.vars['uTexMatrix'].location, false, texmatrix);
                gl.bindBuffer(gl.ARRAY_BUFFER, Graphics.posBuffer);
            
                Graphics.drawRect(0, 0, canvasWidth, canvasHeight, 0);
            }

        
            Graphics.setShader("texture");
            gl.uniform1i( Graphics.currentShader.vars["overwriteAlpha"].location, 1 );
            // recopy image to written texture
            Graphics.setRenderTarget("temp0")
            {
                Graphics.drawImage("temp1", 0, 0, canvasWidth, canvasHeight, 0, 0, canvasWidth, canvasHeight, 1, false);
            }
        }

        Graphics.setRenderTarget("temp1");
        Graphics.setShader("JFA_OUTLINE");
        gl.bindTexture(gl.TEXTURE_2D, Graphics.renderTargets["temp0"].texture.texture);
        let texmatrix = m3.translation(0, 0);
        texmatrix = m3.multiply(texmatrix, m3.scale(1, 1));
        gl.uniformMatrix3fv(Graphics.currentShader.vars['uTexMatrix'].location, false, texmatrix);
        gl.bindBuffer(gl.ARRAY_BUFFER, Graphics.posBuffer);
    
        Graphics.drawRect(0, 0, canvasWidth, canvasHeight, 0);
        
        Graphics.setShader("texture");
        gl.uniform1i( Graphics.currentShader.vars["overwriteAlpha"].location, 0 );
        
        Graphics.setRenderTarget(g_currentLayer.id, 0, 0);
        Graphics.drawImage("temp1", 0, 0, canvasWidth, canvasHeight, 0, 0, canvasWidth, canvasHeight, 1, true);
    }

    drawBackbuffer();
}

function displayToast(message)
{
    uiToast.style.transitionDuration = '0s';
    uiToast.style.opacity = 1;

    uiToast.innerHTML = message;

    uiToast.offsetHeight; // force css change so the property is changed

    uiToast.style.transitionDuration = '';
    uiToast.style.opacity = 0;
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
    console.log(g_currentLayer.width);
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

function updateBrushPreview()
{
    Graphics.setRenderTarget( "brushPreview" );
    let brushSize = 16;
    let start = Vec2(128+brushSize,256);
    let end = Vec2(256+128-brushSize, 256);
    
    gl.disable(gl.BLEND);
    let dist = distance( start, end );
    let spacing = 1;
    let step = Vec2( end.x - start.x, end.y - start.y )
                            .normalize()
                            .scale( spacing );
    let pos = Vec2(start.x, start.y);

    // stamp every N units along line
    // 0-1
    let brushDensity = g_tools[g_currentTool].density || 1;

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    for( var i = 0; i <= Math.floor(dist / spacing); i++)
    {
        let factor = i / (Math.floor(dist/spacing))
        //add to points stack
        Graphics.pushInstanceData( 
            Math.floor(pos.x - brushSize/2), 
            Math.floor(pos.y - brushSize/2) + Math.sin(2 * factor * Math.PI) * 64, 
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
    };

    Graphics.drawInstanceRects();
    Graphics.globalAlpha = 1;
    gl.disable(gl.BLEND);
    let data = Graphics.getImageData(0,0,512,512).data;

    let imgData = uiBrushPreviewCtx.createImageData(512, 512);

    imgData.data.set(data)
    uiBrushPreviewCtx.putImageData(imgData, 0,0);
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
                transform.regionActive = true;
                transform.drawing = false;
                transform.origSize = Vec2(img.width, img.height);
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
        console.log(`${i == g_undoHistory.length-1-g_undoPosition ? "->\t":"\t"} ${i}: ${ undoValue.type }; ${undoValue.id ? "ID = "+undoValue.id : undoValue.layerIndex ? "LAYER_INDEX = "+undoValue.layerIndex : ""}`);
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
            // if we're drawing directly after a canvas resize, we need to clear the entire canvas and then repaste the image data
            // since it doesn't cover the entire new area
            let foundEntry = false;
            for(var i = g_undoPosition+1; i < g_undoHistory.length; i++)
            {
                let entry = g_undoHistory[g_undoHistory.length - 1 - i];
                if (
                    ((entry.id == undoValue.id) && (entry.type == "DRAW" || entry.type == "LAYER_ADD")) ||
                    (entry.type == "CANVAS_RESIZE")
                )
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
                if (undoValue.type == "CANVAS_RESIZE")
                {
                    clearLayer(false);
                    let layerIndex = g_layers.indexOf(g_currentLayer);

                    Graphics.setRenderTarget(g_currentLayer.id);
                    Graphics.putImageData(undoValue.data[layerIndex], 0, 0);
                }
                else
                    Graphics.putImageData(undoValue.data, 0, 0);
            break;

        case "LAYER_HIDE":
            g_layers[undoValue.layerIndex].setVisibility(true);
            break;
        
        case "LAYER_SHOW":
            g_layers[undoValue.layerIndex].setVisibility(false);
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

        case "CANVAS_RESIZE":
            setCanvasSize(undoValue.oldSize, undoValue.offset);
            if (undoValue.data != null)
            {
                for(let i = 0; i < g_layers.length; i++)
                {
                    Graphics.setRenderTarget(g_layers[i].id);
                    Graphics.putImageData(undoValue.data[i], 0, 0);
                }
            }
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

        case "LAYER_HIDE":
            g_layers[undoValue.layerIndex].setVisibility(false);
            break;
        
        case "LAYER_SHOW":
            g_layers[undoValue.layerIndex].setVisibility(true);
            break;

        case "REORDER":
            uiLayerList.insertBefore(undoValue.layer.uiElement, uiLayerList.children[undoValue.new+1])
            array_move(g_layers, 
                undoValue.old,
                undoValue.new);
            break;

        case "CANVAS_RESIZE":
            setCanvasSize(undoValue.newSize, undoValue.offset);
            if (undoValue.data)
            {
                for(let i = 0; i < g_layers.length; i++)
                {
                    Graphics.setRenderTarget(g_layers[i].id);
                    Graphics.putImageData(undoValue.data[i], 0, 0);
                }
            }
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
    gl.disable(gl.BLEND);
    let dist = distance( start, end );
    spacing = g_tools[g_currentTool].propFlags & BRUSHPROPS.SOFT ? 1 : 1;
    let step = Vec2( end.x - start.x, end.y - start.y )
                            .normalize()
                            .scale( spacing );
    let pos = Vec2(start.x, start.y);
    
    // pixel perfect alg; pixels to clear when done drawing
    let erasurePositions = [];

    // stamp every N units along line
    // 0-1
    let brushDensity = g_tools[g_currentTool].density || 1;

    Graphics.globalAlpha = 1;

    Graphics.setShader("baseColor_batch");
    gl.uniform1i(Graphics.currentShader.vars["properties"].location, g_tools[g_currentTool].propFlags || 0);

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    
    for( var i = 0; i <= Math.floor(dist / spacing); i++)
    {

        if (brushSize == 1)
        {
            let current = Vec2(
                Math.floor(pos.x - brushSize/2), 
                Math.floor(pos.y - brushSize/2));
                
            if (!lastPt)
                lastPt = Vec2(current.x, current.y);
        
            if (current.x != lastPt.x || current.y != lastPt.y)
            {
                if (lastLastPt)
                {
                    //console.log(lastLastPt.x, lastLastPt.y, "|", lastPt.x, lastPt.y, "|", current.x, current.y);
                    
                    if (
                        (
                            lastPt.x == current.x
                            && lastPt.y == lastLastPt.y
                            && lastPt.x != lastLastPt.x
                        ) ||
                        (
                            lastPt.y == current.y
                            && lastPt.x == lastLastPt.x
                            && lastPt.y != lastLastPt.y
                        )
                    )
                    {
                        erasurePositions.push( [lastPt.x, lastPt.y] );

                        lastPt = Vec2(current.x, current.y);
                        lastLastPt = Vec2(lastPt.x, lastPt.y);

                    }
                }
                lastLastPt = Vec2(lastPt.x, lastPt.y);
                lastPt = Vec2(current.x, current.y);
            }
        }


        //add to points stack
        Graphics.pushInstanceData( 
            Math.floor(pos.x - brushSize/2), 
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

    Graphics.setRenderTarget("temp-line");
    {
        gl.blendEquation(gl.FUNC_ADD);
        gl.blendFuncSeparate(gl.ONE, gl.ZERO, gl.ONE, gl.ONE);
        
        //Graphics.clearRect(0,0,canvasWidth, canvasHeight);
        Graphics.drawInstanceRects();
        
        gl.disable(gl.BLEND);
        // the problem: 
        // drawing directly to the canvas in the drawline method means we cannot make adjustments to the
        // line before committing it.
        // the solution:
        // draw to the temp image, then draw it to screen when DONE drawing (in drawend).
        // in order for this to show correctly, the drawbackbuffer method will need to be slightly
        // reworked to draw the temp image if drawing,
        // and draw the [temp image + current layer, not committing?] in place of the current layer if so.

        if (brushSize == 1)
        {
            for (var i = 0; i < erasurePositions.length; i++)
            {
                Graphics.pushInstanceData( 
                    erasurePositions[i][0],
                    erasurePositions[i][1],
                    1, 
                    1,
                    new Color(
                        0,1,0,0
                    )
                );
            }
            //gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE);
            Graphics.drawInstanceRects();
            gl.enable(gl.BLEND);
        }
    }

    Graphics.setRenderTarget(null);

    drawBackbuffer();
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

function FFAnimation(timestamp)
{
    if (!bucketAnimation.active)
        return;

    if (bucketAnimation.lastTime == 0)
    {
        bucketAnimation.lastTime = timestamp;
    } else
    {
        bucketAnimation.time += (timestamp - bucketAnimation.lastTime);
        bucketAnimation.lastTime = timestamp;
    }


    function ease(x) {
        return 1 - Math.pow(1-x, 5);
    }

    Graphics.setShader("floodFill");
    gl.uniform1f(Graphics.currentShader.vars['factor'].location, ease(bucketAnimation.time / bucketAnimation.maxTime));

    // execute func outputs a distance texture and should provide a max value to the shader
    // shader inputs:
    // distance texture
    // time value
    // max dist (could be kept on CPU side) 

    // we need to draw the currently being filled layer over the main layer
    // so, inside the drawBackbuffer function
    // then apply the changes when the animation is finished

    drawBackbuffer();
    mainDraw();

    if (bucketAnimation.time < bucketAnimation.maxTime) 
        window.requestAnimationFrame(FFAnimation);
    else
    {   
        Graphics.setRenderTarget( g_currentLayer.id );
        Graphics.setShader("floodFill");

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, Graphics.textures[bucketAnimation.textureID].texture);
        gl.uniform1f(Graphics.currentShader.vars['factor'].location, 1);

        let texmatrix = m3.translation(0, 0);
        texmatrix = m3.multiply(texmatrix, m3.scale(1, -1));
        gl.uniformMatrix3fv(Graphics.currentShader.vars['uTexMatrix'].location, false, texmatrix);
        gl.bindBuffer(gl.ARRAY_BUFFER, Graphics.posBuffer);
    
        Graphics.drawRect(0, 0, canvasWidth, canvasHeight, 0);
        //Graphics.putImageData(bucketAnimation.imageData, 0, 0);
        pushUndoHistory();
        setCharacterIcon("nit1");

        bucketAnimation.active = false;
        bucketAnimation.time = 0;
        bucketAnimation.lastTime = 0;
        bucketAnimation.iterations = 0;

        drawBackbuffer();
        mainDraw();
    }


}

// normal flood fill. only kept for reference
function executeFloodFill(x, y, color)
{
    if (bucketAnimation.active)
    {
        Graphics.setRenderTarget( g_currentLayer.id );
        //Graphics.putImageData(bucketAnimation.imageData, 0, 0);
        Graphics.setShader("floodFill");

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, Graphics.textures[bucketAnimation.textureID].texture);
        gl.uniform1f(Graphics.currentShader.vars['factor'].location, 1);

        let texmatrix = m3.translation(0, 0);
        texmatrix = m3.multiply(texmatrix, m3.scale(1, -1));
        gl.uniformMatrix3fv(Graphics.currentShader.vars['uTexMatrix'].location, false, texmatrix);
        gl.bindBuffer(gl.ARRAY_BUFFER, Graphics.posBuffer);
    
        Graphics.drawRect(0, 0, canvasWidth, canvasHeight, 0);
        pushUndoHistory();
        setCharacterIcon("nit1");

        bucketAnimation.active = false;
        bucketAnimation.time = 0;
        bucketAnimation.lastTime = 0;
        bucketAnimation.iterations = 0;

        drawBackbuffer();
        mainDraw();
    }
    // again; flip coords, flipped texture
    
    let width = canvasWidth; 
    let height = canvasHeight;
    let layer = "backbuffer_pre";
    if (g_tools[TOOL.BUCKET].sampleType == "layer")
    {
        console.log("layer type fill");
        width = g_currentLayer.width; 
        height = g_currentLayer.height;
        layer = g_currentLayer.id;
    }

    Graphics.setRenderTarget( layer );
    x = Math.floor(x), y = Math.floor(g_currentLayer.height-y);
    bucketAnimation.active = true;

    let filledPixels = new Uint8Array(width*height);
    //filledPixels.fill(0);

    bucketAnimation.imageData = Graphics.getImageData(0, 0, width, height);
    bucketAnimation.iterations = 0;
    
    let pixel = (y * g_currentLayer.width + x) * 4;

    bucketAnimation.srcColor = {
         r:  bucketAnimation.imageData.data[ pixel ],
         g:  bucketAnimation.imageData.data[ pixel + 1 ],
         b:  bucketAnimation.imageData.data[ pixel + 2 ],
         a:  bucketAnimation.imageData.data[ pixel + 3 ]};
    
    console.log("SRC COLOR: ", bucketAnimation.srcColor);

    bucketAnimation.replacementColor = color;
    //console.log(`getting data @ ${x},${y}: ${JSON.stringify( bucketAnimation.srcColor)}`);
    //document.querySelector('#filltarget').style.backgroundColor = `rgba(${srcColor.r}, ${srcColor.g}, ${srcColor.b}, 255)`;


    const colorMatch = function(x,y)
    {
        let index = (y * g_currentLayer.width + x) * 4;

        let c = new Color(
            bucketAnimation.imageData.data[index],
            bucketAnimation.imageData.data[index+1],
            bucketAnimation.imageData.data[index+2],
            bucketAnimation.imageData.data[index+3]);
        
        if (c.a == 0)
        {
            return Math.abs(bucketAnimation.srcColor.a - c.a) < g_tools[TOOL.BUCKET].tolerance;
        }
        return colorDistance(bucketAnimation.srcColor, c) < g_tools[TOOL.BUCKET].tolerance
          && Math.abs(bucketAnimation.srcColor.a - c.a) < g_tools[TOOL.BUCKET].tolerance;
    }

    const inside = function(x,y)
    {
        let index = (y * g_currentLayer.width + x);
        return !filledPixels[index] && 
                colorMatch(x,y) && 
                x >= 0 && 
                x < canvasWidth && 
                y >= 0 && 
                y < canvasHeight; 
    }

    const colorPixel = function(x,y)
    {
        let index = (y * g_currentLayer.width + x) * 4;

        bucketAnimation.imageData.data[ index ] = bucketAnimation.replacementColor.r * 255;
        bucketAnimation.imageData.data[index+1] = bucketAnimation.replacementColor.g * 255;
        bucketAnimation.imageData.data[index+2] = bucketAnimation.replacementColor.b * 255;
        bucketAnimation.imageData.data[index+3] = 255;

        filledPixels[x+y*g_currentLayer.width] = 1;
    }

    let stack = [ [x,y] ];

    if (!inside(x,y) || (colorDistance(bucketAnimation.srcColor, color) == 0 && Math.abs(bucketAnimation.srcColor.a - c.a) == 0)) 
        return;
    
    const scan = function(lx, rx, y, s)
    {
        let spanAdded = false;
        for (let i = lx; i < rx; i++)
        {
            if (!inside(i, y))
            {
                spanAdded = false;
            } else if (!spanAdded)
            {
                s.push([i,y]);
                spanAdded = true;
            }
        }
    }

    while (stack.length)
    {
        let pos = stack.pop();
        let xx = pos[0]; 
        let yy = pos[1];
        
        let lx = xx;
        while(inside(lx,yy))
        {
            colorPixel(lx, yy);
            lx -= 1;
        }
        xx += 1;
        while(inside(xx,yy))
        {
            colorPixel(xx, yy);
            xx += 1;
        }

        scan(lx, xx-1, yy+1, stack);
        scan(lx, xx-1, yy-1, stack);
    }

    
    if (bucketAnimation.textureID == "")
    {       
        gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
        bucketAnimation.textureID = Math.random().toString(36).substring(2);
        let texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8,
                      canvasWidth, canvasHeight, 0,
                      gl.RED, gl.UNSIGNED_BYTE, null);

        
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

        Graphics.textures[bucketAnimation.textureID] = 
        {
            width: canvasWidth,
            height: canvasHeight,
            texture: texture
        }
    }

    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);

    Graphics.setShader("floodFill");
    gl.uniform1i(Graphics.currentShader.vars['image'].location, 0);
    gl.uniform1f(Graphics.currentShader.vars['factor'].location, bucketAnimation.time / bucketAnimation.maxTime);
    gl.uniform2f(Graphics.currentShader.vars['sourcePosition'].location, x,y);
    gl.uniform3f(Graphics.currentShader.vars['color'].location, 
        bucketAnimation.replacementColor.r, 
        bucketAnimation.replacementColor.g, 
        bucketAnimation.replacementColor.b);
    
    gl.bindTexture(gl.TEXTURE_2D, Graphics.textures[bucketAnimation.textureID].texture);

    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8,
        canvasWidth, canvasHeight, 0,
        gl.RED, gl.UNSIGNED_BYTE, filledPixels);

    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
    window.requestAnimationFrame(FFAnimation);
}

function eyedrop(x,y, mouseIndex = 0)
{
    // texture is flipped in memory, flip sample pos
    x = Math.floor(x), y = Math.floor(g_currentLayer.height-y);

    let width = g_currentLayer.width;
    let height = g_currentLayer.height;
    let tex = g_currentLayer.id;

    if (g_tools[TOOL.EYEDROPPER].global)
    {
        width = canvasWidth;
        height = canvasHeight;
        tex = "backbuffer";
    }
    let pixel = x*4 + y*width*4;

    Graphics.setRenderTarget( tex ); 
    let data = Graphics.getImageData(0, 0, width, height).data;
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

function pasteTransformImage()
{
    let transform = g_tools[TOOL.TRANSFORM];
    Graphics.setRenderTarget( g_currentLayer.id );
    let region = rect2box(transform.startPoint, transform.endPoint);
    Graphics.drawImage( "temp-transform", 0, 0, transform.origSize.x, transform.origSize.h,
        region.x, region.y, region.w, region.h, 0, true );
    pushUndoHistory();
    drawBackbuffer();
    transform.regionActive = false;
}

function drawStart(e)
{
    g_isResizingCanvas = false;
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

    ////// canvas resize
    {
        let canvasSizeHandles = 6;
        let region = rect2box(
            g_canvasNewBounds.start.sub(Vec2(canvasSizeHandles/2,canvasSizeHandles/2)), 
            g_canvasNewBounds.end.add(Vec2(canvasSizeHandles, canvasSizeHandles))
        );

        for(let i = 0; i < 3; i++)
        {
            for (let j = 0; j < 3; j++)
            {
                let str = i.toString() + j.toString();
                let offset = Vec2( [0, region.w/2, region.w][i],
                                   [0, region.h/2, region.h][j]
                    );
                
                let dist = chebyshev(pos, Vec2(region.x, region.y).add(offset));
                let size = canvasSizeHandles/g_viewScale;
                if ( dist*dist < size*size)
                {
                    g_isResizingCanvas = true;
                    g_canvasResizeType = str;
                    lastCoords = pos;
                    return;
                }
            }
        }
    }
    //////

    Graphics.drawColor = g_currentColor;

    let index = 1;
    if (lastCoords.y > canvas.height * 0.8)
        index = 1;
    else if (lastCoords.y > canvas.height * 0.4)
        index = 2;
    else
        index = 3;
    
    setCharacterIcon("nit_think" + index);

    if (g_tools[TOOL.TRANSFORM].regionActive && g_currentTool != TOOL.TRANSFORM)
    {
        pasteTransformImage();
    }

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
        let region = rect2box(transform.startPoint, transform.endPoint);

        let flagExit = false;
        for(let i = 0; i < 3; i++)
        {
            for (let j = 0; j < 3; j++)
            {
                let str = i.toString() + j.toString();


                let offset = Vec2( [0, region.w/2, region.w][i],
                                   [0, region.h/2, region.h][j]
                    );
                
                let dist = chebyshev(pos, transform.startPoint.add( offset ));
                let size = transform.handleSize/g_viewScale;
                if ( dist*dist < size*size)
                {
                    transform.moving = true;
                    flagExit = true;
                    transform.movementType = str;
                    break;
                }
            }
            if (flagExit) break;
        }

        if (!flagExit)
        {
            if (!boxIntersect(region.x, region.y, region.w, region.h, pos.x, pos.y, 1, 1))
            {
                if (transform.copiedTexture)
                {
                    // paste image on click-off
                    pasteTransformImage();
                }

                transform.startPoint = pos;
                transform.drawing = true;
                transform.copiedTexture = false;
            }    
            else
            {
                transform.moving = true;
                transform.movementType = "move";
            }
        }
        

        if (transform.moving)
        {
            if (!transform.copiedTexture)
            {
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
                transform.origSize = Vec2(region.w, region.h);
            }
        }
        break;

        case TOOL.LASSO:
            g_tools[g_currentTool].points = [ pos.x, pos.y ];
            drawing = true;
            Graphics.setRenderTarget("temp-line");
            Graphics.clearRect(0,0,canvasWidth, canvasHeight);
            g_BrushSize = 2;
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
            g_currentLineDist = 0;
            drawing = true;
            Graphics.setRenderTarget("temp-line");
            Graphics.clearRect(0,0,canvasWidth, canvasHeight);
            if (e && e.shiftKey)
            {
                console.log("line")
                drawLine(lastCoords, pos, g_BrushSize, g_brushSpacing);
                lastCoords = pos;
                return;
            }

            drawLine(pos, pos, g_BrushSize, g_brushSpacing);
        break;
    }

    lastCoords = pos;
}

function drawMove(e)
{
    if (g_isResizingCanvas)
    {
        let x = e.clientX - canvas.offsetLeft;
        let y = e.clientY - canvas.offsetTop;
        let pos = Vec2(x,y).sub(g_viewTransform).scale( 1/g_viewScale );
        let delta = pos.sub(lastCoords);

        let canvasStart = g_canvasNewBounds.start;
        let canvasEnd = g_canvasNewBounds.end; 

        switch(g_canvasResizeType)
        {
            case "move":
                canvasStart = canvasStart.add( delta );
                canvasEnd = canvasEnd.add( delta );
            break;
    
            case "00":
                canvasStart = canvasStart.add( delta );
            break;
            
            case "10":
                canvasStart.y += delta.y;
            break;
    
            case "20":
                canvasStart.y += delta.y;
                canvasEnd.x += delta.x;
            break;
    
            case "01":
                canvasStart.x += delta.x;
            break;
    
            case "21":
                canvasEnd.x += delta.x;
            break;
    
            case "02":
                canvasStart.x += delta.x;
                canvasEnd.y += delta.y;
            break;
    
            case "12":
                canvasEnd.y += delta.y;
            break;
    
            case "22":
                canvasEnd = canvasEnd.add(delta);
            break;
        }

        g_canvasNewBounds = {start: canvasStart, end: canvasEnd};

        mainDraw( { x: lastCoords.x, 
            y: lastCoords.y,
            w: Math.abs(lastCoords.x - x), 
            h: Math.abs(lastCoords.y - y) } );
            
        lastCoords = pos;

        return;
    }

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

        if (g_currentTool == TOOL.LASSO)
        {
            g_tools[g_currentTool].points.push( pos.x );
            g_tools[g_currentTool].points.push( pos.y );
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

        switch(transform.movementType)
        {
            case "move":
                transform.startPoint = transform.startPoint.add( delta );
                transform.endPoint = transform.endPoint.add( delta );
            break;

            case "00":
                transform.startPoint = transform.startPoint.add( delta );
            break;
            
            case "10":
                transform.startPoint.y += delta.y;
            break;

            case "20":
                transform.startPoint.y += delta.y;
                transform.endPoint.x += delta.x;
            break;

            case "01":
                transform.startPoint.x += delta.x;
            break;

            case "21":
                transform.endPoint.x += delta.x;
            break;

            case "02":
                transform.startPoint.x += delta.x;
                transform.endPoint.y += delta.y;
            break;

            case "12":
                transform.endPoint.y += delta.y;
            break;

            case "22":
                transform.endPoint = transform.endPoint.add(delta);
            break;
        }
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

    if (g_isResizingCanvas)
    {
        let region = rect2box(g_canvasNewBounds.start, g_canvasNewBounds.end); 
        setCanvasSize( Vec2(region.w, region.h), g_canvasNewBounds.start, true );
        g_canvasNewBounds = {start: Vec2(0,0), end: Vec2(canvasWidth, canvasHeight)};
        g_isResizingCanvas = false;
        return;
    }

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

    // apply line to layer when finishing
	if (drawing)
    {
        let toolOpacity = (g_tools[g_currentTool].opacity || 1);
        if (g_currentTool == TOOL.LASSO)
        {
            Graphics.setRenderTarget(g_currentLayer.id);
            drawLassoSelection();
        }
        //else drawLine(lastCoords, pos, g_BrushSize, g_brushSpacing);
        

        gl.disable(gl.BLEND);

       
        let blendMode = 0;
        if (g_currentTool == TOOL.ERASER)
        {
            Graphics.setRenderTarget( g_currentLayer.id );
            {
                gl.enable(gl.BLEND);
                gl.blendFuncSeparate(gl.ZERO, gl.ONE, gl.ONE, gl.ONE);
                gl.blendEquation(gl.FUNC_REVERSE_SUBTRACT);
                Graphics.globalAlpha = toolOpacity;
                Graphics.drawImage("temp-line", 0, 0, canvasWidth, canvasHeight, 0, 0, canvasWidth, canvasHeight, 0, true);
                Graphics.globalAlpha = 1;
                gl.disable(gl.BLEND);
            }
        }
        else 
        {
            Graphics.setRenderTarget("temp0");
            {
                Graphics.clearRect(0,0,canvasWidth, canvasHeight);
                drawLayer( "temp-line", g_currentLayer.id, (g_tools[g_currentTool].opacity || 1));
            }

            Graphics.setRenderTarget( g_currentLayer.id );
            {
                Graphics.drawImage( "temp0", 0, 0 );
            }
        }

        Graphics.setRenderTarget( "temp-line" );
        {
            Graphics.clearRect(0,0,canvasWidth, canvasHeight);
        }

        Graphics.setRenderTarget( null );

        drawing = false;
        drawBackbuffer();
        pushUndoHistory();
    }

    drawing = false;
    
    if (!bucketAnimation.active)
        setCharacterIcon("nit1");

    let transform = g_tools[TOOL.TRANSFORM];
    if (transform.drawing)
    {
        transform.endPoint = pos;
        transform.regionActive = transform.startPoint.x != transform.endPoint.x && transform.startPoint.y != transform.endPoint.y;

        transform.startPoint.x = clamp(transform.startPoint.x, 0, canvasWidth);
        transform.startPoint.y = clamp(transform.startPoint.y, 0, canvasHeight);
        transform.endPoint.x = clamp(transform.endPoint.x, 0, canvasWidth);
        transform.endPoint.y = clamp(transform.endPoint.y, 0, canvasHeight);

        transform.startPoint.x = Math.floor(transform.startPoint.x);
        transform.startPoint.y = Math.floor(transform.startPoint.y);
        transform.endPoint.x = Math.floor(transform.endPoint.x);
        transform.endPoint.y = Math.floor(transform.endPoint.y);

        // startPoint MUST always be the topleft corner of the selection. swap if this isn't the case
        let tmpX = transform.startPoint.x;
        let tmpY = transform.startPoint.y;
        if (transform.startPoint.x > transform.endPoint.x)
        {
            transform.startPoint.x = transform.endPoint.x;
            transform.endPoint.x = tmpX;
        }
        if (transform.startPoint.y > transform.endPoint.y)
        {
            transform.startPoint.y = transform.endPoint.y;
            transform.endPoint.y = tmpY;
        }
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

function drawLassoSelection()
{
    let data = g_tools[TOOL.LASSO].points;

    let arr = Tesselator.triangulate( [new Float32Array(data)] );
    let positions = new Float32Array( arr.length/2*3 );
    let j = 0;

    for (var i = 0; i < arr.length; i+=2)
    {
        positions[j] = arr[i];
        positions[j+1] = arr[i+1];
        positions[j+2] = 0;
        j += 3;
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, Graphics.posBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
    Graphics.setShader("baseColor");
    
    const viewport = gl.getParameter(gl.VIEWPORT);
    let matrix = m4.projection(
        viewport[2],
        viewport[3],
        400
    );
    //matrix = m4.multiply(matrix, m4.scaling(canvasWidth,canvasHeight,1));
    
    gl.vertexAttribPointer(
        Graphics.currentShader.vars['aPos'].location,
        3,
        gl.FLOAT,
        false, 
        0,
        0
    );   

    gl.uniformMatrix4fv(Graphics.currentShader.vars['uMatrix'].location, false, matrix);
    gl.uniform4f(Graphics.currentShader.vars['uColor'].location,
    g_currentColor.r, g_currentColor.g, g_currentColor.b, Graphics.globalAlpha);
    gl.drawArrays(gl.TRIANGLES, 0, positions.length/3);

}

// size: Vec2
function setCanvasSize(size, offset, pushUndo = false)
{
    size = Vec2(Math.floor(size.x), Math.floor(size.y));
    let oldWidth = canvasWidth;
    let oldHeight = canvasHeight;

    canvasWidth = size.x;
    canvasHeight = size.y;

    let cropSize = Vec2(oldWidth, oldHeight);
    let data = null;
    let gOffset = Vec2(0,0);
    if (offset)
        gOffset = offset.scale(-1);

    g_viewTransform = g_viewTransform.add(gOffset.scale(-g_viewScale));

    if (pushUndo)
    {
        data = [];
        for(let i = 0; i < g_layers.length; i++)
        {
            Graphics.setRenderTarget(g_layers[i].id);
            data.push(Graphics.getImageData(0,0,g_layers[i].width, g_layers[i].height));
        }
    }

    console.log(`resizing canvas: ${Vec2(oldWidth, oldHeight)} -> ${size}, delta=${(size).sub(Vec2(oldWidth,oldHeight))}`);
    
    if (canvasHeight < oldHeight)
    {
        cropSize.y = canvasHeight;
    }

    // bucket fill
    {
        if (bucketAnimation.textureID == "")
        {
            bucketAnimation.textureID = Math.random().toString(36).substring(2);
        }
        else 
            gl.deleteTexture(Graphics.textures[bucketAnimation.textureID].texture);
        
        if (debug)
            console.log(`recreating bucket mask texture: ${canvasWidth}x${canvasHeight}`);
        gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
        let texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8,
                    canvasWidth, canvasHeight, 0,
                    gl.RED, gl.UNSIGNED_BYTE, null);

        
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

        Graphics.textures[bucketAnimation.textureID] = 
        {
            width: canvasWidth,
            height: canvasHeight,
            texture: texture
        }

        Graphics.setShader("floodFill");
        gl.uniform2f(Graphics.currentShader.vars['canvasResolution'].location, canvasWidth, canvasHeight)
        gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
    }

    for (let i = 0; i < g_layers.length; i++)
    {
        let layer = g_layers[i];
        // copy layer to temp0 RT -> delete, remake layer texture -> paste onto new layer texture 
        gl.bindTexture(gl.TEXTURE_2D, Graphics.renderTargets["temp0"].texture.texture);
        Graphics.setRenderTarget( layer.id );
        gl.copyTexSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 0, 0, oldWidth, oldHeight);
        
        Graphics.deleteRenderTarget( layer.id );
        layer.renderTarget = Graphics.createRenderTarget( layer.id, canvasWidth, canvasHeight );
        
        gl.bindTexture(gl.TEXTURE_2D, Graphics.renderTargets[layer.id].texture.texture);
        Graphics.setRenderTarget( layer.id );
        
        Graphics.drawImage( "temp0", 0, 0, cropSize.x, cropSize.y, gOffset.x, gOffset.y, cropSize.x, cropSize.y, 1, true );

        g_layers[i].width = canvasWidth;
        g_layers[i].height = canvasHeight;
    }

    let systemLayers = ["temp0", "temp1", "temp-line", "temp-layer", "backbuffer", "backbuffer_pre"];
    for (let i = 0; i < systemLayers.length; i++)
    {
        let layerName = systemLayers[i];
        Graphics.deleteRenderTarget( layerName );
        Graphics.createRenderTarget( layerName, size.x, size.y );
    }

    if (pushUndo)
    {
        pushUndoHistory( {
            type: "CANVAS_RESIZE",
            oldSize: Vec2(oldWidth, oldHeight),
            newSize: Vec2(canvasWidth, canvasHeight),
            offset: gOffset.multiply(Vec2(-1,-1)),
            data: data
        } ); 
    }

    g_canvasNewBounds = {start: Vec2(0,0), end: Vec2(canvasWidth, canvasHeight)};

    mainDraw();
    drawBackbuffer();
}

function exportCopy(merge, save)
{
    displayToast("exporting...");
    drawBackbuffer();
    Graphics.setRenderTarget( merge ? "backbuffer" : g_currentLayer.id );
    let region = rect2box(
            g_tools[TOOL.TRANSFORM].startPoint,
            g_tools[TOOL.TRANSFORM].endPoint
    );

    let copyRegion = {x:0,y:0,w:canvasWidth,h:canvasHeight};

    //Graphics.setRenderTarget(g_currentLayer.id);
    // use region if transform region set
    if (g_tools[TOOL.TRANSFORM].regionActive)
    {
        copyRegion = {x:region.x, y:canvasHeight-region.h-region.y, w:region.w, h:region.h};
        console.log(copyRegion);
    }

    let data = Graphics.getImageData(copyRegion.x, copyRegion.y, copyRegion.w, copyRegion.h).data;
    tempCanvas.width = copyRegion.w;
    tempCanvas.height = copyRegion.h;

    let imgData = tempCtx.createImageData(copyRegion.w, copyRegion.h);
    
    const bytesPerPixel = 4; // Assuming RGBA format
    const rowSize = copyRegion.w * bytesPerPixel;
    for (let row = 0; row < copyRegion.h; row++) {
        const srcStart = row * rowSize;
        const dstStart = (copyRegion.h - row - 1) * rowSize;

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

canvas.addEventListener("pointerdown", e => { 
    drawStart(e) 
});
window.addEventListener("pointermove", e => { 
    window.requestAnimationFrame(drawMove.bind(this,e)) 
});
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
    
    g_zoomLevel = clamp( g_zoomLevel - Math.sign(e.deltaY) * 0.5, 1, 35 );
    g_viewScale = g_zoomLevel == 25 ? 1 : Math.pow(1.2, g_zoomLevel) / 100;

    displayToast(`zoom: ${Math.floor(g_viewScale*100)}%`);
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


    if (y > 0.9)
        colorPicker.selectedRegion = "HUE";
    else 
        colorPicker.selectedRegion = "MAIN";
    
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

    if (colorPicker.selectedRegion == "MAIN")
        y = Math.min(0.9, y);
    else if (colorPicker.selectedRegion == "HUE")
        y = Math.max(y, 0.91);

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