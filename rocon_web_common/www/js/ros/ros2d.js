/**
 * @author Russell Toris - rctoris@wpi.edu
 */

var ROS2D = ROS2D || {
  REVISION : '2-devel'
};

// convert the given global Stage coordinates to ROS coordinates
createjs.Stage.prototype.globalToRos = function(x, y) {
  var rosX = x / this.scaleX;
  // change Y direction
  var rosY = (this.y - y) / this.scaleY;
  return {
    x : rosX,
    y : rosY
  };
};

createjs.Stage.prototype.rosToGlobal = function(x,y) {
  var globalX = x  * this.scaleX;
  var globalY = this.y - (y * this.scaleY);

  return {
    x : globalX,
    y : globalY
  };
};

// convert a ROS quaternion to theta in degrees
createjs.Stage.prototype.rosQuaternionToGlobalTheta = function(orientation) {
  // convert to radians
  var q0 = orientation.w;
  var q1 = orientation.x;
  var q2 = orientation.y;
  var q3 = orientation.z;
  var theta = Math.atan2(2 * (q0 * q3 + q1 * q2), 1 - 2 * (Math.pow(q2, 2) + Math.pow(q3, 2)));

  // convert to degrees
  var deg = theta * (180.0 / Math.PI);
  if (deg >= 0 && deg <= 180) {
    deg += 270;
  } else {
    deg -= 90;
  }

  return -deg;
};

// degrees to quaternion
createjs.Stage.prototype.globalThetaTorosQuaternion = function(theta) {
  var rad = -((theta - 90) * Math.PI / 180);

  var halfyaw = rad * 0.5;
  var cosyaw = Math.cos(halfyaw);
  var sinyaw = Math.sin(halfyaw);
  var cospitch = 1;
  var sinpitch = 0;
  var cosroll = 1;
  var sinroll = 0;
  
  return {  x : sinroll * cospitch * cosyaw - cosroll * sinpitch * sinyaw, // x
            y : cosroll * sinpitch * cosyaw + sinroll * cospitch * sinyaw, // y
            z : cosroll * cospitch * sinyaw - sinroll * sinpitch * cosyaw, // z
            w : cosroll * cospitch * cosyaw + sinroll * sinpitch * sinyaw, // w
          };

};


// RPY to quaternion
createjs.Stage.prototype.globalRPYTorosQuaternion = function(roll,pitch,yaw) {
  var halfyaw = yaw * 0.5;
  var halfroll = roll * 0.5;
  var halfpitch = pitch * 0.5;
  var cosyaw = Math.cos(halfyaw);
  var sinyaw = Math.sin(halfyaw);
  var cospitch = Math.cos(halfpitch);
  var sinpitch = Math.sin(halfpitch);
  var cosroll = Math.cos(halfroll);
  var sinroll = Math.sin(halfroll);
  
  return {  x : sinroll * cospitch * cosyaw - cosroll * sinpitch * sinyaw, // x
            y : cosroll * sinpitch * cosyaw + sinroll * cospitch * sinyaw, // y
            z : cosroll * cospitch * sinyaw - sinroll * sinpitch * cosyaw, // z
            w : cosroll * cospitch * cosyaw + sinroll * sinpitch * sinyaw, // w
          };
};

createjs.Stage.prototype.rosQuaternionToGlobalRPY = function(q) {
  var roll  = Math.atan2(q.w * q.x + q.y * q.z, 1 - 2 * (q.x * q.x + q.y * q.y));
  var pitch = Math.asin(2 * ( q.w * q.y - q.z * q.x));
  var yaw   = Math.atan2(2 * (q.w * q.z + q.x * q.y), 1 - 2 * (q.y * q.y + q.z * q.z));

  return {roll : roll,
          pitch: pitch,
          yaw : yaw};
};




/**
 * @author Russell Toris - rctoris@wpi.edu
 */

/**
 * An OccupancyGrid can convert a ROS occupancy grid message into a createjs Bitmap object.
 *
 * @constructor
 * @param options - object with following keys:
 *   * message - the occupancy grid message
 */
ROS2D.OccupancyGrid = function(options) {
  options = options || {};
  var message = options.message;

  // internal drawing canvas
  var canvas = document.createElement('canvas');
  var context = canvas.getContext('2d');

  // save the metadata we need
  this.origin = new ROSLIB.Pose({
    position : message.info.origin.position,
    orientation : message.info.origin.orientation
  });

  // set the size
  this.width = message.info.width;
  this.height = message.info.height;
  canvas.width = this.width;
  canvas.height = this.height;

  var imageData = context.createImageData(this.width, this.height);
  for ( var row = 0; row < this.height; row++) {
    for ( var col = 0; col < this.width; col++) {
      // determine the index into the map data
      var mapI = col + ((this.height - row - 1) * this.width);
      // determine the value
      var data = message.data[mapI];
      var val;
      if (data === 100) {
        val = 0;
      } else if (data === 0) {
        val = 255;
      } else {
        val = 127;
      }

      // determine the index into the image data array
      var i = (col + (row * this.width)) * 4;
      // r
      imageData.data[i] = val;
      // g
      imageData.data[++i] = val;
      // b
      imageData.data[++i] = val;
      // a
      imageData.data[++i] = 255;
    }
  }
  context.putImageData(imageData, 0, 0);

  // create the bitmap
  createjs.Bitmap.call(this, canvas);
  // change Y direction
  this.y = -this.height * message.info.resolution;
  this.scaleX = message.info.resolution;
  this.scaleY = message.info.resolution;
  this.width *= this.scaleX;
  this.height *= this.scaleY;
};
ROS2D.OccupancyGrid.prototype.__proto__ = createjs.Bitmap.prototype;

/**
 * @author Russell Toris - rctoris@wpi.edu
 */

