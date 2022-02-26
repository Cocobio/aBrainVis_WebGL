class BaseVisualization {
	static _shaders = [];
	static _shaderN = 1;
	static _type = '';

	constructor(intId) {
		this._id = intId;

		this._vao = [];
		this._vbo = [];
		this._ebo = [];

		this._path = '';
		this._name = '';

		// this._shaders = [];
		this._selectedShader = 0;

		// this._shaderN = 1;

		this._modelMat = glMatrix.mat4.create();
		this._inverseModelMat = glMatrix.mat4.create();
		this._rotationMat = glMatrix.mat4.create();
		this._translateMat = glMatrix.mat4.create();
		this._scaleMat = glMatrix.mat4.create();

		this._draw = false;
		this._drawBB = false;

		// Information for the bounding box
		this._dim = glMatrix.vec3.create();
		this._center = glMatrix.vec3.create();

		this._boundingBox = null;

		this.resetModelMat();

		if (aBrainGL.contextType != "webgl2") {
			this.configGL = this.configWebGL1;
			this.drawSolid = this.drawSolid_WebGL1;
		}
	}

	configGL() {
		gl.useProgram(this["constructor"]._shaders[this._selectedShader]);
		this.loadUniform();
		gl.bindVertexArray(this._vao[this._selectedShader]);
	}

	configWebGL1() {
		gl.useProgram(this["constructor"]._shaders[this._selectedShader]);
		this.loadUniform();
		this.bindBufferAttribPointers();
	}

	drawSolid() { console.log("Not implemented in: "+this); }
	drawSolid_WebGL1() { console.log("Not implemented in: "+this); }

	bindBufferAttribPointers() { console.log("Not implemented in: "+this); }

	loadUniform() { console.log("Not implemented in: " + this); }

	get id() { return this._id; }

	get draw() { return this._draw; }
	set draw(draw) { this._draw = draw; }

	get drawBB() { return this._drawBB; }
	set drawBB(drawBB) { this._drawBB = drawBB; }

	get selectedShader() { return this._selectedShader; }
	set selectedShader(idShader) { 
		if (idShader >= this._shaders.length) {
			throw 'Selected shader out of bound!';
		}

		this._selectedShader = idShader;
	}

	rotate(mat4) {
		let inverseCenterTranslate = glMatrix.mat4.create();
		let centerTranslate = glMatrix.mat4.create();
		glMatrix.mat4.fromTranslation(centerTranslate, this._center);
		glMatrix.mat4.fromTranslation(inverseCenterTranslate,-this._center);

		glMatrix.mat4.multiply(this._rotationMat, this._rotationMat, inverseCenterTranslate);
		glMatrix.mat4.multiply(this._rotationMat, mat4, this._rotationMat);
		glMatrix.mat4.multiply(this._rotationMat, centerTranslate, this._rotationMat);

		calculateModel();
	}

	translate(mat4) {
		glMatrix.mat4.multiply(this._translateMat, mat4, this._translateMat);

		calculateModel();
	}

	scale(mat4) {
		let inverseCenterTranslate = glMatrix.mat4.create();
		let centerTranslate = glMatrix.mat4.create();
		glMatrix.mat4.fromTranslation(centerTranslate, this._center);
		glMatrix.mat4.fromTranslation(inverseCenterTranslate,-this._center);

		glMatrix.mat4.multiply(this._scaleMat, this._scaleMat, inverseCenterTranslate);
		glMatrix.mat4.multiply(this._scaleMat, mat4, this._scaleMat);
		glMatrix.mat4.multiply(this._scaleMat, centerTranslate, this._scaleMat);

		calculateModel();
	}

	calculateModel() {
		glMatrix.mat4.identity(this._modelMat);
		glMatrix.mat4.multiply(this._modelMat, this._rotationMat, this._scaleMat);
		glMatrix.mat4.multiply(this._modelMat, this._modelMat, this._translateMat);

		glMatrix.mat4.invert(this._inverseModelMat, this._modelMat);
	}

	resetModelMat() {
		glMatrix.mat4.identity(this._modelMat);
		glMatrix.mat4.identity(this._inverseModelMat);

		glMatrix.mat4.identity(this._rotationMat);
		glMatrix.mat4.identity(this._translateMat);
		glMatrix.mat4.identity(this._scaleMat);
	}

	static setupReferenceToShader(shaderMap) {
		this._shaders = shaderMap[this._type];
		this._shaderN = this._shaders.length;
	}
}