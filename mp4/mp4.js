
/**
 * @file A simple WebGL example for viewing meshes read from OBJ files
 * @author Robbie Krokos <rkroko2@illinois.edu>
 */

/** @global The WebGL context */
var gl;

/** @global The HTML5 canvas we draw on */
var canvas;

/** @global A simple GLSL shader program for the skybox */
var skyShader;

/** @global A simple GLSL shader program for the teapot */
var teapotShader;

/** @global The Modelview matrix */
var mvMatrix = mat4.create();

/** @global The Projection matrix */
var pMatrix = mat4.create();

/** @global The Normal matrix */
var nMatrix = mat3.create();

/** @global The matrix stack for hierarchical modeling */
var mvMatrixStack = [];

/** @global An array holding the Vertices of the sphere*/
var sphereVBuffer;

/** @global An array holding the normals to each vertex on the sphere */
var sphereNBuffer;


// View parameters
/** @global Location of the camera in world coordinates */
var eyePt = vec3.fromValues(0.0,-2,15);
/** @global Direction of the view in world coordinates */
var viewDir = vec3.fromValues(0.0,0.0,-1.0);
/** @global Up vector for view matrix creation, in world coordinates */
var up = vec3.fromValues(0.0,1.0,0.0);
/** @global Location of a point along viewDir in world coordinates */
var viewPt = vec3.fromValues(0.0,0.0,0.0);

//Light parameters
/** @global Light position in VIEW coordinates */
var lightPosition = [0,-5,12];
/** @global Ambient light color/intensity for Phong reflection */
var lAmbient = [0,0,0];
/** @global Diffuse light color/intensity for Phong reflection */
var lDiffuse = [1,1,1];
/** @global Specular light color/intensity for Phong reflection */
var lSpecular =[.5,.5,.5];

//Material parameters
/** @global Ambient material color/intensity for Phong reflection */
var kAmbient = [1,1,1];
/** @global Diffuse material color/intensity for Phong reflection */
var kTerrainDiffuse = [205.0/255.0,163.0/255.0,63.0/255.0];
/** @global Specular material color/intensity for Phong reflection */
var kSpecular = [.5,.5,.5];
/** @global Shininess exponent for Phong reflection */
var shininess = 23;
/** @global Edge color fpr wireframeish rendering */
var kEdgeBlack = [0.0,0.0,0.0];
/** @global Edge color for wireframe rendering */
var kEdgeWhite = [1.0,1.0,1.0];

/** @global Stores the minimum bounds of the box the spheres are in */
var boxMin=[-5,-5,-5];

/** @global Stores the maximum bounds of the box the spheres are in */
var boxMax=[5,5,5];

/** @globals Store the two forces acting on the spheres */
// Gravity force
var gravity=[0,-.001,0];
// Drag force
var drag=.975;

/** @globals Arrays of information for each sphere */
position=[];
velocity=[];
size=[];
color=[];

//-------------------------------------------------------------------------
/**
 * Sends model and view matrices to shader (seperate uniforms)
 * @param {String} program Name of shader program to upload to
 */
function uploadModelViewMatrixToShader() {
  gl.uniformMatrix4fv(myShaderProgram.mMatrixUniform, false, mvMatrix);
}

//-------------------------------------------------------------------------
/**
 * Sends projection matrix to shader
 * @param {String} program Name of shader program to upload to
 */
function uploadProjectionMatrixToShader() {
  gl.uniformMatrix4fv(myShaderProgram.pMatrixUniform,false, pMatrix);
}

//-------------------------------------------------------------------------
/**
 * Generates and sends the normal matrix to the shader
 * @param {String} program Name of shader program to upload to
 */
function uploadNormalMatrixToShader() {
  mat3.fromMat4(nMatrix,mvMatrix);
  mat3.transpose(nMatrix,nMatrix);
  mat3.invert(nMatrix,nMatrix);
  gl.uniformMatrix3fv(myShaderProgram.nMatrixUniform, false, nMatrix);
}

//----------------------------------------------------------------------------------
/**
 * Pushes matrix onto model matrix stack
 */
function mvPushMatrix() {
    var copy = mat4.clone(mvMatrix);
    mvMatrixStack.push(copy);
}


//----------------------------------------------------------------------------------
/**
 * Pops matrix off of model matrix stack
 */
