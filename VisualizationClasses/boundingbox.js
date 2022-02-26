class BoundingBox extends BaseVisualization {
	static _vao = [];
	static _vbo = [];
	static _ebo = [];

	constructor(shaderMap, vDim, vCenter) {
		super(null);

		this._type = BoundingBox.name;

		this._shaders = shaderMap[this._type];
		this._shaderN = this._shaders.length;

		this._dim = new Float32Array(vDim);
		this._center = new Float32Array(vCenter);

		this._BBModelMat = glMatrix.mat4.create();
		this.calculateBBModel();
		glMatrix.mat4.identity(this._modelMat);
	}

	loadOpenGLData() {
		this.loadGLBuffers();
		this.vertexAttribPointer();

		this._draw = true;
	}

	loadGLBuffers() {
		if (aBrainGL.contextType=="webgl2") {
			this._vao.push(gl.createVertexArray());
			gl.bindVertexArray(this._vao[0]);
		}

		this._vbo.push(gl.createBuffer());
		this._ebo.push(gl.createBuffer());


		let vertices = [	 0.5,	 0.5,	-0.5,
							 0.5,	 0.5,	 0.5,
							-0.5,	 0.5,	 0.5,
							-0.5,	 0.5,	-0.5,
							 0.5,	-0.5,	-0.5,
							 0.5,	-0.5,	 0.5,
							-0.5,	-0.5,	-0.5,
							-0.5,	-0.5,	 0.5];

        let elements = [0, 1, 1, 2, 2, 3, 3, 6, 0, 3, 0, 4,
						1, 5, 2, 7, 4, 6, 4, 5, 5, 7, 6, 7];

		// VBO
		gl.bindBuffer(gl.ARRAY_BUFFER, this._vbo[0]);
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);

		// EBO
		gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this._ebo[0]);
		gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(elements), gl.STATIC_DRAW);
	}

	vertexAttribPointer() {
		this._positionAttributeLoc = gl.getAttribLocation(this._shaders[0], "aVertexPosition");

		this._uniformBBModelMatLoc = gl.getUniformLocation(this._shaders[0], "uBBModel");
		this._uniformModelMatLoc = gl.getUniformLocation(this._shaders[0], "uModel");

		gl.enableVertexAttribArray(this._positionAttributeLoc);
		gl.vertexAttribPointer(this._positionAttributeLoc, 3, gl.FLOAT, false, 0, 0);


		if (aBrainGL.contextType=="webgl2") {
			gl.bindVertexArray(null);
		}
	}

	// Only for webgl1 context
	bindBufferAttribPointers() {
		gl.bindBuffer(gl.ARRAY_BUFFER, this._vbo[0]);
		gl.vertexAttribPointer(this._positionAttributeLoc, 3, gl.FLOAT, false, 0, 0);

		gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this._ebo[0]);
	}

	updateBBModel(vDim, vCenter) {
		this._dim[0] = vDim[0];
		this._dim[1] = vDim[1];
		this._dim[2] = vDim[2];

		this._center[0] = vCenter[0];
		this._center[1] = vCenter[1];
		this._center[2] = vCenter[2];

		this.calculateBBModel();
	}

	calculateBBModel() {
		glMatrix.mat4.identity(this._BBModelMat);
		glMatrix.mat4.translate(this._BBModelMat, this._BBModelMat, this._center);
		glMatrix.mat4.scale(this._BBModelMat, this._BBModelMat, this._dim);
	}

	loadUniform() {
		gl.uniformMatrix4fv(this._uniformBBModelMatLoc, false, this._BBModelMat);
		gl.uniformMatrix4fv(this._uniformModelMatLoc, false, this._modelMat);
	}

	drawSolid() {
		if (!this._draw) { return; }

		this.configGL();
		gl.drawElements(gl.LINES, 24, gl.UNSIGNED_SHORT, 0);
		gl.bindVertexArray(null);
	}

	drawSolid_WebGL1() {
		if (!this._draw) { return; }

		this.configGL();
		gl.drawElements(gl.LINES, 24, gl.UNSIGNED_SHORT, 0);
	}

	cleanOpenGL() {
		try {
			if (aBrainGL.contextType == "webgl2") { gl.deleteVertexArray(this._vao[0]); }
			gl.deleteBuffer(this._vbo[0]);
			gl.deleteBuffer(this._ebo[0]);
		} catch(error) { console.log(error); }

		this._vao.length = 0;
		this._vbo.length = 0;
		this._ebo.length = 0;
	}

	static createProgram() {
		if (aBrainGL.contextType == 'webgl2') {
			return [createShaderProgram("boundingbox", "standard-fragment")];
		} else {
			return [createShaderProgram("boundingbox-webgl1", "standard-fragment-webgl1")];
		}

	}
}