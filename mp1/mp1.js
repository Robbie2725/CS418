/** @global The WebGL context */
var gl;

/** @global The HTML5 canvas we draw on */
var canvas;

/** @global The buffer with BlockI vertex positions */
var  vertexPositionBuffer;

/** @global The buffer with BlockI vertex colors */
var vertexColorBuffer;

/** @global The buffer with custom animation vertex*/
var customVertexBuffer;

/** @global The buffer with custom animation colors*/
var customVColorBuffer;

/** @global 2 times Pi to simplify calculations */
var twicePi=2.0*3.14159;

/** @global A simple GLSL shader program */
var shaderProgram;

/** @global Count the frames rendered*/
var frameNumber=0;

/** @global The angle of rotation of BlockI around y axis*/
var rotationAngle=0;

/** @global The scale of BlockI during the squash animation */
var squashScale=0;

/** @global The rate at which the blockI squashes/stretches*/
var squashRate=-.01;

/** @global The Model View matrix */
var modelView = glMatrix.mat4.create();

/** @global Offset of BlockI Y vertices (Up/Down movement animation)*/
var y_offset=0;

/** @global The rate at which the BlockI moves up/down */
var y_rate=.05;

/** @global The angle of rotation of custom model around x/y axis*/
var customRotationAngle=0;

/** @global For saving custom angle to flip/flop between x/y rotations*/
var oldAngle=customRotationAngle;

/** @global Flag for rotating around x axis or y axis */
var switchFlag=0;

/** @global Limit for when to stop x rotation swicth to y rotation */
var xRotationLim = Math.PI;

/** @global Limit for when to stop y rotation swicth to x rotation */
var yRotationLim = Math.PI;

/** @global Array of colors used in BlockI */
var colors = [
  [0.9, 0.29, 0.15, 1.0], // orange
  [0.07, 0.16, 0.29, 1.0] // dark blue
];


/**
 * Creates a context for WebGL
 * @param {element} canvas WebGL canvas
 * @return {Object} WebGL context
 */
function createGLContext(canvas) {
  var context = null;
  context = canvas.getContext("webgl");
  if (context) {
    // If context found, set viewport dimensions to match canvas
    context.viewportWidth = canvas.width;
    context.viewportHeight = canvas.height;
  } else {
    //else alert user
    alert("Failed to create WebGL context!");
    console.log("Error with WebGL context");
  }
  return context;
}

/**
 * Setup the fragment and vertex shaders
 */
function setupShaders() {
  //Load the vertex and fragment shaders
  vertexShader =loadShaderFromDOM("shader-v");
  fragmentShader =loadShaderFromDOM("shader-f");

  //Create the shader program and attach the vertex/fragment shaders
  shaderProgram = gl.createProgram();
  gl.attachShader(shaderProgram, vertexShader);
  gl.attachShader(shaderProgram, fragmentShader);
  gl.linkProgram(shaderProgram);

  if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
    //Alert if shaders not set up properly
    alert("Failed to setup shaders");
    console.log("Failed to setup shaders!");
  }

  // Use the shaderProgram just created
  gl.useProgram(shaderProgram);

  // Get attributes from shaders and enable arrays that will be needed later
  shaderProgram.vertexPositionAttribute = gl.getAttribLocation(shaderProgram, "aVertexPosition");
  shaderProgram.vertexColorAttribute = gl.getAttribLocation(shaderProgram, "aVertexColor");
  gl.enableVertexAttribArray(shaderProgram.vertexPositionAttribute);
  gl.enableVertexAttribArray(shaderProgram.vertexColorAttribute);

  // Get the location of model view matrix needed for affine transformations
  shaderProgram.modelViewUniform = gl.getUniformLocation(shaderProgram, "uModelView");
}

/**
 * Loads and compiles shader from DOM
 * @param {string} id ID string for shader to load, either a vertex shader or fragment shader
 * @return {WebGLShader} the shader loaded
 */
function loadShaderFromDOM(id){
  var script = document.getElementById(id);
  if(!script){
    // Fail if element with this ID not found
    console.log("Failed to load shader by id: ", id);
    return null;
  }

  // Loop through DOM element and load shader source code
  var source = "";
  var cur = script.firstChild;
  while(cur){
    if(cur.nodeType == 3 ) {source+=cur.textContent;}
    cur =cur.nextSibling;
  }

  // Create approriate shader type based on DOM type
  var shader;
  if(script.type=="x-shader/x-fragment") {shader=gl.createShader(gl.FRAGMENT_SHADER);}
  else if(script.type=="x-shader/x-vertex") {shader=gl.createShader(gl.VERTEX_SHADER);}
  else {
    console.log("Failed to get type: ", id);
    return null;
  }

  // Set the source code and compile
  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    // If not compiled successfully, alert and return null
    alert(gl.getShaderInfoLog(shader));
    console.log(source);
    console.log("Failed to load shader!");
    return null;
  }

  return shader; // return the compiled shader
}