function mvPopMatrix() {
    if (mvMatrixStack.length == 0) {
      throw "Invalid popMatrix!";
    }
    mvMatrix = mvMatrixStack.pop();
}

//----------------------------------------------------------------------------------
/**
 * Sends projection/modelview matrices to shader
 * @param {String} program Name of shader program to upload to
 */
function setMatrixUniforms() {
  uploadModelViewMatrixToShader();
  uploadProjectionMatrixToShader();
  uploadNormalMatrixToShader();
}


//----------------------------------------------------------------------------------
/**
 * Translates degrees to radians
 * @param {Number} degrees Degree input to function
 * @return {Number} The radians that correspond to the degree input
 */
function degToRad(degrees) {
        return degrees * Math.PI / 180;
}

//----------------------------------------------------------------------------------
/**
 * Creates a context for WebGL
 * @param {element} canvas WebGL canvas
 * @return {Object} WebGL context
 */
function createGLContext(canvas) {
  var names = ["webgl", "experimental-webgl"];
  var context = null;
  for (var i=0; i < names.length; i++) {
    try {
      context = canvas.getContext(names[i]);
    } catch(e) {}
    if (context) {
      break;
    }
  }
  if (context) {
    context.viewportWidth = canvas.width;
    context.viewportHeight = canvas.height;
  } else {
    alert("Failed to create WebGL context!");
  }
  return context;
}

//----------------------------------------------------------------------------------
/**
 * Loads Shaders
 * @param {string} id ID string for shader to load. Either vertex shader/fragment shader
 */
function loadShaderFromDOM(id) {
  var shaderScript = document.getElementById(id);

  // If we don't find an element with the specified id
  // we do an early exit
  if (!shaderScript) {
    return null;
  }

  // Loop through the children for the found DOM element and
  // build up the shader source code as a string
  var shaderSource = "";
  var currentChild = shaderScript.firstChild;
  while (currentChild) {
    if (currentChild.nodeType == 3) { // 3 corresponds to TEXT_NODE
      shaderSource += currentChild.textContent;
    }
    currentChild = currentChild.nextSibling;
  }

  var shader;
  if (shaderScript.type == "x-shader/x-fragment") {
    shader = gl.createShader(gl.FRAGMENT_SHADER);
  } else if (shaderScript.type == "x-shader/x-vertex") {
    shader = gl.createShader(gl.VERTEX_SHADER);
  } else {
    return null;
  }

  gl.shaderSource(shader, shaderSource);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    alert(gl.getShaderInfoLog(shader));
    return null;
  }
  return shader;
}

/**
 * Sets up the shader program to be used
 */
function setupShaders() {
  vertexShader = loadShaderFromDOM("shader-vs");
  fragmentShader = loadShaderFromDOM("shader-fs");

  myShaderProgram = gl.createProgram();
  gl.attachShader(myShaderProgram, vertexShader);
  gl.attachShader(myShaderProgram, fragmentShader);
  gl.linkProgram(myShaderProgram);

  if (!gl.getProgramParameter(myShaderProgram, gl.LINK_STATUS)) {
    alert("Failed to setup shaders");
  }

  gl.useProgram(myShaderProgram);

  myShaderProgram.vertexPositionAttribute = gl.getAttribLocation(myShaderProgram, "aVertexPosition");
  gl.enableVertexAttribArray(myShaderProgram.vertexPositionAttribute);


  myShaderProgram.vertexNormalAttribute = gl.getAttribLocation(myShaderProgram, "aVertexNormal");
  gl.enableVertexAttribArray(myShaderProgram.vertexNormalAttribute);

  myShaderProgram.mMatrixUniform = gl.getUniformLocation(myShaderProgram, "uMVMatrix");
  myShaderProgram.pMatrixUniform = gl.getUniformLocation(myShaderProgram, "uPMatrix");
  myShaderProgram.nMatrixUniform = gl.getUniformLocation(myShaderProgram, "uNMatrix");
  myShaderProgram.uniformLightPositionLoc = gl.getUniformLocation(myShaderProgram, "uLightPosition");
  myShaderProgram.uniformAmbientLightColorLoc = gl.getUniformLocation(myShaderProgram, "uAmbientLightColor");
  myShaderProgram.uniformDiffuseLightColorLoc = gl.getUniformLocation(myShaderProgram, "uDiffuseLightColor");
  myShaderProgram.uniformSpecularLightColorLoc = gl.getUniformLocation(myShaderProgram, "uSpecularLightColor");
  myShaderProgram.uniformShininessLoc = gl.getUniformLocation(myShaderProgram, "uShininess");
  myShaderProgram.uniformAmbientMaterialColorLoc = gl.getUniformLocation(myShaderProgram, "uKAmbient");
  myShaderProgram.uniformDiffuseMaterialColorLoc = gl.getUniformLocation(myShaderProgram, "uKDiffuse");
  myShaderProgram.uniformSpecularMaterialColorLoc = gl.getUniformLocation(myShaderProgram, "uKSpecular");
}

