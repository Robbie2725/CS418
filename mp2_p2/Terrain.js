/**
 * @fileoverview Terrain - A simple 3D terrain using WebGL
 * @author Eric Shaffer, Robbie Krokos (rkroko2)
 */

/** Class implementing 3D terrain. */
class Terrain{
/**
 * Initialize members of a Terrain object
 * @param {number} div Number of triangles along x axis and y axis
 * @param {number} minX Minimum X coordinate value
 * @param {number} maxX Maximum X coordinate value
 * @param {number} minY Minimum Y coordinate value
 * @param {number} maxY Maximum Y coordinate value
 */
    constructor(div,minX,maxX,minY,maxY){
        this.div = div;
        this.minX=minX;
        this.minY=minY;
        this.maxX=maxX;
        this.maxY=maxY;

        // Allocate point to generate random plane
        this.p = [0, 0, 0];
	// Allocate a vector for the normal to the random plane
        this.n = [0, 0, 0];
        // Allocate vertex array
        this.vBuffer = [];
        // Allocate triangle array
        this.fBuffer = [];
        // Allocate normal array
        this.nBuffer = [];
        // Allocate array for edges so we can draw wireframe
        this.eBuffer = [];
        console.log("Terrain: Allocated buffers");

        this.generateTriangles();
        console.log("Terrain: Generated triangles");
        this.randomTerrain(); // make the terrain not flat
        this.setVertexNormals(); // update the vertex normals of the new terrain

        this.generateLines();
        console.log("Terrain: Generated lines");

        // Get extension for 4 byte integer indices for drwElements
        var ext = gl.getExtension('OES_element_index_uint');
        if (ext ==null){
            alert("OES_element_index_uint is unsupported by your browser and terrain generation cannot proceed.");
        }
    }

    /**
    * Set the x,y,z coords of a vertex at location(i,j)
    * @param {Object} v an an array of length 3 holding x,y,z coordinates
    * @param {number} i the ith row of vertices
    * @param {number} j the jth column of vertices
    */
    setVertex(v,i,j)
    {
        // Calculate the index in the vBuffer
        var idx = 3*(i*(this.div+1)+j);
        // Set the point in the vBuffer to v
        this.vBuffer[idx]=v[0];
        this.vBuffer[idx+1]=v[1];
        this.vBuffer[idx+2]=v[2];
    }

    /**
    * Return the x,y,z coordinates of a vertex at location (i,j)
    * @param {Object} v an an array of length 3 holding x,y,z coordinates
    * @param {number} i the ith row of vertices
    * @param {number} j the jth column of vertices
    */
    getVertex(v,i,j)
    {
        // Calculate the index
        var idx = 3*(i*(this.div+1)+j);
        // Set v to the point in the vBuffer
        v[0]=this.vBuffer[idx];
        v[1]=this.vBuffer[idx+1];
        v[2]=this.vBuffer[idx+2];
    }

    /**
    * Send the buffer objects to WebGL for rendering
    */
    loadBuffers()
    {
        // Specify the vertex coordinates
        this.VertexPositionBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.VertexPositionBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(this.vBuffer), gl.STATIC_DRAW);
        this.VertexPositionBuffer.itemSize = 3;
        this.VertexPositionBuffer.numItems = this.numVertices;
        console.log("Loaded ", this.VertexPositionBuffer.numItems, " vertices");

