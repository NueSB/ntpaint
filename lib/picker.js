/**
 * https://gist.github.com/mjackson/5311256
 * Converts an RGB color value to HSV. Conversion formula
 * adapted from http://en.wikipedia.org/wiki/HSV_color_space.
 * Assumes r, g, and b are contained in the set [0, 255] and
 * returns h, s, and v in the set [0, 1].
 *
 * @param   Number  r       The red color value
 * @param   Number  g       The green color value
 * @param   Number  b       The blue color value
 * @return  Array           The HSV representation
 */
function rgbToHsv(color) {
    let r = color.r,
        g = color.g,
        b = color.b;
  
    var max = Math.max(r, g, b), min = Math.min(r, g, b);
    var h, s, v = max;
  
    var d = max - min;
    s = max == 0 ? 0 : d / max;
  
    if (max == min) {
      h = 0; // achromatic
    } else {
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }
  
      h /= 6;
    }
  
    return [ h, s, v ];
  }
  
  /**
   * Converts an HSV color value to RGB. Conversion formula
   * adapted from http://en.wikipedia.org/wiki/HSV_color_space.
   * Assumes h, s, and v are contained in the set [0, 1] and
   * returns r, g, and b in the set [0, 255].
   *
   * @param   Number  h       The hue
   * @param   Number  s       The saturation
   * @param   Number  v       The value
   * @return  Array           The RGB representation
   */
  function hsvToRgb(h, s, v) {
    var r, g, b;
  
    var i = Math.floor(h * 6);
    var f = h * 6 - i;
    var p = v * (1 - s);
    var q = v * (1 - f * s);
    var t = v * (1 - (1 - f) * s);
  
    switch (i % 6) {
      case 0: r = v, g = t, b = p; break;
      case 1: r = q, g = v, b = p; break;
      case 2: r = p, g = v, b = t; break;
      case 3: r = p, g = q, b = v; break;
      case 4: r = t, g = p, b = v; break;
      case 5: r = v, g = p, b = q; break;
    }
  
    return [ r, g, b ];
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
                let rgb = hsvToRgb( this.normH, 1-normX, 1-normY*0.9 );
                if (normY > 0.9) // draw hue gradient
                {
                    rgb = hsvToRgb( normX, 1, 1 );
                }
                this.imageData.data[i+0] = rgb[0] * 255;
                this.imageData.data[i+1] = rgb[1] * 255;
                this.imageData.data[i+2] = rgb[2] * 255;
                this.imageData.data[i+3] = 255;
            }
        }

    };

    redraw = function()
    {
        this.ctx.globalCompositeOperation = "source-over";
        this.ctx.putImageData(this.imageData, 0, 0);
        //
        let reticleSize = 16;
        this.ctx.globalCompositeOperation = "xor";
        this.ctx.lineWidth = 3;
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
        return hsvToRgb( this.normH, 
            1-this.lastPickedPosition.x, 
            1-(this.lastPickedPosition.y*1.1) );
    };

    setColor = function(color) {
        let hsv = rgbToHsv(color);
        this.normH = hsv[0];
        this.lastPickedPosition = {x: 1-hsv[1], y: (1-hsv[2])*0.9};

        requestAnimationFrame(this.redrawSpectrum.bind(this));
        requestAnimationFrame(this.redraw.bind(this));
    }

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

