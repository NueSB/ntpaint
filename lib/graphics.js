import { Color } from "./color.js";

function lerp(v0, v1, t) 
{
    return v0*(1-t)+v1*t
}

export const Graphics = {
    gl: null, // webgl rendering context
    drawColor: new Color(1, 1, 1, 1),
    tintColor: new Color(1, 1, 1, 0),
    globalAlpha: 1,
    bgTint: new Color(0, 0, 0, 0),
    globalTransform: 0,
    imageLoadCount: 0,
    posBuffer: 0,
    instanceData: {
        numInstances: 0,
        positions: [],
        colors: [],
        matrixData: null,
        matrixBuffer: null,
        colorBuffer: null,
    },
    queues: {
        textures: []
    },

    meshes: {
        circle: null,
        quad: null,
        lineQuad: null,
        line: null,
    },

    // mesh: a gl buffer
    setMesh: function(mesh) {
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, mesh);
        
        this.gl.vertexAttribPointer(
            this.currentShader.vars['aPos'].location,
            3,
            this.gl.FLOAT,
            false, 0,0);   
    },
    
    savedState: {
        drawColor: Color.black,
        tintColor: Color.black,
        bgTint: Color.black,
        globalAlpha: 1,
        globalTransform: 0,
        //posBuffer: 0,
    },

    save: function()
    {
        this.savedState = {
            drawColor: this.drawColor,
            tintColor: this.tintColor,
            bgTint: this.bgTint,
            globalTransform: this.globalTransform,
            globalAlpha: this.globalAlpha,
            //posBuffer: this.posBuffer
        };
    },

    restore: function()
    {
        this.drawColor = this.savedState.drawColor;
        this.tintColor = this.savedState.tintColor;
        this.bgTint = this.savedState.bgTint;
        this.globalTransform = this.savedState.globalTransform;
        //this.posBuffer = this.savedState.posBuffer;
        this.globalAlpha = this.savedState.globalAlpha;
    },

    lineTo: function(x1, y1, x2, y2)
    {
        const viewport = this.gl.getParameter(this.gl.VIEWPORT);
        let matrix = m4.projection(
            viewport[2],
            viewport[3],
            400
        );
        

        matrix = m4.multiply(matrix, this.globalTransform);
        
        this.gl.bindBuffer( this.gl.ARRAY_BUFFER, this.posBuffer );
        this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array([
            x1, y1, 0,
            x2, y2, 0,
        ]), this.gl.DYNAMIC_DRAW);
        
        this.gl.vertexAttribPointer(
            this.currentShader.vars['aPos'].location,
            3,
            this.gl.FLOAT,
            false, 0,0);   

        this.setShader("baseColor");

        this.gl.uniformMatrix4fv(this.currentShader.vars['uMatrix'].location, false, matrix);
        this.gl.uniform4f(this.currentShader.vars['uColor'].location,
            this.drawColor.r, this.drawColor.g, this.drawColor.b, this.globalAlpha);
       
        this.gl.drawArrays(this.gl.LINES, 0, 2);
    },

    lineCircle: function(x,y,w,h,z=0)
    {
        const viewport = this.gl.getParameter(this.gl.VIEWPORT);
        let matrix = m4.projection(
            viewport[2],
            viewport[3],
            400
        );
        
        matrix = m4.multiply(matrix, this.globalTransform);
        matrix = m4.multiply(matrix, m4.translation(x,y,z));
        matrix = m4.multiply(matrix, m4.scaling(w,h,1));

        this.setShader("baseColor");
        this.setMesh( this.meshes.circle );
        
        this.gl.uniformMatrix4fv(this.currentShader.vars['uMatrix'].location, false, matrix);
        this.gl.uniform4f(this.currentShader.vars['uColor'].location,
            this.drawColor.r, this.drawColor.g, this.drawColor.b, this.globalAlpha);
       
        this.gl.drawArrays(this.gl.LINE_STRIP, 0, 32);
    },

    lineRect: function(x,y,w,h,z=0)
    {
        const viewport = this.gl.getParameter(this.gl.VIEWPORT);
        let matrix = m4.projection(
            viewport[2],
            viewport[3],
            400
        );
        
        matrix = m4.multiply(matrix, this.globalTransform);
        matrix = m4.multiply(matrix, m4.translation(x,y,z));
        matrix = m4.multiply(matrix, m4.scaling(w,h,1));

        this.setShader("baseColor");
        this.setMesh( this.meshes.lineQuad );
        
        this.gl.uniformMatrix4fv(this.currentShader.vars['uMatrix'].location, false, matrix);
        this.gl.uniform4f(this.currentShader.vars['uColor'].location,
            this.drawColor.r, this.drawColor.g, this.drawColor.b, this.globalAlpha);
       
        this.gl.drawArrays(this.gl.LINE_STRIP, 0, 5);
    },

    drawRect: function(x, y, w, h, z, type=0)
    {
        const viewport = this.gl.getParameter(this.gl.VIEWPORT);
        let matrix = m4.projection(
            viewport[2],
            viewport[3],
            400
        );
        
        this.setMesh( this.meshes.quad );
        
        matrix = m4.multiply(matrix, this.globalTransform);
        matrix = m4.multiply(matrix, m4.translation(x,y,z));
        matrix = m4.multiply(matrix, m4.scaling(w,h,1));

        this.gl.uniformMatrix4fv(this.currentShader.vars['uMatrix'].location, false, matrix);
        
        this.gl.drawArrays(this.gl.TRIANGLES, 0, 6);
    },

    pushInstanceData: function(x,y,w,h, color)
    {
        this.instanceData.positions.push( {x: x, y: y, w: w, h: h} );
        this.instanceData.colors.push(...[color.r, color.g, color.b, color.a]);
        this.instanceData.numInstances++;
    },

    drawInstanceRects: function()
    {
        let gl = this.gl;

        this.setShader( "baseColor_batch" );

        let colorLoc = this.currentShader.vars["aColor"].location;
        let matrixLoc = this.currentShader.vars["aMatrix"].location;
        const vao = this.currentShader.vertexArray;

        gl.bindVertexArray(vao);
    
        this.setMesh( this.meshes.quad );
    
        // setup matrixes, one per instance
        const numInstances = this.instanceData.numInstances;
        // make a typed array with one view per matrix
        let matrixData = new Float32Array(numInstances * 16);
        let matrices = [];
        for (let i = 0; i < numInstances; ++i) {
        const byteOffsetToMatrix = i * 16 * 4;
        const numFloatsForView = 16;
        matrices.push(new Float32Array(
            matrixData.buffer,
            byteOffsetToMatrix,
            numFloatsForView));
        }
    
        const matrixBuffer = this.instanceData.matrixBuffer;
        gl.bindBuffer(gl.ARRAY_BUFFER, matrixBuffer);
        // reallocate buffer
        gl.bufferData(gl.ARRAY_BUFFER, matrixData.byteLength, gl.DYNAMIC_DRAW);
    
        // set all 4 attributes for matrix
        const bytesPerMatrix = 4 * 16;
        for (let i = 0; i < 4; ++i) 
        {
            const loc = matrixLoc + i;
            gl.enableVertexAttribArray(loc);
            // note the stride and offset
            const offset = i * 16;  // 4 floats per row, 4 bytes per float
            gl.vertexAttribPointer(
                loc,              // location
                4,                // size (num values to pull from buffer per iteration)
                gl.FLOAT,         // type of data in buffer
                false,            // normalize
                bytesPerMatrix,   // stride, num bytes to advance to get to next set of values
                offset,           // offset in buffer
            );
            // this line says this attribute only changes for each 1 instance
            gl.vertexAttribDivisor(loc, 1);
        }
    
        // setup colors, one per instance
        const colorBuffer = this.instanceData.colorBuffer;
        gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
        gl.bufferData(gl.ARRAY_BUFFER,
            new Float32Array(
                this.instanceData.colors
            ),
            gl.DYNAMIC_DRAW);

        // set attribute for color
        gl.enableVertexAttribArray(colorLoc);
        gl.vertexAttribPointer(colorLoc, 4, gl.FLOAT, false, 0, 0);
        // this line says this attribute only changes for each 1 instance
        gl.vertexAttribDivisor(colorLoc, 1);

        // store projection as a uniform as that's one less thing to calculate on the CPU side
        const viewport = this.gl.getParameter(this.gl.VIEWPORT);
        let matrix = m4.projection(
            viewport[2],
            viewport[3],
            400
        );

        gl.uniformMatrix4fv( this.currentShader.vars["uProjection"].location, false, matrix );
        
        // matrix data transformation
        for(var i = 0; i < numInstances; i++)
        {
            const p = this.instanceData.positions[i];
            m4.multiply(m4.translation(p.x, p.y, 0), 
                        m4.scaling(p.w, p.h, 1), 
                        matrices[i]);
        }
        
        // upload the new matrix data
        gl.bindBuffer(gl.ARRAY_BUFFER, matrixBuffer);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, matrixData);

        gl.drawArraysInstanced(
            gl.TRIANGLES,
            0,              // offset
            6,              // num vertices per instance
            numInstances,
        );
        
        this.instanceData.positions = [];
        this.instanceData.colors = [];
        this.instanceData.numInstances = 0;
        
    },

    fillRect: function(x, y, w, h, z=0)
    {
        this.setShader("baseColor");
        this.gl.uniform4f(this.currentShader.vars['uColor'].location,
            this.drawColor.r, this.drawColor.g, this.drawColor.b, this.globalAlpha);
        this.drawRect(x, y, w, h, z);
    },

    clearRect: function(x,y,w,h)
    {
        this.gl.enable( this.gl.SCISSOR_TEST );
        this.gl.scissor( x, y, w, h );
        this.gl.clearColor( 0, 0, 0, 0 );
        this.gl.clear( this.gl.COLOR_BUFFER_BIT );
        this.gl.disable( this.gl.SCISSOR_TEST );
    },

    setShader: function(shader)
    {
        this.currentShader = this.programs[shader];
        this.gl.bindVertexArray( this.currentShader.vertexArray );
        this.gl.useProgram(this.currentShader.program)
    },

    drawImage: function(texture, sx = 0, sy = 0, sw, sh, dx, dy, dw, dh, z=0, upsideDown = false)
    {
        if (typeof texture === "string")
        {
            texture = this.textures[texture];
        }

        if (arguments.length == 5)
        {
            // tex, dx, dy, dw, dh
            dx = sx;
            dy = sy;
            dw = sw;
            dh = sh;
            sx = 0;
            sy = 0;
            sw = texture.width;
            sh = texture.height;
        }
        if (arguments.length == 6)
        {
            // tex, dx, dy, dw, dh, z
            z = dx;
            dx = sx;
            dy = sy;
            dw = sw;
            dh = sh;
            sx = 0;
            sy = 0;
            sw = texture.width;
            sh = texture.height;
        }
        this.setShader("texture");
        if (dw === undefined)
        {
            dw = texture.width;
        }
        if (dh === undefined)
        {
            dh = texture.height;
        }
        if (sx === undefined) sx = 0;
        if (sy === undefined) sy = 0;
        if (sw === undefined) sw = texture.width;
        if (sh === undefined) sh = texture.height;
        if (dx === undefined) dx = 0;
        if (dy === undefined) dy = 0;
        
        this.gl.activeTexture(this.gl.TEXTURE0);
        this.gl.bindTexture(this.gl.TEXTURE_2D, texture.texture);

        this.gl.uniform1i(this.currentShader.vars['uTexture'].location, 0);
        this.gl.uniform4f(this.currentShader.vars['uColor'].location,
            this.tintColor.r,
            this.tintColor.g,
            this.tintColor.b,
            this.globalAlpha);
        
        this.gl.uniform1i(this.currentShader.vars['uUpsideDown'].location, upsideDown ? 1 : 0);

        let texmatrix = m3.translation(sx / texture.width, sy / texture.height);
        texmatrix = m3.multiply(texmatrix, m3.scale(sw / texture.width, sh / texture.height));
        this.gl.uniformMatrix3fv(this.currentShader.vars['uTexMatrix'].location, false, texmatrix);
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.posBuffer);

        this.drawRect(dx, dy, dw, dh, z);
    },

    getImageData: function(x, y, width, height) 
    {
        const pixels = new Uint8Array(width * height * 4); // RGBA
        this.gl.readPixels(x, y, width, height, this.gl.RGBA, this.gl.UNSIGNED_BYTE, pixels);
        
        return { width: width, height: height, data: pixels };
    },

    // expects { width, height, data (ubyte rgba list) }
    putImageData: function(img, x, y) 
    {
        let texture = this.createGLTexture( img.width, img.height, this.gl.RGBA, this.gl.UNSIGNED_BYTE, img.data );
        this.gl.disable( this.gl.BLEND );
        
        this.setShader("texture");
        this.gl.uniform1i( this.currentShader.vars["overwriteAlpha"].location, 1 );
        Graphics.drawImage( { width: img.width, height: img.height, texture: texture }, x, y);
        this.gl.uniform1i( this.currentShader.vars["overwriteAlpha"].location, 0 );

        this.gl.enable( this.gl.BLEND );

        this.gl.deleteTexture(texture);
    },

    loadTexture: function(src, name)
    {
        let tex = this.gl.createTexture();
        
        this.gl.bindTexture(this.gl.TEXTURE_2D, tex);

        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.REPEAT);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.REPEAT);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.NEAREST);

        let textureObj = {
            width: 1,
            height: 1,
            texture: tex
        };

        if (typeof src === "string")
        {
            let img = new Image();
            this.imageLoadCount++;
    
            img.crossOrigin = "anonymous";

            img.onload = function()
            {
                textureObj.width = img.width,
                textureObj.height = img.height;

                Graphics.gl.bindTexture(Graphics.gl.TEXTURE_2D, textureObj.texture);
                Graphics.gl.texImage2D(Graphics.gl.TEXTURE_2D, 0, Graphics.gl.RGBA, Graphics.gl.RGBA, Graphics.gl.UNSIGNED_BYTE, img);
                Graphics.gl.generateMipmap(Graphics.gl.TEXTURE_2D);
                Graphics.textures[name] = textureObj;
                //incLoader();
            }
            img.src = src;
        }
        else
        {
            console.log("LOAD IMAGE: \nSRC: " + src + "\nWIDTH: " + src.width + "\nHEIGHT: " + src.height + "\nNAME: " + name);
            textureObj.width = src.width,
            textureObj.height = src.height;

            this.gl.bindTexture(this.gl.TEXTURE_2D, textureObj.texture);
            this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, this.gl.RGBA, this.gl.UNSIGNED_BYTE, src);
            console.log(textureObj);
            this.textures[name] = textureObj;
        }
    },

    queueTextureUpdate: function(textureName, source, width=-1, height=-1)
    {
        this.queues.textures.push({name: textureName, source: source, width: width, height: height});
    },

    updateTexture: function(textureName, source)
    {
        let gl = this.gl;
        const level = 0;
        const internalFormat = gl.RGBA;
        const srcFormat = gl.RGBA;
        const srcType = gl.UNSIGNED_BYTE;
        gl.bindTexture(gl.TEXTURE_2D, this.textures[textureName].texture);
        gl.texImage2D(
          gl.TEXTURE_2D,
          level,
          internalFormat,
          srcFormat,
          srcType,
          source,
        );
    },
    
    updateTextures: function()
    {
        this.queues.textures.forEach( texture => {
            this.updateTexture(texture.name, texture.source);
            
            if (texture.width != -1)
                this.textures[texture.name].width = texture.width;
            if (texture.height != -1)
                this.textures[texture.name].height = texture.height;
            
        } )

        this.queues.textures = [];
    },

    createRenderTarget: function(name, width, height)
    {
        const glTexture = this.createGLTexture( width, height );
        
        const texture = {
            name: name,
            width: width,
            height: height,
            texture: glTexture
        };
        this.textures[name] = texture;

        const FBO = this.gl.createFramebuffer();
        this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, FBO);
        this.gl.framebufferTexture2D(
            this.gl.FRAMEBUFFER,
            this.gl.COLOR_ATTACHMENT0,
            this.gl.TEXTURE_2D,
            texture.texture,
            0
        );

        const renderTarget = {
            fbo: FBO,
            texture: texture
        };

        this.renderTargets[name] = renderTarget;
        //console.log(name, renderTarget);

        return renderTarget;
    },

    setRenderTarget: function(name)
    {
        const isNull = name == null;
        const rt = isNull ? null : this.renderTargets[name]
        const fbo = isNull ? null : this.renderTargets[name].fbo;
        this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, fbo);
        this.currentRenderTarget = rt;
        if (isNull)
        {
            this.gl.viewport(0, 0, this.gl.canvas.width, this.gl.canvas.height);
        } else {
            this.gl.viewport(0, 0, rt.texture.width, rt.texture.height);
        }
    },

    deleteRenderTarget: function(name)
    {
        if (!this.renderTargets[name])
            return;
        //console.log(this.renderTargets[name]);
        this.gl.deleteTexture( this.renderTargets[name].texture.texture );
        this.gl.deleteFramebuffer( this.renderTargets[name].fbo );
        this.renderTargets[name] = null;
        this.textures[name] = null;
    },

    drawText: function(string, x, y)
    {     
        this.setShader("texture");
        let texture = this.textures["sprsheet"];
        let origColor = this.tintColor;
        
        this.gl.activeTexture(this.gl.TEXTURE0);
        this.gl.bindTexture(this.gl.TEXTURE_2D, texture.texture);
        this.gl.uniform2f(this.currentShader.vars['uResolution'].location, this.gl.canvas.width, this.gl.canvas.height);
        this.gl.uniform1i(this.currentShader.vars['uTexture'].location, 0);
        
        let offsetX = 0;
        let offsetY = 0;

        for(var i = 0; i < string.length; i++)
        {
            let char = string.charAt(i).toLowerCase();
            if (char == '\\')
            {
                i+=1;
                char = string.charAt(i).toLowerCase();

                switch(char)
                {
                    case "r": this.tintColor = Color.red; break;
                    case "g": this.tintColor = Color.green; break;
                    case "b": this.tintColor = Color.blue; break;
                    case "y": this.tintColor = Color.yellow; break;
                    case "w": this.tintColor = Color.white; break;
                    case "n": this.tintColor = new Color("#888888"); break;
                }
                
                continue;
            }

            if (char == '\n')
            {
                offsetX = 0;
                offsetY += 1;
                continue;
            }
            
            if (char == ' ')
            {
                offsetX += 1;
                continue; 
            }

            let index = "abcdefghijklmnopqrstuvwxyz[]():;!^*/0123456789\"\',.".indexOf(char);
            if (index == -1)
                continue;
        
            let sx = 104 + 4 * (index % 9);
            let sy = 6 * Math.floor(index / 9);
            let sw = 5;
            let sh = 7;

            this.gl.uniform4f(this.currentShader.vars['uColor'].location,
                this.tintColor.r,
                this.tintColor.g,
                this.tintColor.b,
                this.globalAlpha);

            let texmatrix = m3.translation(sx / texture.width, sy / texture.height);
            texmatrix = m3.multiply(texmatrix, m3.scale(sw / texture.width, sh / texture.height));
            this.gl.uniformMatrix3fv(this.currentShader.vars['uTexMatrix'].location, false, texmatrix);
            this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.posBuffer);
            this.drawRect(x + offsetX * (sw-1), y + offsetY * sh, sw, sh, -100);
            offsetX += 1;
        }
        this.tintColor = origColor;
    },

    translate: function(x, y, z=0)
    {
        this.globalTransform = m4.multiply(this.globalTransform, m4.translation(x,y,z))
        //this.globalTransform = m3.multiply(this.globalTransform, m3.translation(x, y));
    },

    rotate: function(radX=0, radY=0, radZ=0)
    {
        // "flat" rotation
        if (arguments.length == 1)
        {
            radZ = radX;
            radX = 0;
        }

        this.globalTransform = m4.multiply(this.globalTransform, m4.xRotation(radX));
        this.globalTransform = m4.multiply(this.globalTransform, m4.yRotation(radY));
        this.globalTransform = m4.multiply(this.globalTransform, m4.zRotation(radZ));
        //this.globalTransform = m3.multiply(this.globalTransform, m3.rotation(radAngle));
    },
    
    scale: function(w, h)
    {
        this.globalTransform = m4.multiply(this.globalTransform, m4.scaling(w, h, 1));  
    },

    resetTransform: function()
    {
        this.globalTransform = m4.identity();
    },

    // BINDS THE GL TEXTURE AND DOES NOT RETURN IT! CAREFUL!!
    createGLTexture: function(width, height, aformat = undefined, atype = undefined, data = null)
    {
        const rTexture = this.gl.createTexture();
        this.gl.bindTexture(this.gl.TEXTURE_2D, rTexture);
        const level = 0;
        const internalFormat = aformat == undefined ? this.gl.RGBA : aformat;
        const border = 0;
        const format = internalFormat;
        const type = atype == undefined ? this.gl.UNSIGNED_BYTE : atype;
        this.gl.texImage2D(this.gl.TEXTURE_2D, level, internalFormat,
                      width, height, border,
                      format, type, data);

        
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.REPEAT);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.REPEAT);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.NEAREST);

        return rTexture;
    },
    
    setup: function(igl)
    {
        this.gl = igl;
        this.posBuffer = this.gl.createBuffer();

        this.meshes.quad = this.gl.createBuffer();
        this.meshes.lineQuad = this.gl.createBuffer();
        this.meshes.line = this.gl.createBuffer();
        this.meshes.circle = this.gl.createBuffer();

        this.gl.bindBuffer( this.gl.ARRAY_BUFFER, this.meshes.quad );
        this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array([
            0, 0, 0,
            0, 1, 0,
            1, 1, 0,
            1, 1, 0,
            1, 0, 0,
            0, 0, 0
        ]), this.gl.STATIC_DRAW);

        this.gl.bindBuffer( this.gl.ARRAY_BUFFER, this.meshes.lineQuad );
        this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array([
            0, 0, 0,
            0, 1, 0,
            1, 1, 0,
            1, 0, 0,
            0, 0, 0
        ]), this.gl.STATIC_DRAW);

        this.gl.bindBuffer( this.gl.ARRAY_BUFFER, this.meshes.circle );
        let circleMesh = new Float32Array(32*3);
        for( let i = 0; i < circleMesh.length; i+=3)
        {
            circleMesh[ i ] = 0.5 * Math.sin( Math.PI * 2 * i/(circleMesh.length-3) ) + 0.5;
            circleMesh[i+1] = 0.5 * Math.cos( Math.PI * 2 * i/(circleMesh.length-3) ) + 0.5;
            circleMesh[i+2] = 0;
        }
        this.gl.bufferData(this.gl.ARRAY_BUFFER, circleMesh, this.gl.STATIC_DRAW);

        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.posBuffer);
            

        Object.keys(this.shaders).forEach(shader => {
            this.programs[shader] = this.generateProgram(shader);
            console.log(`\nPROGRAM '${shader}':`);
            console.log(this.programs[shader]);
        });

        this.setShader("baseColor");
        this.gl.uniform4f(this.programs["baseColor"].vars['uColor'].location, 
                          1, 1, 1, 1);
    
        if (this.globalTransform == 0) this.globalTransform = m4.identity();


        // framebuffer creation
        const depthTexture = this.gl.createTexture();
        this.gl.bindTexture(this.gl.TEXTURE_2D, depthTexture);
        
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.REPEAT);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.REPEAT);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.NEAREST);
        const gl = this.gl;
        gl.texImage2D(
            gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT24, 
            this.gl.canvas.width, this.gl.canvas.height, 0,
            gl.DEPTH_COMPONENT, gl.UNSIGNED_INT, null);
        
        this.textures["screenBuffer"] = {
            width: this.gl.canvas.width,
            height: this.gl.canvas.height,
            texture: this.createGLTexture(this.gl.canvas.width, this.gl.canvas.height)
        };

        const screenFBO = this.gl.createFramebuffer();
        this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, screenFBO);
        this.gl.framebufferTexture2D(
            this.gl.FRAMEBUFFER,
            this.gl.COLOR_ATTACHMENT0,
            this.gl.TEXTURE_2D,
            this.textures["screenBuffer"].texture,
            0
        );

        this.gl.framebufferTexture2D(
            this.gl.FRAMEBUFFER,
            this.gl.DEPTH_ATTACHMENT,
            this.gl.TEXTURE_2D,
            depthTexture,
            0
        );

        this.renderTargets["screenBuffer"] = {
            fbo: screenFBO,
            texture: this.textures["screenBuffer"]
        }

        this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);

        this.instanceData.matrixBuffer = this.gl.createBuffer();
        this.instanceData.colorBuffer = this.gl.createBuffer();
    },

    createShader: function(type, src)
    {
        let shader = this.gl.createShader(type);
        this.gl.shaderSource(shader, src);
        this.gl.compileShader(shader);
        let woke = this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS);
        if (woke) 
            return shader;
    
        console.error(this.gl.getShaderInfoLog(shader));
        this.gl.deleteShader(shader);
    },
    
    createProgram: function(vert, frag)
    {
        let program = this.gl.createProgram();
        this.gl.attachShader(program, vert);
        this.gl.attachShader(program, frag);
        this.gl.linkProgram(program);
        let woke = this.gl.getProgramParameter(program, this.gl.LINK_STATUS)

        if (woke) 
            return program;
    
        console.log(this.gl.getProgramInfoLog(program));
        this.gl.deleteProgram(program);
    },
    
    generateProgram: function(index)
    {
        let vertShader = this.createShader(this.gl.VERTEX_SHADER, this.shaders[index].vert);
        let fragShader = this.createShader(this.gl.FRAGMENT_SHADER, this.shaders[index].frag);
    
        let program = this.createProgram(vertShader, fragShader);

        // optimiztaion: create a static position buffer for certain builtin-shaders
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.meshes.quad);
        
        let vertArray = this.gl.createVertexArray();
        this.gl.bindVertexArray(vertArray);
        let vars = {};
        // start finding vars...
        let vertstr = this.shaders[index].vert;
        let fragstr = this.shaders[index].frag;

        let vertvars = vertstr.split("\n")
                              .map(x => x.trim())
                              .map(x => x.split(' '))
                              .filter( x => "uniform, attribute, in".split(", ").indexOf(x[0]) != -1)
                              .map( x => x.map(y => y.replace(";", "")) 
                            )

        let fragvars = fragstr.split("\n")
                              .map(x => x.trim())
                              .map(x => x.split(' '))
                              .filter( x => "uniform, attribute, in".split(", ").indexOf(x[0]) != -1)
                              .map( x => 
                                x.map(y => y.replace(";", "")) 
                            )

        console.log("fragvars", fragvars);
        let curVar = null,
            varLocation = null,
            buffers = [];

        for (let x = 0; x < vertvars.length; x++)
        {
            curVar = vertvars[x];

            if (curVar[0] == 'uniform')
            {
                varLocation = this.gl.getUniformLocation(program, curVar[2]);
            }
            else if (curVar[0] == 'attribute' || curVar[0] == 'in')
            {
                varLocation = this.gl.getAttribLocation(program, curVar[2]);
                this.gl.enableVertexAttribArray(varLocation);
                var size = 3;          // 3 components per iteration
                var type = this.gl.FLOAT;   // the data is 32bit floats
                var normalize = false; // don't normalize the data
                var stride = 0;        // 0 = move forward size * sizeof(type) each iteration to get the next position
                var offset = 0;        // start at the beginning of the buffer              
                this.gl.vertexAttribPointer(
                    varLocation, size, type, normalize, stride, offset);              
            }
    
            vars[curVar[2]] = {
                location: varLocation,
                type: curVar[1],
            };
        }

        for (let x = 0; x < fragvars.length; x++)
        {
            curVar = fragvars[x];

            if (curVar[0] === 'uniform')
                varLocation = this.gl.getUniformLocation(program, curVar[2]);
            else if (curVar[0] === 'attribute' || curVar[0] === 'in')
                varLocation = this.gl.getAttribLocation(program, curVar[2]);
    
            vars[curVar[2]] = {
                location: varLocation,
                type: curVar[1],
            };
        }
        console.log(vars)
        return { program: program, vars: vars, vertexArray: vertArray };
    },

    currentShader: null,
    currentRenderTarget: null,

    shaders:
    {
        "baseColor":
        {
            vert: `#version 300 es
                    in vec4 aPos;
                    uniform mat4 uMatrix;
                    
                    void main()
                    {
                        gl_Position = uMatrix * aPos;
                    }`,

            frag: `#version 300 es
                    precision mediump float;
                    
                    uniform vec4 uColor;
                    out vec4 col;
                    void main()
                    {
                        col = uColor;
                    }`,
        },

        "texture":
        {
            vert: `#version 300 es
                    in vec4 aPos;
                    in vec2 aTexcoord;
                    
                    uniform vec2 uResolution;
                    uniform mat4 uMatrix;
                    uniform mat3 uTexMatrix;

                    out vec2 vTexcoord;
                    
                    void main()
                    {
                        gl_Position = uMatrix * aPos;
                        vTexcoord = (uTexMatrix * vec3(aTexcoord, 1)).xy;
                    }`,

            frag: `#version 300 es

                    precision mediump float;
                    
                    in vec2 vTexcoord;
                    uniform sampler2D uTexture;
                    uniform bool overwriteAlpha;
                    uniform bool uUpsideDown;

                    out vec4 outCol;
                    uniform vec4 uColor;

                    void main()
                    {
                        vec2 uv = vTexcoord;
                        if (uUpsideDown)
                            uv.y = 1.0 - uv.y;
                        
                        if (overwriteAlpha)
                            uv.y *= -1.0;
                        outCol = texture(uTexture, uv);
                        if (outCol.a < 0.0000001 && !overwriteAlpha)
                            discard;
                        outCol.rgb *= uColor.rgb;
                        //outCol.rgb = vec3(vTexcoord.xy,0.0);
                        outCol.a *= uColor.a;
                    }`
        },

        "texture_dither":
        {
            vert: `#version 300 es
                    in vec4 aPos;
                    in vec2 aTexcoord;
                    
                    uniform vec2 uResolution;
                    uniform mat4 uMatrix;
                    uniform mat3 uTexMatrix;

                    out vec2 vTexcoord;
                    
                    void main()
                    {
                        gl_Position = uMatrix * aPos;
                        vTexcoord = (uTexMatrix * vec3(aTexcoord, 1)).xy;
                    }`,

            frag: `#version 300 es

                    precision mediump float;
                    
                    in vec2 vTexcoord;
                    uniform sampler2D uTexture;
                    uniform bool overwriteAlpha;
                    uniform bool uUpsideDown;

                    out vec4 outCol;
                    uniform float snapAmt;

                    float IGN(vec2 pixel)
                    {
                        return mod(52.9829189 * mod(0.06711056*pixel.x + 0.00583715*pixel.y, 1.0), 1.0);
                    }

                    void main()
                    {
                        vec2 uv = vTexcoord;
                        if (uUpsideDown)
                            uv.y = 1.0 - uv.y;

                        outCol = texture(uTexture, uv);
                        if (outCol.a < 0.01 && !overwriteAlpha)
                            discard;

                        //outCol.rgb *= uColor.rgb;
                        //outCol.rgb = vec3(vTexcoord.xy,0.0);

                        outCol.rgb -= IGN(gl_FragCoord.xy) * 0.05;
                        outCol.rgb = round(outCol.rgb * snapAmt) / snapAmt;
                        
                        //outCol = vec4(vec3(outCol.a), 1.0);
                    }`
        },


        "layerOp":
        {
            vert: `#version 300 es
                    in vec4 aPos;
                    in vec2 aTexcoord;
                    
                    uniform vec2 uResolution;
                    uniform mat4 uMatrix;
                    uniform mat3 uTexMatrix;

                    out vec2 vTexcoord;
                    
                    void main()
                    {
                        gl_Position = uMatrix * aPos;
                        vTexcoord = (uTexMatrix * vec3(aTexcoord, 1)).xy;
                    }`,

            frag: `#version 300 es
                    #define BM_NORMAL 0
                    #define BM_ERASE 1
                    #define BM_ADD 2
                    #define BM_MULTIPLY 3
                    

                    precision highp float;
                    
                    in vec2 vTexcoord;
                    uniform sampler2D layerTop;
                    uniform sampler2D layerBottom;
                    uniform sampler2D lut;
                    uniform int layerOperation;
                    uniform float topAlpha;

                    out vec4 outCol;
                    uniform vec4 uColor;

                    //  MIT License
                    //
                    //  Copyright (c) 2023 Ronald van Wijnen
                    //
                    //  Permission is hereby granted, free of charge, to any person obtaining a
                    //  copy of this software and associated documentation files (the "Software"),
                    //  to deal in the Software without restriction, including without limitation
                    //  the rights to use, copy, modify, merge, publish, distribute, sublicense,
                    //  and/or sell copies of the Software, and to permit persons to whom the
                    //  Software is furnished to do so, subject to the following conditions:
                    //
                    //  The above copyright notice and this permission notice shall be included in
                    //  all copies or substantial portions of the Software.
                    //
                    //  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
                    //  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
                    //  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
                    //  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
                    //  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
                    //  FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
                    //  DEALINGS IN THE SOFTWARE.

                    #ifndef SPECTRAL
                    #define SPECTRAL

                    const int SPECTRAL_SIZE = 38;
                    const float SPECTRAL_GAMMA = 2.4;
                    const float SPECTRAL_EPSILON = 0.0001;

                    float spectral_uncompand(float x) {
                    return (x < 0.04045) ? x / 12.92 : pow((x + 0.055) / 1.055, SPECTRAL_GAMMA);
                    }

                    float spectral_compand(float x) {
                    return (x < 0.0031308) ? x * 12.92 : 1.055 * pow(x, 1.0 / SPECTRAL_GAMMA) - 0.055;
                    }

                    vec3 spectral_srgb_to_linear(vec3 srgb) {
                        return vec3(spectral_uncompand(srgb[0]), spectral_uncompand(srgb[1]), spectral_uncompand(srgb[2]));
                    }

                    vec3 spectral_linear_to_srgb(vec3 lrgb) {
                        return clamp(vec3(spectral_compand(lrgb[0]), spectral_compand(lrgb[1]), spectral_compand(lrgb[2])), 0.0, 1.0);
                    }

                    void spectral_upsampling(vec3 lrgb, out float w, out float c, out float m, out float y, out float r, out float g, out float b) {
                        w = min(lrgb.r, min(lrgb.g, lrgb.b));

                        lrgb -= w;

                        c = min(lrgb.g, lrgb.b);
                        m = min(lrgb.r, lrgb.b);
                        y = min(lrgb.r, lrgb.g);
                        r = min(max(0., lrgb.r - lrgb.b), max(0., lrgb.r - lrgb.g));
                        g = min(max(0., lrgb.g - lrgb.b), max(0., lrgb.g - lrgb.r));
                        b = min(max(0., lrgb.b - lrgb.g), max(0., lrgb.b - lrgb.r));
                    }

                    void spectral_linear_to_reflectance(vec3 lrgb, inout float R[SPECTRAL_SIZE]) {
                        float w, c, m, y, r, g, b;
                        
                        spectral_upsampling(lrgb, w, c, m, y, r, g, b);
                        
                        R[0] = max(SPECTRAL_EPSILON, w + c * 0.96853629 + m * 0.51567122 + y * 0.02055257 + r * 0.03147571 + g * 0.49108579 + b * 0.97901834);
                        R[1] = max(SPECTRAL_EPSILON, w + c * 0.96855103 + m * 0.54015520 + y * 0.02059936 + r * 0.03146636 + g * 0.46944057 + b * 0.97901649);
                        R[2] = max(SPECTRAL_EPSILON, w + c * 0.96859338 + m * 0.62645502 + y * 0.02062723 + r * 0.03140624 + g * 0.40165780 + b * 0.97901118);
                        R[3] = max(SPECTRAL_EPSILON, w + c * 0.96877345 + m * 0.75595012 + y * 0.02073387 + r * 0.03119611 + g * 0.24490420 + b * 0.97892146);
                        R[4] = max(SPECTRAL_EPSILON, w + c * 0.96942204 + m * 0.92826996 + y * 0.02114202 + r * 0.03053888 + g * 0.06826880 + b * 0.97858555);
                        R[5] = max(SPECTRAL_EPSILON, w + c * 0.97143709 + m * 0.97223624 + y * 0.02233154 + r * 0.02856855 + g * 0.02732883 + b * 0.97743705);
                        R[6] = max(SPECTRAL_EPSILON, w + c * 0.97541862 + m * 0.98616174 + y * 0.02556857 + r * 0.02459485 + g * 0.01360600 + b * 0.97428075);
                        R[7] = max(SPECTRAL_EPSILON, w + c * 0.98074186 + m * 0.98955255 + y * 0.03330189 + r * 0.01929520 + g * 0.01000187 + b * 0.96663223);
                        R[8] = max(SPECTRAL_EPSILON, w + c * 0.98580992 + m * 0.98676237 + y * 0.05185294 + r * 0.01423112 + g * 0.01284127 + b * 0.94822893);
                        R[9] = max(SPECTRAL_EPSILON, w + c * 0.98971194 + m * 0.97312575 + y * 0.10087639 + r * 0.01033111 + g * 0.02636635 + b * 0.89937713);
                        R[10] = max(SPECTRAL_EPSILON, w + c * 0.99238027 + m * 0.91944277 + y * 0.24000413 + r * 0.00765876 + g * 0.07058713 + b * 0.76070164);
                        R[11] = max(SPECTRAL_EPSILON, w + c * 0.99409844 + m * 0.32564851 + y * 0.53589066 + r * 0.00593693 + g * 0.70421692 + b * 0.46420440);
                        R[12] = max(SPECTRAL_EPSILON, w + c * 0.99517200 + m * 0.13820628 + y * 0.79874659 + r * 0.00485616 + g * 0.85473994 + b * 0.20123039);
                        R[13] = max(SPECTRAL_EPSILON, w + c * 0.99576545 + m * 0.05015143 + y * 0.91186529 + r * 0.00426186 + g * 0.95081565 + b * 0.08808402);
                        R[14] = max(SPECTRAL_EPSILON, w + c * 0.99593552 + m * 0.02912336 + y * 0.95399623 + r * 0.00409039 + g * 0.97170370 + b * 0.04592894);
                        R[15] = max(SPECTRAL_EPSILON, w + c * 0.99564041 + m * 0.02421691 + y * 0.97137099 + r * 0.00438375 + g * 0.97651888 + b * 0.02860373);
                        R[16] = max(SPECTRAL_EPSILON, w + c * 0.99464769 + m * 0.02660696 + y * 0.97939505 + r * 0.00537525 + g * 0.97429245 + b * 0.02060067);
                        R[17] = max(SPECTRAL_EPSILON, w + c * 0.99229579 + m * 0.03407586 + y * 0.98345207 + r * 0.00772962 + g * 0.97012917 + b * 0.01656701);
                        R[18] = max(SPECTRAL_EPSILON, w + c * 0.98638762 + m * 0.04835936 + y * 0.98553736 + r * 0.01366120 + g * 0.94258630 + b * 0.01451549);
                        R[19] = max(SPECTRAL_EPSILON, w + c * 0.96829712 + m * 0.00011720 + y * 0.98648905 + r * 0.03181352 + g * 0.99989207 + b * 0.01357964);
                        R[20] = max(SPECTRAL_EPSILON, w + c * 0.89228016 + m * 0.00008554 + y * 0.98674535 + r * 0.10791525 + g * 0.99989891 + b * 0.01331243);
                        R[21] = max(SPECTRAL_EPSILON, w + c * 0.53740239 + m * 0.85267882 + y * 0.98657555 + r * 0.46249516 + g * 0.13823139 + b * 0.01347661);
                        R[22] = max(SPECTRAL_EPSILON, w + c * 0.15360445 + m * 0.93188793 + y * 0.98611877 + r * 0.84604333 + g * 0.06968113 + b * 0.01387181);
                        R[23] = max(SPECTRAL_EPSILON, w + c * 0.05705719 + m * 0.94810268 + y * 0.98559942 + r * 0.94275572 + g * 0.05628787 + b * 0.01435472);
                        R[24] = max(SPECTRAL_EPSILON, w + c * 0.03126539 + m * 0.94200977 + y * 0.98507063 + r * 0.96860996 + g * 0.06111561 + b * 0.01479836);
                        R[25] = max(SPECTRAL_EPSILON, w + c * 0.02205445 + m * 0.91478045 + y * 0.98460039 + r * 0.97783966 + g * 0.08987709 + b * 0.01515250);
                        R[26] = max(SPECTRAL_EPSILON, w + c * 0.01802271 + m * 0.87065445 + y * 0.98425301 + r * 0.98187757 + g * 0.13656016 + b * 0.01540513);
                        R[27] = max(SPECTRAL_EPSILON, w + c * 0.01613460 + m * 0.78827548 + y * 0.98403909 + r * 0.98377315 + g * 0.22169624 + b * 0.01557233);
                        R[28] = max(SPECTRAL_EPSILON, w + c * 0.01520947 + m * 0.65738359 + y * 0.98388535 + r * 0.98470202 + g * 0.32176956 + b * 0.01565710);
                        R[29] = max(SPECTRAL_EPSILON, w + c * 0.01475977 + m * 0.59909403 + y * 0.98376116 + r * 0.98515481 + g * 0.36157329 + b * 0.01571025);
                        R[30] = max(SPECTRAL_EPSILON, w + c * 0.01454263 + m * 0.56817268 + y * 0.98368246 + r * 0.98537114 + g * 0.48361920 + b * 0.01571916);
                        R[31] = max(SPECTRAL_EPSILON, w + c * 0.01444459 + m * 0.54031997 + y * 0.98365023 + r * 0.98546685 + g * 0.46488579 + b * 0.01572133);
                        R[32] = max(SPECTRAL_EPSILON, w + c * 0.01439897 + m * 0.52110241 + y * 0.98361309 + r * 0.98550011 + g * 0.47440306 + b * 0.01572502);
                        R[33] = max(SPECTRAL_EPSILON, w + c * 0.01437620 + m * 0.51041094 + y * 0.98357259 + r * 0.98551031 + g * 0.48576990 + b * 0.01571717);
                        R[34] = max(SPECTRAL_EPSILON, w + c * 0.01436343 + m * 0.50526577 + y * 0.98353856 + r * 0.98550741 + g * 0.49267971 + b * 0.01571905);
                        R[35] = max(SPECTRAL_EPSILON, w + c * 0.01435687 + m * 0.50255080 + y * 0.98351247 + r * 0.98551323 + g * 0.49625685 + b * 0.01571059);
                        R[36] = max(SPECTRAL_EPSILON, w + c * 0.01435370 + m * 0.50126452 + y * 0.98350101 + r * 0.98551563 + g * 0.49807754 + b * 0.01569728);
                        R[37] = max(SPECTRAL_EPSILON, w + c * 0.01435408 + m * 0.50083021 + y * 0.98350852 + r * 0.98551547 + g * 0.49889859 + b * 0.01570020);
                    }

                    vec3 spectral_xyz_to_srgb(vec3 xyz) {
                        mat3 XYZ_RGB;

                        XYZ_RGB[0] = vec3( 3.24306333, -1.53837619, -0.49893282);
                        XYZ_RGB[1] = vec3(-0.96896309,  1.87542451,  0.04154303);
                        XYZ_RGB[2] = vec3( 0.05568392, -0.20417438,  1.05799454);
                        
                        float r = dot(XYZ_RGB[0], xyz);
                        float g = dot(XYZ_RGB[1], xyz);
                        float b = dot(XYZ_RGB[2], xyz);

                        return spectral_linear_to_srgb(vec3(r, g, b));
                    }

                    vec3 spectral_reflectance_to_xyz(float R[SPECTRAL_SIZE]) {
                        vec3 xyz = vec3(0.0);
                        
                        xyz +=  R[0] * vec3(0.00006469, 0.00000184, 0.00030502);
                        xyz +=  R[1] * vec3(0.00021941, 0.00000621, 0.00103681);
                        xyz +=  R[2] * vec3(0.00112057, 0.00003101, 0.00531314);
                        xyz +=  R[3] * vec3(0.00376661, 0.00010475, 0.01795439);
                        xyz +=  R[4] * vec3(0.01188055, 0.00035364, 0.05707758);
                        xyz +=  R[5] * vec3(0.02328644, 0.00095147, 0.11365162);
                        xyz +=  R[6] * vec3(0.03455942, 0.00228226, 0.17335873);
                        xyz +=  R[7] * vec3(0.03722379, 0.00420733, 0.19620658);
                        xyz +=  R[8] * vec3(0.03241838, 0.00668880, 0.18608237);
                        xyz +=  R[9] * vec3(0.02123321, 0.00988840, 0.13995048);
                        xyz += R[10] * vec3(0.01049099, 0.01524945, 0.08917453);
                        xyz += R[11] * vec3(0.00329584, 0.02141831, 0.04789621);
                        xyz += R[12] * vec3(0.00050704, 0.03342293, 0.02814563);
                        xyz += R[13] * vec3(0.00094867, 0.05131001, 0.01613766);
                        xyz += R[14] * vec3(0.00627372, 0.07040208, 0.00775910);
                        xyz += R[15] * vec3(0.01686462, 0.08783871, 0.00429615);
                        xyz += R[16] * vec3(0.02868965, 0.09424905, 0.00200551);
                        xyz += R[17] * vec3(0.04267481, 0.09795667, 0.00086147);
                        xyz += R[18] * vec3(0.05625475, 0.09415219, 0.00036904);
                        xyz += R[19] * vec3(0.06947040, 0.08678102, 0.00019143);
                        xyz += R[20] * vec3(0.08305315, 0.07885653, 0.00014956);
                        xyz += R[21] * vec3(0.08612610, 0.06352670, 0.00009231);
                        xyz += R[22] * vec3(0.09046614, 0.05374142, 0.00006813);
                        xyz += R[23] * vec3(0.08500387, 0.04264606, 0.00002883);
                        xyz += R[24] * vec3(0.07090667, 0.03161735, 0.00001577);
                        xyz += R[25] * vec3(0.05062889, 0.02088521, 0.00000394);
                        xyz += R[26] * vec3(0.03547396, 0.01386011, 0.00000158);
                        xyz += R[27] * vec3(0.02146821, 0.00810264, 0.00000000);
                        xyz += R[28] * vec3(0.01251646, 0.00463010, 0.00000000);
                        xyz += R[29] * vec3(0.00680458, 0.00249138, 0.00000000);
                        xyz += R[30] * vec3(0.00346457, 0.00125930, 0.00000000);
                        xyz += R[31] * vec3(0.00149761, 0.00054165, 0.00000000);
                        xyz += R[32] * vec3(0.00076970, 0.00027795, 0.00000000);
                        xyz += R[33] * vec3(0.00040737, 0.00014711, 0.00000000);
                        xyz += R[34] * vec3(0.00016901, 0.00006103, 0.00000000);
                        xyz += R[35] * vec3(0.00009522, 0.00003439, 0.00000000);
                        xyz += R[36] * vec3(0.00004903, 0.00001771, 0.00000000);
                        xyz += R[37] * vec3(0.00002000, 0.00000722, 0.00000000);

                        return xyz;
                    }

                    float spectral_linear_to_concentration(float l1, float l2, float t) {
                        float t1 = l1 * pow(1.0 - t, 2.0);
                        float t2 = l2 * pow(t, 2.0);

                        return t2 / (t1 + t2);
                    }

                    vec3 spectral_mix(vec3 color1, vec3 color2, float t) {
                        vec3 lrgb1 = spectral_srgb_to_linear(color1);
                        vec3 lrgb2 = spectral_srgb_to_linear(color2);

                        float R1[SPECTRAL_SIZE];
                        float R2[SPECTRAL_SIZE];

                        spectral_linear_to_reflectance(lrgb1, R1);
                        spectral_linear_to_reflectance(lrgb2, R2);

                        float l1 = spectral_reflectance_to_xyz(R1)[1];
                        float l2 = spectral_reflectance_to_xyz(R2)[1];

                        t = spectral_linear_to_concentration(l1, l2, t);

                        float R[SPECTRAL_SIZE];

                        for (int i = 0; i < SPECTRAL_SIZE; i++) {
                        float KS = (1.0 - t) * (pow(1.0 - R1[i], 2.0) / (2.0 * R1[i])) + t * (pow(1.0 - R2[i], 2.0) / (2.0 * R2[i]));
                        float KM = 1.0 + KS - sqrt(pow(KS, 2.0) + 2.0 * KS);

                        //Saunderson correction
                        // let S = ((1.0 - K1) * (1.0 - K2) * KM) / (1.0 - K2 * KM);

                        R[i] = KM;
                        }

                        return spectral_xyz_to_srgb(spectral_reflectance_to_xyz(R));
                    }

                    vec4 spectral_mix(vec4 color1, vec4 color2, float t) {
                        return vec4(spectral_mix(color1.rgb, color2.rgb, t), mix(color1.a, color2.a, t));
                    }

                    #endif

                    void main()
                    {
                        vec2 uv = vTexcoord;
                        vec4 inCol = texture(layerBottom, uv);
                        vec4 topCol = texture(layerTop, uv);
                        topCol.a *= topAlpha;
                        float alpha = 0.0;

                        switch(layerOperation)
                        {
                            case BM_MULTIPLY:

                            break;
                            
                            case BM_ADD:

                            break;  
                            
                            case BM_ERASE:
                                outCol.rgb = inCol.rgb;
                                outCol.a = clamp(inCol.a - topCol.a, 0.0, 1.0);
                                return;
                            break;

                            default:
                                alpha = topCol.a + (inCol.a * (1.0 - topCol.a));
                                outCol.rgb = (topCol.rgb * topCol.a + inCol.rgb * inCol.a * (1.0-topCol.a)) / alpha; 
                            break;
                        };

                        outCol.a = alpha;
                    }`
        },

        "baseColor_batch":
        {
            vert: `#version 300 es
                    in vec4 aPos;
                    in vec4 aColor;
                    in mat4 aMatrix;
                    in vec2 aTexcoord;

                    uniform mat4 uProjection;
                    
                    
                    out vec4 v_color;
                    out vec2 vTexcoord;
                    
                    void main()
                    {
                        gl_Position = uProjection * aMatrix * aPos;
                        v_color = aColor;
                        mat3 texMatrix = mat3(
                            vec3( 1.0, 0.0, 0.0 ),
                            vec3( 0.0, 1.0, 0.0 ),
                            vec3( 0.0, 0.0, 1.0)
                        );
                        vTexcoord = (texMatrix * vec3(aTexcoord,1)).xy;
                    }`,

            frag: ` #version 300 es
                    precision highp float;
                    // Simplex 2D noise
                    //
                    vec3 permute(vec3 x) { return mod(((x*34.0)+1.0)*x, 289.0); }

                    float snoise(vec2 v){
                        const vec4 C = vec4(0.211324865405187, 0.366025403784439,
                                -0.577350269189626, 0.024390243902439);
                        vec2 i  = floor(v + dot(v, C.yy) );
                        vec2 x0 = v -   i + dot(i, C.xx);
                        vec2 i1;
                        i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
                        vec4 x12 = x0.xyxy + C.xxzz;
                        x12.xy -= i1;
                        i = mod(i, 289.0);
                        vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 ))
                        + i.x + vec3(0.0, i1.x, 1.0 ));
                        vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy),
                            dot(x12.zw,x12.zw)), 0.0);
                        m = m*m ;
                        m = m*m ;
                        vec3 x = 2.0 * fract(p * C.www) - 1.0;
                        vec3 h = abs(x) - 0.5;
                        vec3 ox = floor(x + 0.5);
                        vec3 a0 = x - ox;
                        m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h );
                        vec3 g;
                        g.x  = a0.x  * x0.x  + h.x  * x0.y;
                        g.yz = a0.yz * x12.xz + h.yz * x12.yw;
                        return 130.0 * dot(m, g);
                    }


                    
                    in vec4 v_color;
                    in vec2 vTexcoord;
                    uniform int properties; // BITFLAG

                    #define PROP_SQUARE float(properties & 1)
                    #define PROP_TEXTURED min(float(properties & 2), 1.0)
                    #define PROP_SOFT min(float(properties & 4), 1.0)

                    out vec4 col;
                    void main()
                    {
                        float n = snoise(gl_FragCoord.xy);
                        float factor = distance(vTexcoord.xy, vec2(0.5))*2.0;
                        n = n - (factor * 3.15 - 2.3);
                        float clomp = step(factor, 1.0);
                        float brush_alpha = n;

                        clomp = mix(clomp, 1.0, PROP_SQUARE);

                        clomp = mix(clomp, 1.0-pow(
                            distance(vTexcoord.xy, vec2(0.5))*2.0, 1.0), 
                            PROP_SOFT);
                        
                        clomp = mix(clomp, clomp, PROP_SOFT);

                        clomp = mix(clomp, clomp * brush_alpha, PROP_TEXTURED);
                        col = vec4(v_color.rgb, v_color.a * clomp);
                    }`,
        },

        "floodFill":
        {
            vert: `#version 300 es
                    in vec4 aPos;
                    in vec2 aTexcoord;
                    
                    uniform vec2 uResolution;
                    uniform mat4 uMatrix;
                    uniform mat3 uTexMatrix;

                    out vec2 vTexcoord;
                    
                    void main()
                    {
                        gl_Position = uMatrix * aPos;
                        vTexcoord = (uTexMatrix * vec3(aTexcoord, 1)).xy;
                    }`,

            frag: `#version 300 es

                    precision mediump float;
                    
                    in vec2 vTexcoord;
                    uniform sampler2D image;
                    uniform vec2 sourcePosition;
                    uniform vec2 canvasResolution;
                    uniform float factor;
                    uniform vec3 color;

                    out vec4 outCol;

                    float rand(vec2 n) { 
                        return fract(sin(dot(n, vec2(12.9898, 4.1414))) * 43758.5453);
                    }

                    
                    float noise(vec2 p){
                        vec2 ip = floor(p);
                        vec2 u = fract(p);
                        u = u*u*(3.0-2.0*u);
                        
                        float res = mix(
                            mix(rand(ip),rand(ip+vec2(1.0,0.0)),u.x),
                            mix(rand(ip+vec2(0.0,1.0)),rand(ip+vec2(1.0,1.0)),u.x),u.y);
                        return res*res;
                    }

                    float map(float X, float A, float B, float C, float D)
                    {
                        return (X-A)/(B-A) * (D-C) + C;
                    }

                    void main()
                    {
                        vec2 uv = vTexcoord;
                        vec4 inCol = texture(image, uv);
                        float visible = map(
                            distance(sourcePosition, gl_FragCoord.xy),
                            0.0, 10.0,
                            0.0, 1.0
                        );
                        visible = visible * (1.0-factor);
                        visible += noise(  vec2(
                            round(uv * 512.0 * canvasResolution) / canvasResolution 
                        ) ) * 0.5;
                        
                       
                        visible = step(visible, 0.5);
           
                        if ((inCol.r * visible) == 0.0)
                            discard;

                        outCol = vec4(
                                      color, 1.0
                        );
                        //outCol = vec4( inCol.r * 255.0 );
                        //outCol = vec4(1.0, 0.0, 0.0, 1.0);
                    }`
        },



    },

    programs: {},

    textures: {},

    renderTargets: {},
};