        // Specify normals to be able to do lighting calculations
        this.VertexNormalBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.VertexNormalBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(this.nBuffer),
                  gl.STATIC_DRAW);
        this.VertexNormalBuffer.itemSize = 3;
        this.VertexNormalBuffer.numItems = this.numVertices;
        console.log("Loaded ", this.VertexNormalBuffer.numItems, " normals");

        // Specify faces of the terrain
        this.IndexTriBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.IndexTriBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(this.fBuffer),
                  gl.STATIC_DRAW);
        this.IndexTriBuffer.itemSize = 1;
        this.IndexTriBuffer.numItems = this.fBuffer.length;
        console.log("Loaded ", this.IndexTriBuffer.numItems, " triangles");

        //Setup Edges
        this.IndexEdgeBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.IndexEdgeBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(this.eBuffer),
                  gl.STATIC_DRAW);
        this.IndexEdgeBuffer.itemSize = 1;
        this.IndexEdgeBuffer.numItems = this.eBuffer.length;

        console.log("triangulatedPlane: loadBuffers");
    }

    /**
    * Render the triangles
    */
    drawTriangles(){
        gl.bindBuffer(gl.ARRAY_BUFFER, this.VertexPositionBuffer);
        gl.vertexAttribPointer(shaderProgram.vertexPositionAttribute, this.VertexPositionBuffer.itemSize,
                         gl.FLOAT, false, 0, 0);

        // Bind normal buffer
        gl.bindBuffer(gl.ARRAY_BUFFER, this.VertexNormalBuffer);
        gl.vertexAttribPointer(shaderProgram.vertexNormalAttribute,
                           this.VertexNormalBuffer.itemSize,
                           gl.FLOAT, false, 0, 0);

        //Draw
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.IndexTriBuffer);
        gl.drawElements(gl.TRIANGLES, this.IndexTriBuffer.numItems, gl.UNSIGNED_INT,0);
    }

    /**
    * Render the triangle edges wireframe style
    */
    drawEdges(){

        gl.bindBuffer(gl.ARRAY_BUFFER, this.VertexPositionBuffer);
        gl.vertexAttribPointer(shaderProgram.vertexPositionAttribute, this.VertexPositionBuffer.itemSize,
                         gl.FLOAT, false, 0, 0);

        // Bind normal buffer
        gl.bindBuffer(gl.ARRAY_BUFFER, this.VertexNormalBuffer);
        gl.vertexAttribPointer(shaderProgram.vertexNormalAttribute,
                           this.VertexNormalBuffer.itemSize,
                           gl.FLOAT, false, 0, 0);

        //Draw
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.IndexEdgeBuffer);
        gl.drawElements(gl.LINES, this.IndexEdgeBuffer.numItems, gl.UNSIGNED_INT,0);
    }
/**
 * Fill the vertex and buffer arrays
 */
generateTriangles()
{
    //Your code here
    var dx=(this.maxX-this.minX)/this.div;
    var dy=(this.maxY-this.minY)/this.div;

    for(var i=0; i<=this.div; i++){
      for(var j=0; j<=this.div; j++){
        this.vBuffer.push(this.minX+dx*j);
        this.vBuffer.push(this.minY+dy*i);
        this.vBuffer.push(0);

        this.nBuffer.push(0);
        this.nBuffer.push(0);
        this.nBuffer.push(0);

      }
    }

    for(var i=0; i<this.div; i++){
      for(var j=0; j<this.div; j++){
        var idx=i*(this.div+1)+j;
        this.fBuffer.push(idx);
        this.fBuffer.push(idx+1);
        this.fBuffer.push(idx+this.div+1);

        this.fBuffer.push(idx+1);
        this.fBuffer.push(idx+1+this.div+1);
        this.fBuffer.push(idx+this.div+1);

      }
    }
    //
    this.numVertices = this.vBuffer.length/3;
    this.numFaces = this.fBuffer.length/3;
}

/**
 * Print vertices and triangles to console for debugging
 */
printBuffers()
    {

    for(var i=0;i<this.numVertices;i++)
          {
           console.log("v ", this.vBuffer[i*3], " ",
                             this.vBuffer[i*3 + 1], " ",
                             this.vBuffer[i*3 + 2], " ");

          }

      for(var i=0;i<this.numFaces;i++)
          {
           console.log("f ", this.fBuffer[i*3], " ",
                             this.fBuffer[i*3 + 1], " ",
                             this.fBuffer[i*3 + 2], " ");

          }

    }

/**
 * Generates line values from faces in faceArray
 * to enable wireframe rendering
 */
generateLines()
{
    var numTris=this.fBuffer.length/3;
    for(var f=0;f<numTris;f++)
    {
        var fid=f*3;
        this.eBuffer.push(this.fBuffer[fid]);
        this.eBuffer.push(this.fBuffer[fid+1]);

        this.eBuffer.push(this.fBuffer[fid+1]);
        this.eBuffer.push(this.fBuffer[fid+2]);

        this.eBuffer.push(this.fBuffer[fid+2]);
        this.eBuffer.push(this.fBuffer[fid]);
    }

}

generatePlane(){
  // random point from range (minX, minY, 0) to (maxX, maxY, 0)
  this.p = [Math.random()*(this.maxX-this.minX)+this.minX, Math.random()*(this.maxY-this.minY)+this.minY, 0];

  //random unit vector for the normal vector
  var normal = [Math.random()-.5, Math.random()-.5, 0]; //get random 2d vector
  var magnitude = Math.sqrt(normal[0]*normal[0] + normal[1]*normal[1]);
  this.n = [normal[0]/magnitude, normal[1]/magnitude, 0]; //normalize
}

