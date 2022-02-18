
class CoordinateSystem extends BaseVisualization{

	constructor(shaderProgram) {
		super(null);

		this._shaders = shaderProgram;

		///// Arrow values /////
		this.cilinderRadius = 0.015;
		this.cilinderLenght = 0.8;
		this.coneRadius = 0.05;
		this.coneLength = 0.2;

		CoordinateSystem.createArrow(this, this.cilinderRadius, this.cilinderLenght, this.coneRadius, this.coneLength, 10);

		let modelMat0 = glMatrix.mat4.create();

		let tmpQuat = glMatrix.quat.create()
		glMatrix.quat.setAxisAngle(tmpQuat, [0.,0.,1.], Math.PI/2);

		let modelMat1 = glMatrix.mat4.create();
		glMatrix.mat4.fromQuat(modelMat1, tmpQuat);

		glMatrix.quat.setAxisAngle(tmpQuat, [0.,1.,0.], -Math.PI/2);
		let modelMat2 = glMatrix.mat4.create();
		glMatrix.mat4.fromQuat(modelMat2, tmpQuat);

		this._modelMat = new Float32Array(16*3);
		this._modelMat.set(modelMat0,16*0);
		this._modelMat.set(modelMat1,16*1);
		this._modelMat.set(modelMat2,16*2);
		this._color = new Float32Array([1,0,0,1, 0,1,0,1, 0,0,1,1]);

		this.loadOpenGLData();
	}

	cleanOpenGL() {
		try {
			gl.deleteVertexArray(this._vao[0]);
			gl.deleteBuffer(this._vbo[0]);
			gl.deleteBuffer(this._ebo[0]);
		} catch(error) { console.log(error); }

		this._vao.length = 0;
		this._vbo.length = 0;
		this._ebo.length = 0;
	}

	static createArrow(cs, cilinderR, cilinderL, coneR, coneL, detail) {
		//  Creates an arrow on the x-axis, with the specified measure.
		//  detail is the number of faces, 3 = pyramid
		// 
		//  Parameters
		//  ----------
		//	cs : CoordinateSystem object
		//		coordinate system where the arrows will be saved as points and elements
		//  rCilinder : float
		//  	radius for the cilinder.
		//  lCilinder : float
		//  	lengh for the arrow before the head.
		//  rCone : float
		// 		radius for the arrow head.
		//  lCone : float
		// 		length of the arrow head.
		//  detail : int
		// 		number of faces to build the arrow.
		// 
		//  Returns
		//  -------
		//  arrowPoints : numpy.array
		//  	An array with the points.
		//  elements : numpy.array
		// 	Array with the order of the drawing.
		if (!detail || detail <3) { detail = 3; }

		let n = (detail+1)*3*3;
		cs._vertices = new Float32Array(n);

		cs._vertices[3] = cilinderL;
		cs._vertices[6] = cilinderL + coneL;

		let angle = 2*Math.PI/detail;
		
		let bodyInit = new Float32Array([0.0, cilinderR, 0.0]);
		let bodyEnd = new Float32Array([cilinderL, cilinderR, 0.0]);
		let coneBaseInit = new Float32Array([cilinderL, coneR, 0]);

		let out = glMatrix.vec3.create();

		let tmpQuat = glMatrix.quat.create();

		let k = 9 + detail*6;
		for (let i=0; i<detail; i++) {
			glMatrix.quat.setAxisAngle(tmpQuat, [1,0,0], angle*i);
			
			glMatrix.vec3.transformQuat(out, bodyInit, tmpQuat);
			cs._vertices.set(out,9+i*6);

			glMatrix.vec3.transformQuat(out, bodyEnd, tmpQuat);
			cs._vertices.set(out,12+i*6);

			glMatrix.vec3.transformQuat(out, coneBaseInit, tmpQuat);
			cs._vertices.set(out, k+i*3);
		}

		let elements = [];

		for (let i=0; i<detail; i++) {
			elements.push(0);
			elements.push(i*2+3);
			elements.push(i*2+2+3);
		} 
		elements[elements.length-1] = 3

		for (let i=0; i<detail; i++) {
			elements.push(3+i*2);
			elements.push(3+i*2+1);
			elements.push(3+i*2+2);

			elements.push(3+i*2+1);
			elements.push(3+i*2+2);
			elements.push(3+i*2+3);
		}
		elements[elements.length-1] = 4;
		elements[elements.length-2] = 3;
		elements[elements.length-4] = 3;

		for (let i=0; i<detail; i++) {
			elements.push(1);
			elements.push(i + 3+2*detail);
			elements.push(i+1+3+2*detail);
		}
		elements[elements.length-1] = 3+2*detail;

		for (let i=0; i<detail; i++) {
			elements.push(2);
			elements.push(i + 3+2*detail);
			elements.push(i+1+3+2*detail);
		}
		elements[elements.length-1] = 3+2*detail;

		cs._elements = new Uint16Array(elements);
		cs._elementLength = elements.length;
	}

	loadOpenGLData() {
		this.loadGLBuffers();
		this.vertexAttribPointer();
	}

	loadGLBuffers() {
		this._vao.push(gl.createVertexArray());

		this._vbo.push(gl.createBuffer());
		this._ebo.push(gl.createBuffer());
		
		gl.bindVertexArray(this._vao[0]);

		// VBO
		// Vertex Data
		gl.bindBuffer(gl.ARRAY_BUFFER, this._vbo[0]);
		gl.bufferData(gl.ARRAY_BUFFER, this._vertices, gl.STATIC_DRAW);


		// EBO
		gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this._ebo[0]);
		gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, this._elements, gl.STATIC_DRAW);

		// unbind vao
		gl.bindVertexArray(null);
	}

	vertexAttribPointer() {
		gl.bindVertexArray(this._vao[0]);

		let positionAttrib = gl.getAttribLocation(this._shaders[0], "aVertexPosition");

		this._uniformColorArrayLoc = gl.getUniformLocation(this._shaders[0], "uColorArray");
		this._uniformMMatrixArrayLoc = gl.getUniformLocation(this._shaders[0], "uModelArray");

		gl.enableVertexAttribArray(positionAttrib);
		gl.vertexAttribPointer(positionAttrib, 3, gl.FLOAT, false, 0, 0);

		// unbind vao
		gl.bindVertexArray(null);
	}

	loadUniform() {
		gl.uniform4fv(this._uniformColorArrayLoc, this._color);
		gl.uniformMatrix4fv(this._uniformMMatrixArrayLoc, false, this._modelMat);
	}

	drawSolid() {
		this.configGL();

		gl.drawElementsInstanced(gl.TRIANGLES, this._elementLength, gl.UNSIGNED_SHORT, 0, 3);

		// unbind vao
		gl.bindVertexArray(null);
	}

	static createProgram() {
		return [createShaderProgram("coordinate-system", "standard-fragment")];
	}

	updateReferenceToShader(shaderProgram) {
		this._shaders = shaderProgram;
	}
}