export const m4 = {
    identity: function(dst=undefined) {
        dst = dst || new Float32Array(16);

        dst[0]=1;
        dst[1]=0;
        dst[2]=0;
        dst[3]=0;
        dst[4]=0;
        dst[5]=1;
        dst[6]=0;
        dst[7]=0;
        dst[8]=0;
        dst[9]=0;
        dst[10]=1;
        dst[11]=0;
        dst[12]=0;
        dst[13]=0;
        dst[14]=0;
        dst[15]=1;

        return dst;
    },

    projection: function(width, height, depth, dst=undefined) {
        dst = dst || new Float32Array(16);
        // Note: This matrix flips the Y axis so 0 is at the top.
        dst[0]=2 / width;
        dst[1]=0;
        dst[2]=0;
        dst[3]=0;
        dst[4]=0;
        dst[5]=-2 / height;
        dst[6]=0;
        dst[7]=0;
        dst[8]=0;
        dst[9]=0;
        dst[10]=2 / depth;
        dst[11]=0;
        dst[12]=-1;
        dst[13]=1;
        dst[14]=0;
        dst[15]=1;

        return dst;
      },

    translation: function(tx, ty, tz, dst=undefined) {
        dst = dst || new Float32Array(16);

        dst[0]=1;
        dst[1]=0;
        dst[2]=0;
        dst[3]=0;
        dst[4]=0;
        dst[5]=1;
        dst[6]=0;
        dst[7]=0;
        dst[8]=0;
        dst[9]=0;
        dst[10]=1;
        dst[11]=0;
        dst[12]=tx;
        dst[13]=ty;
        dst[14]=tz;
        dst[15]=1;

        return dst;
    },
   
    xRotation: function(angleInRadians, dst=undefined) {
        dst = dst || new Float32Array(16);
        var c = Math.cos(angleInRadians);
        var s = Math.sin(angleInRadians);

        dst[0]=1;
        dst[1]=0;
        dst[2]=0;
        dst[3]=0;
        dst[4]=0;
        dst[5]=c;
        dst[6]=s;
        dst[7]=0;
        dst[8]=0;
        dst[9]=-s;
        dst[10]=c;
        dst[11]=0;
        dst[12]=0;
        dst[13]=0;
        dst[14]=0;
        dst[15]=1;

        return dst;
    },
   
    yRotation: function(angleInRadians, dst=undefined) {
        dst = dst || new Float32Array(16);
        var c = Math.cos(angleInRadians);
        var s = Math.sin(angleInRadians);

        dst[0]=c;
        dst[1]=0;
        dst[2]=-s;
        dst[3]=0;
        dst[4]=0;
        dst[5]=1;
        dst[6]=0;
        dst[7]=0;
        dst[8]=s;
        dst[9]=0;
        dst[10]=c;
        dst[11]=0;
        dst[12]=0;
        dst[13]=0;
        dst[14]=0;
        dst[15]=1;

        return dst;
    },
   
    zRotation: function(angleInRadians, dst=undefined) {
        dst = dst || new Float32Array(16);
        var c = Math.cos(angleInRadians);
        var s = Math.sin(angleInRadians);
   
        dst[0]=c;
        dst[1]=s;
        dst[2]=0;
        dst[3]=0;
        dst[4]=-s;
        dst[5]=c;
        dst[6]=0;
        dst[7]=0;
        dst[8]=0;
        dst[9]=0;
        dst[10]=1;
        dst[11]=0;
        dst[12]=0;
        dst[13]=0;
        dst[14]=0;
        dst[15]=1;

        return dst;
    },
   
    scaling: function(sx, sy, sz, dst=undefined) {
        dst = dst || new Float32Array(16);

        dst[0]=sx;
        dst[1]=0;
        dst[2]=0;
        dst[3]=0;
        dst[4]=0;
        dst[5]=sy;
        dst[6]=0;
        dst[7]=0;
        dst[8]=0;
        dst[9]=0;
        dst[10]=sz;
        dst[11]=0;
        dst[12]=0;
        dst[13]=0;
        dst[14]=0;
        dst[15]=1;

        return dst;
    },

      multiply: function(a, b, dst=undefined) {
        dst = dst || new Float32Array(16);
        var tmp = new Float32Array(16);

        var b00 = b[0 * 4 + 0];
        var b01 = b[0 * 4 + 1];
        var b02 = b[0 * 4 + 2];
        var b03 = b[0 * 4 + 3];
        var b10 = b[1 * 4 + 0];
        var b11 = b[1 * 4 + 1];
        var b12 = b[1 * 4 + 2];
        var b13 = b[1 * 4 + 3];
        var b20 = b[2 * 4 + 0];
        var b21 = b[2 * 4 + 1];
        var b22 = b[2 * 4 + 2];
        var b23 = b[2 * 4 + 3];
        var b30 = b[3 * 4 + 0];
        var b31 = b[3 * 4 + 1];
        var b32 = b[3 * 4 + 2];
        var b33 = b[3 * 4 + 3];
        var a00 = a[0 * 4 + 0];
        var a01 = a[0 * 4 + 1];
        var a02 = a[0 * 4 + 2];
        var a03 = a[0 * 4 + 3];
        var a10 = a[1 * 4 + 0];
        var a11 = a[1 * 4 + 1];
        var a12 = a[1 * 4 + 2];
        var a13 = a[1 * 4 + 3];
        var a20 = a[2 * 4 + 0];
        var a21 = a[2 * 4 + 1];
        var a22 = a[2 * 4 + 2];
        var a23 = a[2 * 4 + 3];
        var a30 = a[3 * 4 + 0];
        var a31 = a[3 * 4 + 1];
        var a32 = a[3 * 4 + 2];
        var a33 = a[3 * 4 + 3];

        tmp[0]=b00 * a00 + b01 * a10 + b02 * a20 + b03 * a30;
        tmp[1]=b00 * a01 + b01 * a11 + b02 * a21 + b03 * a31;
        tmp[2]=b00 * a02 + b01 * a12 + b02 * a22 + b03 * a32;
        tmp[3]=b00 * a03 + b01 * a13 + b02 * a23 + b03 * a33;
        tmp[4]=b10 * a00 + b11 * a10 + b12 * a20 + b13 * a30;
        tmp[5]=b10 * a01 + b11 * a11 + b12 * a21 + b13 * a31;
        tmp[6]=b10 * a02 + b11 * a12 + b12 * a22 + b13 * a32;
        tmp[7]=b10 * a03 + b11 * a13 + b12 * a23 + b13 * a33;
        tmp[8]=b20 * a00 + b21 * a10 + b22 * a20 + b23 * a30;
        tmp[9]=b20 * a01 + b21 * a11 + b22 * a21 + b23 * a31;
        tmp[10]=b20 * a02 + b21 * a12 + b22 * a22 + b23 * a32;
        tmp[11]=b20 * a03 + b21 * a13 + b22 * a23 + b23 * a33;
        tmp[12]=b30 * a00 + b31 * a10 + b32 * a20 + b33 * a30;
        tmp[13]=b30 * a01 + b31 * a11 + b32 * a21 + b33 * a31;
        tmp[14]=b30 * a02 + b31 * a12 + b32 * a22 + b33 * a32;
        tmp[15]=b30 * a03 + b31 * a13 + b32 * a23 + b33 * a33;

        for (var i = 0; i < 16; i++) { dst[i] = tmp[i]; };

        return dst;
    }
};

