/**
 * https://gist.github.com/mjackson/5311256
 * Converts an RGB color value to HSV. Conversion formula
 * adapted from http://en.wikipedia.org/wiki/HSV_color_space.
 * Assumes r, g, and b are contained in the set [0, 1] and
 * returns h, s, and v in the set [0, 1].
 *
 * @param   Number  r       The red color value
 * @param   Number  g       The green color value
 * @param   Number  b       The blue color value
 * @return  Array           The HSV representation
 */
function rgbToHsv(r,g,b) {
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

  /**
 * Converts an RGB color value to HSL. Conversion formula
 * adapted from http://en.wikipedia.org/wiki/HSL_color_space.
 * Assumes r, g, and b are contained in the set [0, 1] and
 * returns h, s, and l in the set [0, 1].
 *
 * @param   Number  r       The red color value
 * @param   Number  g       The green color value
 * @param   Number  b       The blue color value
 * @return  Array           The HSL representation
 */
function rgbToHsl(r, g, b) {
  
    var max = Math.max(r, g, b), min = Math.min(r, g, b);
    var h, s, l = (max + min) / 2;
  
    if (max == min) {
      h = s = 0; // achromatic
    } else {
      var d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }
  
      h /= 6;
    }
  
    return [ h, s, l ];
  }
  
  /**
   * Converts an HSL color value to RGB. Conversion formula
   * adapted from http://en.wikipedia.org/wiki/HSL_color_space.
   * Assumes h, s, and l are contained in the set [0, 1] and
   * returns r, g, and b in the set [0, 255].
   *
   * @param   Number  h       The hue
   * @param   Number  s       The saturation
   * @param   Number  l       The lightness
   * @return  Array           The RGB representation
   */
  function hslToRgb(h, s, l) {
    var r, g, b;
  
    if (s == 0) {
      r = g = b = l; // achromatic
    } else {
      function hue2rgb(p, q, t) {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1/6) return p + (q - p) * 6 * t;
        if (t < 1/2) return q;
        if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
        return p;
      }
  
      var q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      var p = 2 * l - q;
  
      r = hue2rgb(p, q, h + 1/3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1/3);
    }
  
    return [ r, g, b ];
  }

  
  function xy2polar(x, y) {
    let r = Math.sqrt(x*x + y*y);
    let phi = Math.atan2(y, x);
    return [r, phi];
  }
  
  // rad in [-π, π] range
  // return degree in [0, 360] range
  function rad2deg(rad) {
    return ((rad + Math.PI) / (2 * Math.PI)) * 360;
  }

  function clamp(x, min, max) {
    return Math.min(Math.max(x, min), max);
  };

  function map(X, A, B, C, D) {
    return clamp((X-A)/(B-A) * (D-C) + C, C, D);
  }

  function chebyshev(a,b)
  {
    return Math.max( Math.abs(b.y - a.y), Math.abs(b.x - a.x) );
  }

export class Picker {
    canvas = null;
    ctx = null;
    element = null;
    size = 256;
    lastPickedPosition = {x:0, y:0};
    imageData = 0;
    normH = 0;
    visualNormH = 0;
    visualPosition = {x:0, y:0};
    mouseDown = false;
    selectedRegion = "MAIN";
    displayType = "SQUIRCLE";
    radSize = 0.23*1.2;
    hueType = "HSL";

    hueToRGB = function(h,s,t)
    {
        if (this.hueType == "HSL")
            return hslToRgb(h,s,t);
        return hsvToRgb(h,s,t);
    }

    rgbToHue = function(r,g,b)
    {
        if (this.hueType == "HSL")
            return rgbToHsl(r,g,b);
        return rgbToHsv(r,g,b);
    }