/**
 * Populate buffers with data for modelling the BlockI
 */
function setupBuffers() {
  // First, generate vertex postions and add them to a buffer
  // Create vertex buffer
  vertexPositionBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vertexPositionBuffer);

  // Array containing vertex locations
  var vertexArray = [
    //small I vertices
    -.75, .95, 0.0,
    -.75, 0.5, 0.0,
    .75, .95, 0.0,
    .75, 0.5, 0.0,
    -.35, .5, 0,
    .35, .5, 0,
    -.35, -.5, 0,
    .35, -.5, 0,
    -.75, -.5, 0,
    -.75, -.95, 0,
    .35, -.95, 0,
    .35, -.5, 0,
    .75, -.95, 0,
    .75, -.5, 0,
    //Big I vertices
    -.8, 1.0, 0.0,
    -.8, 0.45, 0.0,
    .8, 1.0, 0.0,
    .8, 0.45, 0.0,
    -.4, .45, 0,
    .4, .45, 0,
    -.4, -.45, 0,
    .4, -.45, 0,
    -.8, -.45, 0,
    -.8, -1, 0,
    .4, -1, 0,
    .4, -.45, 0,
    .8, -1, 0,
    .8, -.45, 0
  ];

  //Animation from modifying vertex buffer, moves logo up/down
  for(i=0; i<vertexArray.length; i++){
    if(i%3===0) {
      vertexArray[i+1]+=y_offset; // Add the y offset if it is the y coordinate to a vertex
    }
  }

  //Scaled the model down (to avoid clipping animated)
  scaledArray = vertexArray.map( x => x/2 );

  // Add the vertex data to the buffer
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(scaledArray), gl.DYNAMIC_DRAW);
  vertexPositionBuffer.itemSize=3;
  vertexPositionBuffer.numberOfItems=28;

  // Second, add corresponding vertex colors to a buffer
  // Create color buffer
  vertexColorBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vertexColorBuffer);

  //Create array to hold colors, and add a color per vertex (i.e. 28 colors)
  var vColors=[];
  for(i=0; i<28; i++){
    if(i<14){
      // For first 14, add orange (small I)
      vColors.push(colors[0][0], colors[0][1], colors[0][2], colors[0][3]);
    }
    else{
      // For last 14, add dark blue (big I)
      vColors.push(colors[1][0], colors[1][1], colors[1][2], colors[1][3]);
    }
  }

  //Add colors to the buffer
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vColors), gl.DYNAMIC_DRAW);
  vertexColorBuffer.itemSize=4;
  vertexColorBuffer.numberOfItems=28;
}

/**
 * Draw the BlockI model (render frame)
 */
function draw(){
  // Set the viewport dimensions and re-initialize the color buffer
  gl.viewport(0,0,gl.viewportWidth, gl.viewportHeight);
  gl.clear(gl.COLOR_BUFFER_BIT);

  // Tell webgl how to load vertices from buffer into positon attribute
  gl.bindBuffer(gl.ARRAY_BUFFER, vertexPositionBuffer);
  gl.vertexAttribPointer(shaderProgram.vertexPositionAttribute, vertexPositionBuffer.itemSize, gl.FLOAT, false, 0, 0);

  // Tell webgl how to load colors from buffer into color attribute
  gl.bindBuffer(gl.ARRAY_BUFFER, vertexColorBuffer);
  gl.vertexAttribPointer(shaderProgram.vertexColorAttribute, vertexColorBuffer.itemSize, gl.FLOAT, false, 0, 0);

  // Reset the model view matrix
  glMatrix.mat4.identity(modelView);

  // Temporary matrices for preforming animation calculations seperately
  var affine1 = glMatrix.mat4.create();
  var affine2 = glMatrix.mat4.create();

  // First affine transformation (squashing the Block I)
  for(i=0; i<3; i++){
    affine1[4*i+i]-=squashScale; //Add the squash scale to corresponding x,y,z element in matrix
  }

  // Second affine transformation (rotation around y axis)
  glMatrix.mat4.rotate(affine2,
              affine2,
              rotationAngle,
              [0,1,0]);

  // Set the model view matrix to the combination of these two transformations
  glMatrix.mat4.multiply(modelView, affine1, affine2);
  // Set the uniforms
  gl.uniformMatrix4fv(shaderProgram.modelViewUniform, false, modelView);

  // Draw the blue I
  gl.drawArrays(gl.TRIANGLE_STRIP, 14, 14);
  // Then the orange I over the blue I (so it appears to have the blue border)
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 14);

}

