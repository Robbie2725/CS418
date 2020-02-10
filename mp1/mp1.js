/** @global The WebGL context */
var gl;

/** @global The HTML5 canvas we draw on */
var canvas;

/** @global The buffer with vertex positions */
var  vertexPositionBuffer;

var vertexColorBuffer;

var  customVertexBuffer;

var customVColorBuffer;

var twicePi=2.0*3.14159;

/** @global A simple GLSL shader program */
var shaderProgram;

var frameNumber=0;

var rotationAngle=0;

var squashScale=0;

var squashRate=-.01;

var modelView = glMatrix.mat4.create();

var y_offset=0;

var y_rate=.001;

var customRotationAngle=0;

var oldAngle=customRotationAngle;

var switchFlag=0;

var xRotationLim = Math.PI;

var yRotationLim = Math.PI;

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
    context.viewportWidth = canvas.width;
    context.viewportHeight = canvas.height;
  } else {
    alert("Failed to create WebGL context!");
    console.log("Error with WebGL context");
  }
  return context;
}

/**
 * Setup the fragment and vertex shaders
 */
function setupShaders() {

  vertexShader =loadShaderFromDOM("shader-v");
  fragmentShader =loadShaderFromDOM("shader-f");

  shaderProgram = gl.createProgram();
  gl.attachShader(shaderProgram, vertexShader);
  gl.attachShader(shaderProgram, fragmentShader);
  gl.linkProgram(shaderProgram);

  if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
    alert("Failed to setup shaders");
    console.log("Failed to setup shaders!");
  }

  gl.useProgram(shaderProgram);
  shaderProgram.vertexPositionAttribute = gl.getAttribLocation(shaderProgram, "aVertexPosition");
  shaderProgram.vertexColorAttribute = gl.getAttribLocation(shaderProgram, "aVertexColor");

  gl.enableVertexAttribArray(shaderProgram.vertexPositionAttribute);
  gl.enableVertexAttribArray(shaderProgram.vertexColorAttribute);

  shaderProgram.modelViewUniform = gl.getUniformLocation(shaderProgram, "uModelView");
}

function loadShaderFromDOM(id){
  var script = document.getElementById(id);
  if(!script){
    console.log("Failed to load shader by id: ", id);
    return null;
  }

  var source = "";
  var cur = script.firstChild;
  while(cur){
    if(cur.nodeType == 3 ) {source+=cur.textContent;}
    cur =cur.nextSibling;
  }
  var shader;
  if(script.type=="x-shader/x-fragment") {shader=gl.createShader(gl.FRAGMENT_SHADER);}
  else if(script.type=="x-shader/x-vertex") {shader=gl.createShader(gl.VERTEX_SHADER);}
  else {
    console.log("Failed to get type: ", id);
    return null;
  }
  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    alert(gl.getShaderInfoLog(shader));
    console.log(source);
    console.log("Failed to load shader!");
    return null;
  }

  return shader;
}

/**
 * Populate buffers with data
 */
function setupBuffers() {
  // console.log("setupBuffers Called");
  vertexPositionBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vertexPositionBuffer);
  var vertexArray = [
    //small I
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
    //Big I
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
      vertexArray[i+1]+=y_offset;
    }
  }

  scaledArray = vertexArray.map( x => x/2 ); // Scaled because Block I too big for canvas when rotating
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(scaledArray), gl.DYNAMIC_DRAW);
  vertexPositionBuffer.itemSize=3;
  vertexPositionBuffer.numberOfItems=28;

  vertexColorBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vertexColorBuffer);
  var vColors=[];
  for(i=0; i<28; i++){
    if(i<14){
      vColors.push(colors[0][0], colors[0][1], colors[0][2], colors[0][3])
    }
    else{
      vColors.push(colors[1][0], colors[1][1], colors[1][2], colors[1][3]);
    }
  }
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vColors), gl.DYNAMIC_DRAW);
  vertexColorBuffer.itemSize=4;
  vertexColorBuffer.numberOfItems=28;
}

/**
 * Draw model (render frame)
 */
function draw(){
  gl.viewport(0,0,gl.viewportWidth, gl.viewportHeight);
  gl.clear(gl.COLOR_BUFFER_BIT);

  gl.bindBuffer(gl.ARRAY_BUFFER, vertexPositionBuffer);
  gl.vertexAttribPointer(shaderProgram.vertexPositionAttribute, vertexPositionBuffer.itemSize, gl.FLOAT, false, 0, 0);

  gl.bindBuffer(gl.ARRAY_BUFFER, vertexColorBuffer);
  gl.vertexAttribPointer(shaderProgram.vertexColorAttribute, vertexColorBuffer.itemSize, gl.FLOAT, false, 0, 0);

  var affine1 = glMatrix.mat4.create();
  var affine2 = glMatrix.mat4.create();

  glMatrix.mat4.identity(modelView);
  //first affine transformation = squashing
  for(i=0; i<3; i++){
    affine1[4*i+i]-=squashScale;
  }

  //then second transformation = rotate
  glMatrix.mat4.rotate(affine2,
              affine2,
              rotationAngle,
              [0,1,0]);

  // Set the uniforms
  glMatrix.mat4.multiply(modelView, affine1, affine2);
  gl.uniformMatrix4fv(shaderProgram.modelViewUniform, false, modelView);

  // Draw blue I first
  gl.drawArrays(gl.TRIANGLE_STRIP, 14, 14);
  // Then the orange I
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 14);

}