//-------------------------------------------------------------------------
/**
 * Sends material information to the teapot shader
 * @param {Float32} alpha shininess coefficient
 * @param {Float32Array} a Ambient material color
 * @param {Float32Array} d Diffuse material color
 * @param {Float32Array} s Specular material color
 */
function setMaterialUniforms(alpha,a,d,s) {
  gl.uniform1f(myShaderProgram.uniformShininessLoc, alpha);
  gl.uniform3fv(myShaderProgram.uniformAmbientMaterialColorLoc, a);
  gl.uniform3fv(myShaderProgram.uniformDiffuseMaterialColorLoc, d);
  gl.uniform3fv(myShaderProgram.uniformSpecularMaterialColorLoc, s);
}

//-------------------------------------------------------------------------
/**
 * Sends light information to the teapot
 * @param {Float32Array} loc Location of light source
 * @param {Float32Array} a Ambient light strength
 * @param {Float32Array} d Diffuse light strength
 * @param {Float32Array} s Specular light strength
 */
function setLightUniforms(loc,a,d,s) {
  gl.uniform3fv(myShaderProgram.uniformLightPositionLoc, loc);
  gl.uniform3fv(myShaderProgram.uniformAmbientLightColorLoc, a);
  gl.uniform3fv(myShaderProgram.uniformDiffuseLightColorLoc, d);
  gl.uniform3fv(myShaderProgram.uniformSpecularLightColorLoc, s);
}

/**
 * Sets the up the sphere mesh used to model each bouncing ball
 */
function setupBuffers(){
  var vBuffer=[];
  var nBuffer=[];
  var numT=sphereFromSubdivision(6, vBuffer, nBuffer);
  console.log("Generated ", numT, " triangles on sphere");

  // set the sphere vertex buffer
  sphereVBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, sphereVBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vBuffer), gl.STATIC_DRAW);
  sphereVBuffer.itemSize = 3;
  sphereVBuffer.numItems = numT*3;

  // set the sphere normal buffer
  sphereNBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, sphereNBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(nBuffer), gl.STATIC_DRAW);
  sphereNBuffer.itemSize = 3;
  sphereNBuffer.numItems = numT*3;

}

/**
 * Adds 50 new random spheres when user clicks button
 */
function addNewSphere(){
  console.log("More Spheres!");
  var i;
  // loop add 50 spheres
  for(i=0; i<50; i++){
    // x,y,z position between -4 aand 4
    position.push(vec3.fromValues(Math.random()*8-4, Math.random()*8-4, Math.random()*8-4));
    // x,z velocity between -1.5 and 1.5, y velocity between -.5 and .5
    velocity.push(vec3.fromValues(Math.random()*3-1.5, Math.random()*1-.5, Math.random()*3-1.5));
    // radius of each sphere betwen
    sizeScale=Math.random()/2+.1;
    size.push(vec3.fromValues(sizeScale, sizeScale, sizeScale));
    // random r,g,b values
    color.push(vec3.fromValues(Math.random(), Math.random(), Math.random()));
  }
}

/**
 * Draws a sphere to the screen
 */
function drawSphere(){
  gl.bindBuffer(gl.ARRAY_BUFFER, sphereVBuffer);
  gl.vertexAttribPointer(myShaderProgram.vertexPositionAttribute, sphereVBuffer.itemSize,
                         gl.FLOAT, false, 0, 0);

  // Bind normal buffer
  gl.bindBuffer(gl.ARRAY_BUFFER, sphereNBuffer);
  gl.vertexAttribPointer(myShaderProgram.vertexNormalAttribute,
                           sphereNBuffer.itemSize,
                           gl.FLOAT, false, 0, 0);
  gl.drawArrays(gl.TRIANGLES, 0, sphereVBuffer.numItems);
}


