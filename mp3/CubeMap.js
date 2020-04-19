/**
 * @file functios to implement a cube map
 * @author Robbie Krokos <rkroko2@illinois.edu>
 */

/** @global the cubemap texture */
var texture;


 function setupCubeMap(){

   // create the texture
   texture = gl.createTexture();
   gl.bindTexture(gl.TEXTURE_CUBE_MAP, texture);

   // each direction info
   const londonMap = [
      {
        target: gl.TEXTURE_CUBE_MAP_POSITIVE_X,
        url: 'London/pos-x.png'
      },
      {
        target: gl.TEXTURE_CUBE_MAP_NEGATIVE_X,
        url: 'London/neg-x.png'
      },
      {
        target: gl.TEXTURE_CUBE_MAP_POSITIVE_Y,
        url: 'London/pos-y.png'
      },
      {
        target: gl.TEXTURE_CUBE_MAP_NEGATIVE_Y,
        url: 'London/neg-y.png'
      },
      {
        target: gl.TEXTURE_CUBE_MAP_POSITIVE_Z,
        url: 'London/pos-z.png'
      },
      {
        target: gl.TEXTURE_CUBE_MAP_NEGATIVE_Z,
        url: 'London/neg-z.png'
      }
    ];

   // load the cubemap images to the texture
   londonMap.forEach((info) => {
     // get the stored info for the current direction
     const {target, url} = info;

     // canvas information for upload
     const level = 0;
     const internalFormat = gl.RGBA;
     const width = 512;
     const height = 512;
     const format = gl.RGBA;
     const type = gl.UNSIGNED_BYTE;

     // set up each face so its immediately renderable
     gl.texImage2D(target, level, internalFormat, width, height, 0, format, type, null);

     // load image Asynchronously
     const image = new Image();
     image.src = url;
     image.addEventListener('load', function() {
       // after loaded, add to texture
       gl.bindTexture(gl.TEXTURE_CUBE_MAP, texture);
       gl.texImage2D(target, level, internalFormat, format, type, image);
       gl.generateMipmap(gl.TEXTURE_CUBE_MAP);
       console.log("Loaded image: ", url);
     });
   });

   gl.generateMipmap(gl.TEXTURE_CUBE_MAP);
   gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);

 }

/** Class implementing the skymap */
 class Skybox{
   /**
   * constructor allocates variables and checks if has extension
   */
   constructor(){
     this.numFaces=0;
     this.numVertices=0;

     // Allocate vertex array
     this.vBuffer = [];
     // Allocate triangle array
     this.fBuffer = [];

     // Allocate Array for texture coordinates
     this.texcoordBuffer = [];

     console.log("Skybox: Allocated buffers");

     var ext = gl.getExtension('OES_element_index_uint');
     if (ext ==null){
         alert("OES_element_index_uint is unsupported by your browser and terrain generation cannot proceed.");
     }
     else{
         console.log("OES_element_index_uint is supported!");
     }
   }

   /**
   * Sets up the box of size determined by the input parameters
   * @param {Float32Array} maxXYZ 3 element array determining the max x,y,z coords
   * @param {Float32Array} minXYZ 3 element array determining the min x,y,z coords
   */
   loadBox(maxXYZ, minXYZ){
     this.numVertices = 8;
     this.numFaces = 12;

     // push the vertices
     this.vBuffer.push(maxXYZ[0], maxXYZ[1], maxXYZ[2]);
     this.vBuffer.push(minXYZ[0], minXYZ[1], minXYZ[2]);
     this.vBuffer.push(maxXYZ[0], maxXYZ[1], minXYZ[2]);
     this.vBuffer.push(maxXYZ[0], minXYZ[1], minXYZ[2]);
     this.vBuffer.push(minXYZ[0], minXYZ[1], maxXYZ[2]);
     this.vBuffer.push(minXYZ[0], maxXYZ[1], maxXYZ[2]);
     this.vBuffer.push(minXYZ[0], maxXYZ[1], minXYZ[2]);
     this.vBuffer.push(maxXYZ[0], minXYZ[1], maxXYZ[2]);

     // push the faces
     this.fBuffer.push(0,3,2);
     this.fBuffer.push(0,7,3);
     this.fBuffer.push(0,5,4);
     this.fBuffer.push(0,4,7);
     this.fBuffer.push(1,5,6);
     this.fBuffer.push(1,4,5);
     this.fBuffer.push(1,6,2);
     this.fBuffer.push(1,2,3);
     this.fBuffer.push(0,2,6);
     this.fBuffer.push(0,6,5);
     this.fBuffer.push(1,7,4);
     this.fBuffer.push(1,3,7);

     console.log("Skybox: Loaded ", this.numFaces, " triangles.");
     console.log("Skybox: Loaded ", this.numVertices, " vertices.");

     // update the buffers
     mySkyBox.loadBuffers();
   }

   loadBuffers(){
     // specify vertex coordinates
     this.VertexPositionBuffer = gl.createBuffer();
     gl.bindBuffer(gl.ARRAY_BUFFER, this.VertexPositionBuffer);
     gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(this.vBuffer), gl.STATIC_DRAW);
     this.VertexPositionBuffer.itemSize = 3;
     this.VertexPositionBuffer.numItems = this.numVertices;
     console.log("Loaded ", this.VertexPositionBuffer.numItems, " vertices");

     // Specify faces of the terrain
     this.IndexTriBuffer = gl.createBuffer();
     gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.IndexTriBuffer);
     gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(this.fBuffer),
               gl.STATIC_DRAW);
     this.IndexTriBuffer.itemSize = 1;
     this.IndexTriBuffer.numItems = this.fBuffer.length;
     console.log("Loaded ", this.IndexTriBuffer.numItems/3, " triangles");
   }

   drawTriangles(){
     gl.bindBuffer(gl.ARRAY_BUFFER, this.VertexPositionBuffer);
     gl.vertexAttribPointer(skyShader.vertexPositionAttribute, this.VertexPositionBuffer.itemSize,
                      gl.FLOAT, false, 0, 0);

     //Draw
     gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.IndexTriBuffer);
     gl.drawElements(gl.TRIANGLES, this.IndexTriBuffer.numItems, gl.UNSIGNED_INT,0);
   }

   // updates the shader with the cube map
   uploadCubeMap(){
     gl.uniform1i(skyShader.texture, 0);
   }
 }
