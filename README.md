# aBrainVis !

This is a project with the graphical engine of aBrainVis, an Android app. It runs with WebGL 2 and javascript.

The latest stable version runs in [github pages](https://cocobio.github.io/aBrainVis_WebGL/).


## aBrainVis v1.2.2
- Improve orbit with mouse.
- Improve pan with mouse and 3 or more touch pointers.
- Toggle bounding box checkbox.

## aBrainVis v1.2.1
- ~~Fix parser with regex (Miguel's data). ~~
- Better parsing of .bundles header. Using JSON parser.
- Change right click to panning on camera.
- Turn shaders into static inside the visualization objects.

## aBrainVis v1.2.0
- Local file loader.
- Dynamic valid files extensions (dependent on the visualization classes).
- WebGL 1 support (for old browsers or devices).
- No more white borders between pag and canvas.
- Full screen button added.
- Minor performance improvements.
- Added support for Trk and Tck tractography files.


## aBrainVis v1.1
### Major update:
- Working on OSX, iOS, Windows and Android.

#### Touch and mouse events
- Orbit the model with left mouse click.
- Pan the model with middle mouse click.
- Zoom with wheel on mouse.

- Orbit with one finger touch on touch devices.
- Zoom, pan and orbit with two fingers touch on touch devices.
- Pan with three or more finger touch on touch devices.

#### Keybord functions
- Keybord keys connected to different views of the camera (numbers 1-6).
- Keybord arrows now orbits the camera.

#### WebGL related
- WebGL handling context lost and context restore.

- Light material values now are loaded from the type of visualization object (currently just 1, but ready for extensions).
- Unbinding vertex attribute object after using them (preventing bugs).
- Working cleaning GL parameters on each GL visualization class.

- Bounding box class has vao, vbo and ebo as static.

- Workaround some bug with pointerMove event firing with out change on the pointers (creating undefined values).


## aBrainVis v1.0.1 - v1.0.2
#### Debugging update:
- v1.0.2 runs faster than v1.0.1.
- Working some issues with compatibility on OSX and mobile devices.


## aBrainVis v1.0
#### Running prototype:
- Supporting ".bundles" files.
- Spherical camera added.
- Added local brain data from Prof. Pamela Guevara's PhD thesis [1].
- Running phong light model.


### References

[1] Currently missing.