//----------------------------------------------------------------------------------
/**
 * Draw call that applies matrix transformations to model and draws model in frame
 */
function draw() {

    gl.viewport(0, 0, gl.viewportWidth, gl.viewportHeight);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // We'll use perspective
    mat4.perspective(pMatrix,degToRad(45),
                     gl.viewportWidth / gl.viewportHeight,
                     .1, 200.0);

    // We want to look down -z, so create a lookat point in that direction
    vec3.add(viewPt, eyePt, viewDir);

    // Then generate the lookat matrix and initialize the view matrix to that view
    mat4.lookAt(mvMatrix,eyePt,viewPt,up);

    // Loop through each sphere in the array and draw it based on position
    var i;
    for(i=0; i<position.length; i++){
      // save current model view matrix
      mvPushMatrix();
      // move it to position
      mat4.translate(mvMatrix, mvMatrix,position[i]);
      // scale it to the proper radius
      mat4.scale(mvMatrix, mvMatrix,size[i]);
      // send light information to the shaders
      setLightUniforms(lightPosition,lAmbient,lDiffuse,lSpecular);
      // send material information to shaders
      setMaterialUniforms(shininess,kAmbient,color[i],kSpecular);
      // set the matrix uniforms
      setMatrixUniforms();
      //draw
      drawSphere();
      // reset model matrix
      mvPopMatrix();
    }

}

//----------------------------------------------------------------------------------
//Code to handle user interaction
var currentlyPressedKeys = {};

/**
 * handles if key is pressed, saves value to array
 */
function handleKeyDown(event) {
        //console.log("Key down ", event.key, " code ", event.code);
        currentlyPressedKeys[event.key] = true;
}

/**
 * handles if key released, sets value in array to true
 */
function handleKeyUp(event) {
        //console.log("Key up ", event.key, " code ", event.code);
        currentlyPressedKeys[event.key] = false;
}

//----------------------------------------------------------------------------------
/**
 * Startup function called from html code to start program.
 */
 function startup() {
  canvas = document.getElementById("myGLCanvas");
  gl = createGLContext(canvas);
  setupShaders();
  setupBuffers();
  gl.clearColor(0.0, 0.0, 0.0, 1.0);
  gl.enable(gl.DEPTH_TEST);
  document.onkeydown = handleKeyDown;
  document.onkeyup = handleKeyUp;
  prevTime = Date.now();
  tick();
}

function checkCollision(position, velocity, size){
  //  if ball (position and radius) is outside of bounds, then flip the velocity and reflect
  // the position

  var i;
  for(i=0; i<3; i++){
    //check negative bounds of the box
    if(position[i]-size[i]<boxMin[i]){
      //reflect
      position[i]=position[i]+(boxMin[i]-(position[i]-size[i]))
      velocity[i]=-velocity[i]*.7; // add some loss of momentum due to collision
    }
    // check positive bounds of the box
    if(position[i]+size[i]>boxMax[i]){
      // reflect
      position[i]=position[i]-(position[i]+size[i]-boxMax[i]);
      velocity[i]=-velocity[i]*.7; // add some loss of momentum due to collision
    }
  }
}


//----------------------------------------------------------------------------------
/**
  * Update any model transformations
  */
function animate() {
   // If down is pressed, remove all spheres
   if(currentlyPressedKeys["ArrowDown"]){
     //get rid of all sphere values stored in arrays
     color=[];
     position=[];
     velocity=[];
     size=[];
   }

   // calculate time difference to use in calculations
   var curTime=Date.now();
   var tDelta = curTime-prevTime;
   prevTime=curTime;

   //get the drag
   var dragFactor = Math.pow(drag, .15);

   var i;
   for(i=0; i<position.length; i++){
     //calculate the new position
     vec3.scaleAndAdd(position[i], position[i], velocity[i], .15);

     // calculate the new velocity
     var temp = vec3.create();
     vec3.scale(temp, velocity[i], dragFactor);
     vec3.scaleAndAdd(velocity[i], temp, gravity, tDelta);
     checkCollision(position[i], velocity[i], size[i]);
   }
}


//----------------------------------------------------------------------------------
/**
 * Keeping drawing frames....
 */
function tick() {
    requestAnimFrame(tick);
    animate();
    draw();
}