function animate(){
  rotationAngle+=.04;
  if(squashScale>.25){
    squashRate=-.01;
  }
  else if(squashScale<0){
    squashRate=.005;
  }
  squashScale+=squashRate;
  if(y_offset>1.5){
    y_rate=-.005;
  }
  else if(y_offset<-1.5){
    y_rate=.005;
  }
  y_offset+=y_rate;
  setupBuffers();

}

/**
 * Startup function called from html code to start program.
 */
 function startup() {
  console.log("Startup Function Called");
  canvas = document.getElementById("myGLCanvas");
  gl = createGLContext(canvas);
  setupShaders();
  setupBuffers();
  setupCustomBuffers();
  gl.clearColor(1.0, 1.0, 1.0, 1.0);
  tick();
}

function tick(){
  // console.log("Frame ", frameNumber);
  frameNumber++;
  requestAnimationFrame(tick);
  if(document.getElementById('btn1').checked){
    draw();
    animate();
  }
  else if(document.getElementById('btn2').checked){
    draw_custom();
    animate_custom();
  }
  else{
    //Should never reach this
    draw();
    animate();
  }
}

function setupCustomBuffers(){
  //first the vertex positions
  customVertexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, customVertexBuffer);

  var circleVertices = [.5,.5,0]; //center of circle in upper right corner
  var radius = .25;
  for(i=0; i<=255; i++){
    var angle = i*twicePi/255;
    var x = radius*Math.cos(angle) + .5;
    var y = radius*Math.sin(angle) + .5; //TODO => change?
    circleVertices.push(x);
    circleVertices.push(y);
    circleVertices.push(0);
  }

  //center of circle in lower left corner
  circleVertices.push(-.5);
  circleVertices.push(-.5);
  circleVertices.push(0);

  for(i=0; i<=255; i++){
    var angle = i*twicePi/255;
    var x = radius*Math.cos(angle) - .5;
    var y = radius*Math.sin(angle) - .5; //TODO => change?
    circleVertices.push(x);
    circleVertices.push(y);
    circleVertices.push(0);
  }

  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(circleVertices), gl.STATIC_DRAW); // TODO => DYNAMIC_DRAW?
  customVertexBuffer.itemSize = 3;
  customVertexBuffer.numberOfItems = 2*257; //# of vertices + origin + repeated vertex that closes circle

  //then vertex colors
  customVColorBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, customVColorBuffer);

  var circleColors = [1, 1, 1, 1]; //Start with white center
  for(i=0; i<=255; i++){
    var b = Math.abs(2*i/255-1);
    var g = 0;
    var r = 1-b;
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
  for(i=0; i<=255; i++){
    var g = Math.abs(2*i/255-1);
    var r = 1-g;
    var b = 1-g;
    circleColors.push(r);
    circleColors.push(g);
    circleColors.push(b);
    circleColors.push(1); //alpha always 1
  }

  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(circleColors), gl.STATIC_DRAW);
  customVColorBuffer.itemSize = 4;
  customVColorBuffer.numberOfItems = 2*257; //# of vertices + origin + repeated vertex that closes circle
}

function draw_custom(){
  gl.viewport(0,0,gl.viewportWidth, gl.viewportHeight);
  gl.clear(gl.COLOR_BUFFER_BIT);

  gl.bindBuffer(gl.ARRAY_BUFFER, customVertexBuffer);
  gl.vertexAttribPointer(shaderProgram.vertexPositionAttribute, customVertexBuffer.itemSize, gl.FLOAT, false, 0, 0);

  gl.bindBuffer(gl.ARRAY_BUFFER, customVColorBuffer);
  gl.vertexAttribPointer(shaderProgram.vertexColorAttribute, customVColorBuffer.itemSize, gl.FLOAT, false, 0, 0);

  glMatrix.mat4.identity(modelView);

  var rot1 = glMatrix.mat4.create();
  var rot2 = glMatrix.mat4.create();

  if(!switchFlag){
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
    glMatrix.mat4.rotate(rot1,
      rot1,
      oldAngle,
      [1,0,0]);
    glMatrix.mat4.rotate(rot2,
      rot2,
      customRotationAngle,
      [0,1,0]);
  }

  glMatrix.mat4.multiply(modelView, rot1, rot2);


  gl.uniformMatrix4fv(shaderProgram.modelViewUniform, false, modelView);

  gl.drawArrays(gl.TRIANGLE_FAN, 0, customVertexBuffer.numberOfItems/2);
  gl.drawArrays(gl.TRIANGLE_FAN, customVertexBuffer.numberOfItems/2, customVertexBuffer.numberOfItems/2)
}

function animate_custom(){
  customRotationAngle+=.01;
  console.log(customRotationAngle);
  var temp;
  if(customRotationAngle>=xRotationLim && !switchFlag){
    xRotationLim+=Math.PI;
    temp = customRotationAngle;
    customRotationAngle=oldAngle;
    oldAngle=temp;
    switchFlag=1;
  }
  else if(customRotationAngle>=yRotationLim && switchFlag){
    yRotationLim+=Math.PI;
    temp = customRotationAngle;
    customRotationAngle=oldAngle;
    oldAngle=temp;
    switchFlag=0;
  }
}