    redrawSpectrum = function() 
    {
        switch(this.displayType)
        {
            case "SQUARE":
                for (let x = 0; x < this.size; x++)
                {
                    for (let y = 0; y < this.size; y++)
                    {
                        let normX = x / this.size;
                        let normY = y / this.size;
        
                        let i = (x + y * this.size) * 4;

                        let rgb = this.hueToRGB( this.normH, 1-normX, 1-normY*1.1 );
                        if (normY > 0.9) // draw hue gradient
                        {
                            let r = this.hueType == "HSL" ? 0.5 : 1;
                            rgb = this.hueToRGB( normX, 1, r);
                        }
                        this.imageData.data[i+0] = rgb[0] * 255;
                        this.imageData.data[i+1] = rgb[1] * 255;
                        this.imageData.data[i+2] = rgb[2] * 255;
                        this.imageData.data[i+3] = 255;
                    }
                }
                break;
            
            case "CIRCLE":
                for (let x = 0; x < this.size; x++)
                {
                    for (let y = 0; y < this.size; y++)
                    {
                        let normX = x / this.size;
                        let normY = y / this.size;
    
                        normX -= 0.5;
                        normY -= 0.5;
                        
                        let sqrlen = (normX*normX + normY*normY);
                        let offset = 0.007;
                        let offlen = (Math.pow(normX-offset,2) + Math.pow(normY-offset,2));
                        let shadowAlpha = 60;
                        let i = (x + y * this.size) * 4;

                        let rgb = [0,0,0,0];
                        rgb = [0,0,0, (1-(offlen-0.23)*150)*shadowAlpha ];

                        if (offlen < this.radSize - 0.06)
                        {
                            rgb = [0,0,0, (offlen-0.15)*150*shadowAlpha ];
                            if (Math.abs(normX-offset*2) < this.radSize && Math.abs(normY-offset*2) < this.radSize)
                            {
                                rgb = [0,0,0, 2*shadowAlpha ]
                            }
                        }

                        if (sqrlen < this.radSize-0.06)
                        {
                            if (Math.abs(normX) < this.radSize && Math.abs(normY) < this.radSize)
                            {
                                let s = map(normX, -this.radSize, this.radSize, 0, 1);
                                let v = map(normY, -this.radSize, this.radSize, 0, 1);
                                rgb = this.hueToRGB(this.normH, 1-s, 1-v);
                            }
                            else if (sqrlen > 0.17)
                            {
                                let [r, phi] = xy2polar(normX, normY);
                                let deg = rad2deg(phi);
                                r = this.hueType == "HSL" ? 0.5 : 1;
                                rgb = this.hueToRGB(deg/360, 1, r);
                            }
                        }

                        this.imageData.data[i+0] = rgb[0] * 255;
                        this.imageData.data[i+1] = rgb[1] * 255;
                        this.imageData.data[i+2] = rgb[2] * 255;
                        this.imageData.data[i+3] = rgb[3] != undefined ? rgb[3] : 255;
                    }
                }
            break;

            case "SQUIRCLE":
                for (let x = 0; x < this.size; x++)
                {
                    for (let y = 0; y < this.size; y++)
                    {
                        let normX = x / this.size;
                        let normY = y / this.size;
    
                        normX -= 0.5;
                        normY -= 0.5;
                        
                        let sqrlen = (normX*normX + normY*normY);
                        sqrlen = chebyshev({x:normX, y:normY}, {x:0, y:0});
                        let offset = 0.007;
                        let offlen = (Math.pow(normX-offset,2) + Math.pow(normY-offset,2));
                        
                        offlen = chebyshev({x:normX-offset, y:normY-offset}, {x:0, y:0});
                        let shadowAlpha = 60;
                        let i = (x + y * this.size) * 4;

                        let rgb = [0,0,0,0];
                        rgb = [0,0,0, (1-(offlen-0.1)*150)*shadowAlpha ];

                        if (offlen < 0.4)
                        {
                            rgb = [0,0,0, (offlen-0.34)*150*shadowAlpha ];
                            if (Math.abs(normX-offset*2) < this.radSize && Math.abs(normY-offset*2) < this.radSize)
                            {
                                rgb = [0,0,0, 2*shadowAlpha ]
                            }
                        }

                        if (sqrlen < 0.4)
                        {
                            if (Math.abs(normX) < this.radSize && Math.abs(normY) < this.radSize)
                            {
                                let s = map(normX, -this.radSize, this.radSize, 0, 1);
                                let v = map(normY, -this.radSize, this.radSize, 0, 1);
                                rgb = this.hueToRGB(this.normH, 1-s, 1-v);
                            }
                            else if (sqrlen > 0.35)
                            {
                                let [r, phi] = xy2polar(normX, normY);
                                let deg = rad2deg(phi);
                                r = this.hueType == "HSL" ? 0.5 : 1;
                                rgb = this.hueToRGB(deg/360, 1, r);
                            }
                        }


                        this.imageData.data[i+0] = rgb[0] * 255;
                        this.imageData.data[i+1] = rgb[1] * 255;
                        this.imageData.data[i+2] = rgb[2] * 255;
                        this.imageData.data[i+3] = rgb[3] != undefined ? rgb[3] : 255;
                    }
                }
            break;
        }
    };

