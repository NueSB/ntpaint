export class Color 
{
    constructor(r = 0, g = 0, b = 0, a = 255) 
    {
        if (typeof r === "string") 
        {
            [this.r, this.g, this.b] = Color.hexToRgb(r);
            this.a = a <= 0 ? 0 : a;
            this.hex = r;
        } else {
            this.r = r;
            this.g = g;
            this.b = b;
            this.a = a;
            this.hex = this.toHex();
        }
    }

    toHex()
    {
        return `#${ Math.floor(this.r*255).toString(16).padStart(2,'0') }${ Math.floor(this.g*255).toString(16).padStart(2,'0') }${ Math.floor(this.b*255).toString(16).padStart(2,'0') }`;
    }

    toString()
    {
        return `rgba(${this.r},${this.g},${this.b},${this.a})`;
    }

    static lerp(a, b, t)
    {
        return new Color(
            lerp(a.r, b.r, t),
            lerp(a.g, b.g, t),
            lerp(a.b, b.b, t),
            lerp(a.a, b.a, t),
        );
    }

    static add(a, b)
    {
        return new Color(
            a.r + b.r,
            a.g + b.g,
            a.b + b.b,
            a.a + b.a
        );
    }

    static subtract(a, b)
    {
        return new Color(
            a.r - b.r,
            a.g - b.g,
            a.b - b.b,
            a.a - b.a
        );
    }

    static hexToRgb(hex)
    {
        return hex.slice(1).match(/.{1,2}/g).map(x => parseInt(x, 16)/255);
    }

    static toHex(r,g,b)
    {
        return `#${ r.toString(16).padStart(2,'0')  }${ g.toString(16).padStart(2,'0') }${ b.toString(16).padStart(2,'0') }`;
    }


    static red = new Color(1, 0, 0);
    static orange = new Color(1, 165/255, 0);
    static yellow = new Color(1, 1, 0);
    static green = new Color(0, 1, 0);
    static blue = new Color(0, 0, 1);
    static indigo = new Color(75/255, 0, 130/255);
    static purple = new Color(238/255, 130/255, 238/255);
    static white = new Color(1, 1, 1);
    static black = new Color(0, 0, 0);
}