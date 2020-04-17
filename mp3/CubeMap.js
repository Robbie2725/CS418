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

   const londonMap = [
      {
        target: gl.TEXTURE_CUBE_MAP_POSITIVE_X,
        url: 'London/pos-x.jpg'
      },
      {
        target: gl.TEXTURE_CUBE_MAP_NEGATIVE_X,
        url: 'London/neg-x.jpg'
      },
      {
        target: gl.TEXTURE_CUBE_MAP_POSITIVE_Y,
        url: 'London/pos-y.jpg'
      },
      {
        target: gl.TEXTURE_CUBE_MAP_NEGATIVE_Y,
        url: 'London/neg-y.jpg'
      },
      {
        target: gl.TEXTURE_CUBE_MAP_POSITIVE_Z,
        url: 'London/pos-z.jpg'
      },
      {
        target: gl.TEXTURE_CUBE_MAP_NEGATIVE_Z,
        url: 'London/neg-z.jpg'
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
     });
   });

   gl.generateMipmap(gl.TEXTURE_CUBE_MAP);
   gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);

 }
