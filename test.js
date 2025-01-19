import { Color } from "./color.js";
import { Graphics, m4 } from "./graphics.js";

"use strict";

var canvas = document.querySelector("#c"),
	gl = canvas.getContext("webgl2");


var tempCanvas = document.createElement("canvas"),
    tempCtx = tempCanvas.getContext('2d');

Graphics.setup( gl );



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
                let texture = Graphics.createGLTexture( img.width, img.height, gl.RGBA, gl.UNSIGNED_BYTE );

                tempCanvas.width = img.width;
                tempCanvas.height = img.height;
                
                tempCtx.drawImage(img, 0, 0);
                
                gl.bindTexture( gl.TEXTURE_2D, texture );
                gl.texImage2D( gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, tempCanvas);
                
                Graphics.drawImage( { width: img.width, height: img.height, texture: texture }, position.x, position.y);
                
                gl.deleteTexture(texture);
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


pasteImage( {x:0, y:0} );
Graphics.drawColor = Color.black;
Graphics.fillRect(0,0,32,32);