export const m3 = {
    projection: function(width, height) {
        // Note: This matrix flips the Y axis so that 0 is at the top.
        return [
          2 / width, 0, 0,
          0, -2 / height, 0,
          -1, 1, 1
        ];
    },
    
    identity: function()
    {
        return [
            1, 0, 0,
            0, 1, 0,
            0, 0, 1
        ];
    },

    translation: function(x, y, z=1)
    {
        return [
            1, 0, 0,
            0, 1, 0,
            x, y, z
        ];
    },

    rotation: function(radAngle)
    {
        let s = Math.sin(radAngle),
            c = Math.cos(radAngle);
        return [
            c, -s, 0,
            s, c, 0,
            0, 0, 1
        ];
    },

    scale: function(x, y)
    {
        return [
            x, 0, 0,
            0, y, 0,
            0, 0, 1
        ];
    },

    multiply: function(a, b)
    {
        var a00 = a[0 * 3 + 0];
        var a01 = a[0 * 3 + 1];
        var a02 = a[0 * 3 + 2];
        var a10 = a[1 * 3 + 0];
        var a11 = a[1 * 3 + 1];
        var a12 = a[1 * 3 + 2];
        var a20 = a[2 * 3 + 0];
        var a21 = a[2 * 3 + 1];
        var a22 = a[2 * 3 + 2];
        var b00 = b[0 * 3 + 0];
        var b01 = b[0 * 3 + 1];
        var b02 = b[0 * 3 + 2];
        var b10 = b[1 * 3 + 0];
        var b11 = b[1 * 3 + 1];
        var b12 = b[1 * 3 + 2];
        var b20 = b[2 * 3 + 0];
        var b21 = b[2 * 3 + 1];
        var b22 = b[2 * 3 + 2];
        return [
            b00 * a00 + b01 * a10 + b02 * a20,
            b00 * a01 + b01 * a11 + b02 * a21,
            b00 * a02 + b01 * a12 + b02 * a22,
            b10 * a00 + b11 * a10 + b12 * a20,
            b10 * a01 + b11 * a11 + b12 * a21,
            b10 * a02 + b11 * a12 + b12 * a22,
            b20 * a00 + b21 * a10 + b22 * a20,
            b20 * a01 + b21 * a11 + b22 * a21,
            b20 * a02 + b21 * a12 + b22 * a22,
        ];
    }
};