/**
 * A map that listens to a given occupancy grid topic.
 *
 * Emits the following events:
 *   * 'change' - there was an update or change in the map
 *
 * @constructor
 * @param options - object with following keys:
 *   * ros - the ROSLIB.Ros connection handle
 *   * topic (optional) - the map topic to listen to
 *   * rootObject (optional) - the root object to add this marker to
 *   * continuous (optional) - if the map should be continuously loaded (e.g., for SLAM)
 */
ROS2D.OccupancyGridClient = function(options) {
  var that = this;
  options = options || {};
  var ros = options.ros;
  var topic = options.topic || '/map';
  this.continuous = options.continuous;
  this.rootObject = options.rootObject || new createjs.Container();

  // current grid that is displayed
  this.currentGrid = null;

  // subscribe to the topic
  var rosTopic = new ROSLIB.Topic({
    ros : ros,
    name : topic,
    messageType : 'nav_msgs/OccupancyGrid',
    compression : 'png'
  });
  rosTopic.subscribe(function(message) {
    // check for an old map
    if (that.currentGrid) {
      that.rootObject.removeChild(that.currentGrid);
    }

    that.currentGrid = new ROS2D.OccupancyGrid({
      message : message
    });
    that.rootObject.addChild(that.currentGrid);

    that.emit('change',that.currentGrid.origin);

    // check if we should unsubscribe
    if (!that.continuous) {
      rosTopic.unsubscribe();
      console.log('OccupancyGridClient : Unsub from ' + topic);
    }
  });
};
ROS2D.OccupancyGridClient.prototype.__proto__ = EventEmitter2.prototype;

/**
 * @author Russell Toris - rctoris@wpi.edu
 */

/**
 * A navigation arrow is a directed triangle that can be used to display orientation.
 *
 * @constructor
 * @param options - object with following keys:
 *   * size (optional) - the size of the marker
 *   * strokeSize (optional) - the size of the outline
 *   * strokeColor (optional) - the createjs color for the stroke
 *   * fillColor (optional) - the createjs color for the fill
 *   * pulse (optional) - if the marker should "pulse" over time
 */
ROS2D.NavigationArrow = function(options) {
  var that = this;
  options = options || {};
  var size = options.size || 10;
  var strokeSize = options.strokeSize || 3;
  var strokeColor = options.strokeColor || createjs.Graphics.getRGB(0, 0, 0);
  var fillColor = options.fillColor || createjs.Graphics.getRGB(255, 0, 0);
  var pulse = options.pulse;

  // draw the arrow
  var graphics = new createjs.Graphics();
  // line width
  graphics.setStrokeStyle(strokeSize);
  graphics.moveTo(-size / 2.0, size / 2.0);
  graphics.beginStroke(strokeColor);
  graphics.beginFill(fillColor);
  graphics.lineTo(0, -size);
  graphics.lineTo(size / 2.0, size / 2.0);
  graphics.lineTo(-size / 2.0, size / 2.0);
  graphics.closePath();
  graphics.endFill();
  graphics.endStroke();

  // create the shape
  createjs.Shape.call(this, graphics);
  
  // check if we are pulsing
  if (pulse) {
    // have the model "pulse"
    var growCount = 0;
    var growing = true;
    createjs.Ticker.addEventListener('tick', function() {
      if (growing) {
        that.scaleX *= 1.035;
        that.scaleY *= 1.035;
        growing = (++growCount < 10);
      } else {
        that.scaleX /= 1.035;
        that.scaleY /= 1.035;
        growing = (--growCount < 0);
      }
    });
  }
};
ROS2D.NavigationArrow.prototype.__proto__ = createjs.Shape.prototype;

/**
 * @author Russell Toris - rctoris@wpi.edu
 */

/**
 * A Viewer can be used to render an interactive 2D scene to a HTML5 canvas.
 *
 * @constructor
 * @param options - object with following keys:
 *   * divID - the ID of the div to place the viewer in
 *   * width - the initial width, in pixels, of the canvas
 *   * height - the initial height, in pixels, of the canvas
 *   * background (optional) - the color to render the background, like '#efefef'
 */
ROS2D.Viewer = function(options) {
  var that = this;
  options = options || {};
  var divID = options.divID;
  this.width = options.width;
  this.height = options.height;
  var background = options.background || '#111111';

  // create the canvas to render to
  var canvas = document.createElement('canvas');
  canvas.width = this.width;
  canvas.height = this.height;
  canvas.style.background = background;
  document.getElementById(divID).appendChild(canvas);
  // create the easel to use
  this.scene = new createjs.Stage(canvas);

  // change Y axis center
  this.scene.y = this.height;

  // add the renderer to the page
  document.getElementById(divID).appendChild(canvas);

  // update at 30fps
  createjs.Ticker.setFPS(30);
  createjs.Ticker.addListener(function() {
    that.scene.update();
  });
};

/**
 * Add the given createjs object to the global scene in the viewer.
 *
 * @param object - the object to add
 */
ROS2D.Viewer.prototype.addObject = function(object) {
  this.scene.addChild(object);
};

/**
 * Scale the scene to fit the given width and height into the current canvas.
 *
 * @param width - the width to scale to in meters
 * @param height - the height to scale to in meters
 */
ROS2D.Viewer.prototype.scaleToDimensions = function(width, height) {
  this.scene.scaleX = this.width / width;
  this.scene.scaleY = this.height / height;
};

/**
  * Resize the viewer canvas with given width and height.
  *
  * @param width - the new width of canvas
  * @param height - the new height of canvas
  */
ROS2D.Viewer.prototype.resizeCanvas = function(width, height) {
  this.scene.canvas.width  = this.width = width;
  this.scene.canvas.height = this.height = height;
};