/**
 * Called each time frame is rendered, updates global variables for BlockI animation and makes call to
 * update the vertex buffer.
 */
function animate(){
  // Increase the angle of rotation after each frame is rendered
  rotationAngle+=.04;

  if(squashScale>.25){
    // If the block I is too large, make squash rate negative
    // so that it shrinks
    squashRate=-.01;
  }
  else if(squashScale<0){
    // If the block I is too small, make squash rate positive
    // so that it grows
    squashRate=.01;
  }
  // Change the scale of the block I
  squashScale+=squashRate;

  if(y_offset>1){
    // If the block I is too far up, make y offset decrease
    y_rate=-.05;
  }
  else if(y_offset<-1){
    // If the block I is too far down, make y offset increase
    y_rate=.05;
  }
  y_offset+=y_rate;

  // Call setupBuffers to update the vertices locations of the block I  (for up/down animation)
  setupBuffers();
}

/**
 * Startup function called from html code to start program.
 */
 function startup() {
  console.log("Startup Function Called");

  // get canvas to render model on
  canvas = document.getElementById("myGLCanvas");

  // create context
  gl = createGLContext(canvas);

  // Setup the shaders and buffers
  setupShaders();
  setupBuffers(); // BlockI buffers
  setupCustomBuffers(); // Custom model buffers

  // Set the clear color to white
  gl.clearColor(1.0, 1.0, 1.0, 1.0);

  // Call tick function, which will then be called every subsequent animation frame
  tick();
}

/**
 * Called every animation frame. Depending radio button value, either makes call
 * to render BlockI or Custom Model
 */
function tick(){
  // Track frame number
  console.log("Frame ", frameNumber);
  frameNumber++;

  // Tell browser to call tick function before next repaint
  requestAnimationFrame(tick);
  if(document.getElementById('btn1').checked){
    // Draw and animate block I if block I button selected
    draw();
    animate();
  }
  else if(document.getElementById('btn2').checked){
    // Draw and animate custom model if custom button selected
    draw_custom();
    animate_custom();
  }
  else{
    // If neither selected, just draw and animate the block I
    //Should never reach this, but here just in case button doesn't work
    draw();
    animate();
  }
}

/**
 * Populate buffers with data for custom model
 */
function setupCustomBuffers(){
  // First, generate vertex postions and add them to a buffer
  // Create vertex buffer
  customVertexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, customVertexBuffer);

  // The radius of the circles that will be modeled
  var radius = .25;

  // Create array to hold the circle vertices
  var circleVertices = [.5,.5,0]; //center of circle in upper right corner
  // Add 256 vertices, where the last and first are the same (so the circle is completed)
  for(i=0; i<=255; i++){
    // Calculate angle of the vertex, then the x/y location
    var angle = i*twicePi/255;
    var x = radius*Math.cos(angle) + .5; // Add offset so it is centered around (.5, .5, 0)
    var y = radius*Math.sin(angle) + .5;
    circleVertices.push(x);
    circleVertices.push(y);
    circleVertices.push(0); // z always 0
  }

  //center of circle in lower left corner
  circleVertices.push(-.5);
  circleVertices.push(-.5);
  circleVertices.push(0);

  // Again, add 256 vertices, where the last and first are the same (so the circle is completed)
  for(i=0; i<=255; i++){
    // Calculate angle of the vertex, then the x/y location
    var angle = i*twicePi/255;
    var x = radius*Math.cos(angle) - .5; // Add offset so it is centered around (-.5, -.5, 0)
    var y = radius*Math.sin(angle) - .5;
    circleVertices.push(x);
    circleVertices.push(y);
    circleVertices.push(0); // z always 0
  }

  // Add vertex data to the buffer
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(circleVertices), gl.STATIC_DRAW);
  customVertexBuffer.itemSize = 3;
  //# of vertices + origin + repeated vertex that closes circle, doubled since 2 circles
  customVertexBuffer.numberOfItems = 2*257;

  // Second, add corresponding vertex colors to a buffer
  // Create color buffer
  customVColorBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, customVColorBuffer);

  // create array to hold the colors
  var circleColors = [1, 1, 1, 1]; //Start with white center
  // Loop to add one color per vertex of the first circle
  for(i=0; i<=255; i++){
    // Calculations to make a gradient
    var b = Math.abs(2*i/255-1);
    var g = 0;
    var r = 1-b;
    // Add the r,g,b values to the array
    circleColors.push(r);
    circleColors.push(g);
    circleColors.push(b);
    circleColors.push(1); //alpha always 1
  }

  //White center of second circle
  circleColors.push(1);
  circleColors.push(1);
  circleColors.push(1);
  circleColors.push(1);

  // Loop to add one color per vertex of the second circle
  for(i=0; i<=255; i++){
    // Calculations to make a gradient
    var g = Math.abs(2*i/255-1);
    var r = 1-g;
    var b = 1-g;
    // Add the r,g,b values to the array
    circleColors.push(r);
    circleColors.push(g);
    circleColors.push(b);
    circleColors.push(1); //alpha always 1
  }

  // Add color data to the buffer
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(circleColors), gl.STATIC_DRAW);
  customVColorBuffer.itemSize = 4;
  //# of vertices + origin + repeated vertex that closes circle, doubled since 2 circles
  customVColorBuffer.numberOfItems = 2*257;
}

