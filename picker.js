import { Color } from "./color.js";

  // hue in range [0, 360]
  // saturation, value in range [0,1]
  // return [r,g,b] each in range [0,255]
function hsv2rgb(hue, saturation, value) 
{
    let chroma = value * saturation;
    let hue1 = hue / 60;
    let x = chroma * (1- Math.abs((hue1 % 2) - 1));
    let r1, g1, b1;
    if (hue1 >= 0 && hue1 <= 1) {
      ([r1, g1, b1] = [chroma, x, 0]);
    } else if (hue1 >= 1 && hue1 <= 2) {
      ([r1, g1, b1] = [x, chroma, 0]);
    } else if (hue1 >= 2 && hue1 <= 3) {
      ([r1, g1, b1] = [0, chroma, x]);
    } else if (hue1 >= 3 && hue1 <= 4) {
      ([r1, g1, b1] = [0, x, chroma]);
    } else if (hue1 >= 4 && hue1 <= 5) {
      ([r1, g1, b1] = [x, 0, chroma]);
    } else if (hue1 >= 5 && hue1 <= 6) {
      ([r1, g1, b1] = [chroma, 0, x]);
    }
    
    let m = value - chroma;
    let [r,g,b] = [r1+m, g1+m, b1+m];
    
    // Change r,g,b values from [0,1] to [0,255]
    return [255*r,255*g,255*b];
}



export class Picker {
    canvas = null;
    ctx = null;
    element = null;
    size = 256;
    lastPickedPosition = {x:0, y:0};
    imageData = 0;
    normH = 0;
    mouseDown = false;

    redrawSpectrum = function() 
    {
        for (let x = 0; x < this.size; x++)
        {
            for (let y = 0; y < this.size; y++)
            {
                let normX = x / this.size;
                let normY = y / this.size;

                let i = (x + y * this.size) * 4;
                let rgb = hsv2rgb( this.normH * 360, 1-normX, 1-normY*0.9 );
                if (normY > 0.9) // draw hue gradient
                {
                    rgb = hsv2rgb( normX * 360, 1, 1 );
                }
                this.imageData.data[i+0] = rgb[0];
                this.imageData.data[i+1] = rgb[1];
                this.imageData.data[i+2] = rgb[2];
                this.imageData.data[i+3] = 255;
            }
        }
        console.log(this.normH);
    };

    redraw = function()
    {
        this.ctx.globalCompositeOperation = "source-over";
        this.ctx.putImageData(this.imageData, 0, 0);
        //
        let reticleSize = 8;
        this.ctx.globalCompositeOperation = "xor";
        this.ctx.lineWidth = 1;
        this.ctx.strokeRect( this.lastPickedPosition.x * this.canvas.width - reticleSize/2, 
                             this.lastPickedPosition.y * this.canvas.height - reticleSize/2,
                             reticleSize,
                             reticleSize );

        this.ctx.strokeRect( this.normH * this.canvas.width - reticleSize/2, 
        0.95 * this.canvas.height - reticleSize/2,
        reticleSize,
        reticleSize );
    }

    getColor = function( normX, normY )
    {
        if (normY > 0.9)
        {
            this.normH = normX;
            requestAnimationFrame(this.redrawSpectrum.bind(this));
        }
        else 
            this.lastPickedPosition = {x: normX, y: normY};

        requestAnimationFrame(this.redraw.bind(this));
        return hsv2rgb( this.normH * 360, 
            1-this.lastPickedPosition.x, 
            1-this.lastPickedPosition.y*0.9 );
    };

    constructor(divId) 
    {
        this.element = document.querySelector(divId);
        this.canvas = document.createElement("canvas");
        this.canvas.width = this.size;
        this.canvas.height = this.size;
        this.ctx = this.canvas.getContext("2d");
        this.imageData = this.ctx.createImageData( 256, 256 );

        this.element.appendChild(this.canvas);
        this.redrawSpectrum();
        this.redraw();
    }
}