    redraw = function()
    {
        let reticleSize = 8;
        let angle;
        this.ctx.globalCompositeOperation = "source-over";
        this.ctx.putImageData(this.imageData, 0, 0);
        this.ctx.strokeStyle = "white";
        this.ctx.globalCompositeOperation = "difference";
        this.ctx.lineWidth = 2;
        switch(this.displayType)
        {
            case "SQUARE":
                this.ctx.strokeRect( this.lastPickedPosition.x * this.canvas.width - reticleSize/2, 
                                    this.lastPickedPosition.y * this.canvas.height - reticleSize/2,
                                    reticleSize,
                                    reticleSize );
    
                this.ctx.strokeRect( this.normH * this.canvas.width - reticleSize/2, 
                0.95 * this.canvas.height - reticleSize/2,
                reticleSize,
                reticleSize );
                break;

            case "CIRCLE":
                /*
                this.ctx.strokeRect( map(this.lastPickedPosition.x, 0, 1, 0.5-this.radSize, 0.5+this.radSize)*this.canvas.width - reticleSize/2, 
                                     map(this.lastPickedPosition.y, 0, 1, 0.5-this.radSize, 0.5+this.radSize)*this.canvas.height - reticleSize/2,
                    reticleSize,
                    reticleSize );
                */
                this.ctx.beginPath();
                this.ctx.arc( 
                    map(this.lastPickedPosition.x, 0, 1, 0.5-this.radSize, 0.5+this.radSize)*this.canvas.width,
                    map(this.lastPickedPosition.y, 0, 1, 0.5-this.radSize, 0.5+this.radSize)*this.canvas.height,
                    reticleSize,
                    0, Math.PI*2
                );
                this.ctx.stroke();
                angle = Math.PI/180 * (this.normH*360-180);

                this.ctx.beginPath();
                this.ctx.arc( 
                    Math.cos(angle) * this.canvas.width/2.25 + this.canvas.width/2,
                    Math.sin(angle) * this.canvas.height/2.25 + this.canvas.height/2,
                 reticleSize,
                 0, Math.PI*2
                );
                this.ctx.stroke();
                break;
            
            
            case "SQUIRCLE":
                /*
                this.ctx.strokeRect( map(this.lastPickedPosition.x, 0, 1, 0.5-this.radSize, 0.5+this.radSize)*this.canvas.width - reticleSize/2, 
                                        map(this.lastPickedPosition.y, 0, 1, 0.5-this.radSize, 0.5+this.radSize)*this.canvas.height - reticleSize/2,
                    reticleSize,
                    reticleSize );
                */
                this.ctx.beginPath();
                this.ctx.arc( 
                    map(this.lastPickedPosition.x, 0, 1, 0.5-this.radSize, 0.5+this.radSize)*this.canvas.width,
                    map(this.lastPickedPosition.y, 0, 1, 0.5-this.radSize, 0.5+this.radSize)*this.canvas.height,
                    reticleSize,
                    0, Math.PI*2
                );
                this.ctx.stroke();
                angle = Math.PI/180 * (this.normH*360-180);
                
                const half = this.canvas.width / 2.65;
                let a = {
                    x: clamp(Math.cos(angle)*1.2*this.canvas.width/2,-half, half),
                    y: clamp(Math.sin(angle)*1.2*this.canvas.height/2,-half, half)
                };
                
                this.ctx.beginPath();
                this.ctx.arc( 
                    a.x + this.canvas.width/2,
                    a.y + this.canvas.height/2,
                    reticleSize,
                    0, Math.PI*2
                );
                this.ctx.stroke();
                break;
        }
    }

    interpolateVisValues = function()
    {
        if (Math.abs(this.normH - this.visualNormH) > 0.1)
        {
            this.visualNormH += Math.sign(this.normH - this.visualNormH) * 0.001;
            requestAnimationFrame(this.redraw.bind(this));
        } else 
        {
            if (Math.abs(this.normH - this.visualNormH) > 0.0001)
            {
                this.visualNormH = this.normH;
                requestAnimationFrame(this.redraw.bind(this));
            }
        }
        
        if (this.normH != this.visualNormH)
        {
            requestAnimationFrame(this.interpolateVisValues.bind(this));
        }
    }

    getColor = function( normX, normY )
    {
        switch(this.displayType)
        {
            case "SQUARE":
                if (normY > 0.9)
                {
                    this.normH = normX;
                    requestAnimationFrame(this.redrawSpectrum.bind(this));
                }
                else 
                    this.lastPickedPosition = {x: normX, y: (normY)*1.1};
            break;

            case "SQUIRCLE":
            case "CIRCLE":
                let s = map(normX, 0.5-this.radSize, 0.5+this.radSize, 0, 1);
                let v = map(normY, 0.5-this.radSize, 0.5+this.radSize, 0, 1);

                if (this.selectedRegion == "MAIN")//(Math.abs(normX) < this.radSize && Math.abs(normY) < this.radSize)
                {
                    this.lastPickedPosition = {x:s, y:v};
                } else
                {
                    let [r, phi] = xy2polar(normX-.5, normY-.5);
                    let deg = rad2deg(phi);
                    this.normH = deg / 360;
                    requestAnimationFrame(this.redrawSpectrum.bind(this));
                }
            break;
        }

        //this.interpolateVisValues();
        requestAnimationFrame(this.redraw.bind(this));
        return this.hueToRGB( this.normH, 
            1-this.lastPickedPosition.x, 
            1-this.lastPickedPosition.y);
    };

    setColor = function(color) {
        let r = color.r,
        g = color.g,
        b = color.b;
        let hsv = this.rgbToHue(r,g,b);
        this.normH = hsv[0];
        
        switch(this.displayType)
        {
            case "SQUARE":
                this.lastPickedPosition = {x: 1-hsv[1], y: (1-hsv[2])*0.9};
                break;

            case "SQUIRCLE":
            case "CIRCLE":
                this.lastPickedPosition = {x: 1-hsv[1], y: (1-hsv[2])};
                break;
        }
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