/**
 * Draw the custom model (render frame)
 */
function draw_custom(){
  // Set the viewport dimensions and re-initialize the color buffer
  gl.viewport(0,0,gl.viewportWidth, gl.viewportHeight);
  gl.clear(gl.COLOR_BUFFER_BIT);

  // Tell webgl how to load vertices from buffer into positon attribute
  gl.bindBuffer(gl.ARRAY_BUFFER, customVertexBuffer);
  gl.vertexAttribPointer(shaderProgram.vertexPositionAttribute, customVertexBuffer.itemSize, gl.FLOAT, false, 0, 0);

  // Tell webgl how to load colors from buffer into color attribute
  gl.bindBuffer(gl.ARRAY_BUFFER, customVColorBuffer);
  gl.vertexAttribPointer(shaderProgram.vertexColorAttribute, customVColorBuffer.itemSize, gl.FLOAT, false, 0, 0);

  // Reset the model view matrix
  glMatrix.mat4.identity(modelView);

  // Temporary matrices for performing the x and y rotations seperately
  var rot1 = glMatrix.mat4.create();
  var rot2 = glMatrix.mat4.create();

  if(!switchFlag){
    // If switch flag false, then rotate around y with the saved angle,
    // then rotate around x with the current animation angle
    glMatrix.mat4.rotate(rot1,
      rot1,
      oldAngle,
      [0,1,0]);
    glMatrix.mat4.rotate(rot2,
      rot2,
      customRotationAngle,
      [1,0,0]);
  }
  else{
    // Else rotate around x with the saved angle,
    // then rotate around y with the current animation angle
    glMatrix.mat4.rotate(rot1,
      rot1,
      oldAngle,
      [1,0,0]);
    glMatrix.mat4.rotate(rot2,
      rot2,
      customRotationAngle,
      [0,1,0]);
  }

  // Set the model view matrix to the combination of the two rotations
  glMatrix.mat4.multiply(modelView, rot1, rot2);

  // Set the model view uniform
  gl.uniformMatrix4fv(shaderProgram.modelViewUniform, false, modelView);

  // Draw the first circle
  gl.drawArrays(gl.TRIANGLE_FAN, 0, customVertexBuffer.numberOfItems/2);
  // Then the second circle  (at an offset of the number of vertices in the first circle)
  gl.drawArrays(gl.TRIANGLE_FAN, customVertexBuffer.numberOfItems/2, customVertexBuffer.numberOfItems/2)
}

/**
 * Called each time frame is rendered, updates global variables for custom animation.
 */
function animate_custom(){
  // Increase angle of rotation after each frame
  customRotationAngle+=.01;
  console.log(customRotationAngle); // log the current angle of rotation (for debugging)
  var temp; // in order to save current rotation angle and reset to the old one
  if(customRotationAngle>=xRotationLim && !switchFlag){
    // If the current rotation angle is greater than the limit (a multiple of Pi),
    // and it is currently rotating around the x axis (i.e. switch flag is false),
    // then save the x rotation angle to old angle, and then set the rotation angle
    // to the previous y rotation angle (stored in oldAngle)
    xRotationLim+=Math.PI;
    temp = customRotationAngle;
    customRotationAngle=oldAngle;
    oldAngle=temp;
    // Flip the switch flag to now rotate around y
    switchFlag=1;
  }
  else if(customRotationAngle>=yRotationLim && switchFlag){
    // If the current rotation angle is greater than the limit (a multiple of Pi),
    // and it is currently rotating around the y axis (i.e. switch flag is true),
    // then save the y rotation angle to old angle, and then set the rotation angle
    // to the previous x rotation angle (stored in oldAngle)
    yRotationLim+=Math.PI;
    temp = customRotationAngle;
    customRotationAngle=oldAngle;
    oldAngle=temp;
    // Flip the switch flag to now rotate around x
    switchFlag=0;
  }
}