randomTerrain(){
  var delta=.0015; //used to increase or decrease z component
  // Generate 100 random plains
  for(var i=0; i<700; i++){
    this.generatePlane(); //generate random plane

    //Loop through each point in the terrain
    for(var x=0; x<=this.div; x++){
      for(var y=0; y<=this.div; y++){
        //get the current vertex at x,y
        var vtx = [0,0,0];
        this.getVertex(vtx, x, y);

        //get vector from plain to point
        var v_p = [vtx[0]-this.p[0], vtx[1]-this.p[1], vtx[2]-this.p[2]] ;

        // Calculate dot product of plain to point vector and normal vector
        var result=0;
        for (var j = 0; j < 3; j++) {
          result += v_p[j] * this.n[j];
        }

        // If above plain, add delta
        if(result>0) {
          vtx[2]+=delta;
        }
        else { //else subtract delta
          vtx[2]-=delta;
        }

        // Set the new z coordinate
        this.setVertex(vtx, x, y);
      }
    }
  }
}

setVertexNormals(){

  // Loop through each 'square' of the terrain grid
  for(var i=0; i<this.div; i++){
    for(var j=0; j<this.div; j++){

      // vars used to get each traingles vertices
      var v1 = [0,0,0];
      var v2 = [0,0,0];
      var v3 = [0,0,0];

      // var used to compute the cross product
      var prod=[0,0,0];

      // get uppper triangles vertices
      this.getVertex(v1, i, j);
      this.getVertex(v2, i+1, j+1);
      this.getVertex(v3, i+1, j);

      //Get the cross product of (v2-v1)x(v3-v1)
      cross_prod(prod, [v2[0]-v1[0], v2[1]-v1[1], v2[2]-v1[2]], [v3[0]-v1[0], v3[1]-v1[1], v3[2]-v1[2]]);

      // get index of each vertex in nBuffer
      var idx1 = 3*(i*(this.div+1)+j);
      var idx2 = 3*((i+1)*(this.div+1)+(j+1));
      var idx3 = 3*((i+1)*(this.div+1)+j);

      // add N to the nbuffer for each vertex
      this.nBuffer[idx1]+=prod[0]; //v1.x
      this.nBuffer[idx1+1]+=prod[1]; //v1.y
      this.nBuffer[idx1+2]+=prod[2]; //v1.z
      this.nBuffer[idx2]+=prod[0]; //v2.x
      this.nBuffer[idx2+1]+=prod[1]; //v2.y
      this.nBuffer[idx2+2]+=prod[2]; //v2.z
      this.nBuffer[idx3]+=prod[0]; //v3.x
      this.nBuffer[idx3+1]+=prod[1]; //v3.y
      this.nBuffer[idx3+2]+=prod[2]; //v3.z

      // get the lower triangles vertices
      this.getVertex(v1, i, j);
      this.getVertex(v2, i, j+1);
      this.getVertex(v3, i+1, j+1);

      //Get the cross product of (v2-v1)x(v3-v1)
      cross_prod(prod, [v2[0]-v1[0], v2[1]-v1[1], v2[2]-v1[2]], [v3[0]-v1[0], v3[1]-v1[1], v3[2]-v1[2]]);

      // get index of each vertex in nBuffer
      var idx1 = 3*(i*(this.div+1)+j);
      var idx2 = 3*(i*(this.div+1)+(j+1));
      var idx3 = 3*((i+1)*(this.div+1)+j+1);

      // add N to the nbuffer for each vertex
      this.nBuffer[idx1]+=prod[0]; //v1.x
      this.nBuffer[idx1+1]+=prod[1]; //v1.y
      this.nBuffer[idx1+2]+=prod[2]; //v1.z
      this.nBuffer[idx2]+=prod[0]; //v2.x
      this.nBuffer[idx2+1]+=prod[1]; //v2.y
      this.nBuffer[idx2+2]+=prod[2]; //v2.z
      this.nBuffer[idx3]+=prod[0]; //v3.x
      this.nBuffer[idx3+1]+=prod[1]; //v3.y
      this.nBuffer[idx3+2]+=prod[2]; //v3.z
    }
  }

  // Then normalize each normal vector in the nBuffer
  for(var x=0; x<=this.div; x++){
    for(var y=0; y<=this.div; y++){
      // get the curren idx
      var idx = 3*(x*(this.div+1)+y);
      //calculate magnitude
      var magnitude = Math.sqrt(this.nBuffer[idx]*this.nBuffer[idx]+this.nBuffer[idx+1]*this.nBuffer[idx+1]+this.nBuffer[idx+2]*this.nBuffer[idx+2]);
      //normalize x,y,x components
      this.nBuffer[idx]=this.nBuffer[idx]/magnitude;
      this.nBuffer[idx+1]=this.nBuffer[idx+1]/magnitude;
      this.nBuffer[idx+2]=this.nBuffer[idx+2]/magnitude;
    }
  }
}

}
