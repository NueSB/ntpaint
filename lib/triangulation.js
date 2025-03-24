// req: libtess.js

const Tesselator = (function initTesselator() {
    // function called for each vertex of tesselator output
    function vertexCallback(data, polyVertArray) {

      polyVertArray[polyVertArray.length] = data[0];
      polyVertArray[polyVertArray.length] = data[1];
    }
    function begincallback(type) {
      if (type !== libtess.primitiveType.GL_TRIANGLES) {
        console.log('expected TRIANGLES but got type: ' + type);
      }
    }
    function errorcallback(errno) {
      console.log('error callback');
      console.log('error number: ' + errno);
    }
    // callback for when segments intersect and must be split
    function combinecallback(coords, data, weight) {
      return [coords[0], coords[1], coords[2]];
    }
    function edgeCallback(flag) {

    }
  
    var tess = new libtess.GluTesselator();

    tess.gluTessCallback(libtess.gluEnum.GLU_TESS_VERTEX_DATA, vertexCallback);
    tess.gluTessCallback(libtess.gluEnum.GLU_TESS_BEGIN, begincallback);
    tess.gluTessCallback(libtess.gluEnum.GLU_TESS_ERROR, errorcallback);
    tess.gluTessCallback(libtess.gluEnum.GLU_TESS_COMBINE, combinecallback);
    tess.gluTessCallback(libtess.gluEnum.GLU_TESS_EDGE_FLAG, edgeCallback);

    tess.triangulate =  function(contours) {
        this.gluTessNormal(0, 0, 1);
      
        var triangleVerts = [];
        this.gluTessBeginPolygon(triangleVerts);
      
        for (var i = 0; i < contours.length; i++) {
            this.gluTessBeginContour();
          var contour = contours[i];
          for (var j = 0; j < contour.length; j += 2) {
            var coords = [contour[j], contour[j + 1], 0];
            this.gluTessVertex(coords, coords);
          }
          this.gluTessEndContour();
        }
      
        this.gluTessEndPolygon();
    
        return triangleVerts;
    }

    return tess;
})();
  
